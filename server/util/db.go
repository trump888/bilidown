package util

import (
	"database/sql"
	"fmt"
	"strings"
)

func CreateLog(db *sql.DB, content string) error {
	_, err := db.Exec(`INSERT INTO "log" ("content") VALUES (?)`, content)
	return err
}

func GetFields(db *sql.DB, names ...string) (map[string]string, error) {
	if len(names) == 0 {
		return nil, nil
	}

	placeholders := make([]string, len(names))
	for i := 0; i < len(names); i++ {
		placeholders[i] = "?"
	}
	query := fmt.Sprintf(`SELECT "name", "value" FROM "field" WHERE "name" IN (%s)`, strings.Join(placeholders, ","))

	values := make([]interface{}, len(names))
	for i := 0; i < len(names); i++ {
		values[i] = names[i]
	}

	row, err := db.Query(query, values...)
	if err != nil {
		return nil, err
	}
	defer row.Close()
	var name, value string
	fields := make(map[string]string)
	for row.Next() {
		if err := row.Scan(&name, &value); err != nil {
			return nil, err
		}
		fields[name] = value
	}
	return fields, nil
}

func SaveFields(db *sql.DB, data [][2]string) error {
	if len(data) == 0 {
		return nil
	}

	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer func() {
		if err != nil {
			tx.Rollback()
		} else {
			tx.Commit()
		}
	}()

	stmt, err := tx.Prepare(`INSERT OR REPLACE INTO "field" ("name", "value") VALUES (?, ?)`)
	if err != nil {
		return err
	}
	defer stmt.Close()

	for _, d := range data {
		_, err = stmt.Exec(d[0], d[1])
		if err != nil {
			return err
		}
	}

	return nil
}

type FieldUtil struct{}

func (f FieldUtil) AllowSelect() []string {
	return []string{
		"download_folder",
	}
}

func (f FieldUtil) AllowUpdate() []string {
	return []string{
		"download_folder",
	}
}

func (f FieldUtil) IsAllow(allFields []string, names ...string) bool {
	allowedFields := make(map[string]struct{})
	for _, field := range allFields {
		allowedFields[field] = struct{}{}
	}
	for _, name := range names {
		if _, exists := allowedFields[name]; !exists {
			return false
		}
	}
	return true
}

func (f FieldUtil) IsAllowSelect(names ...string) bool {
	return f.IsAllow(f.AllowSelect(), names...)
}

func (f FieldUtil) IsAllowUpdate(names ...string) bool {
	return f.IsAllow(f.AllowUpdate(), names...)
}
