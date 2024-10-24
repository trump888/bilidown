import van from 'vanjs-core'
import { now } from 'vanjs-router'

const { a, div } = van.tags

export default () => {
    const classStr = (name: string) => van.derive(() => `nav-link ${now.val.split('/')[0] == name ? 'active' : ''}`)

    return div({ class: 'hstack gap-4' },
        div({ class: 'fs-4 fw-bold' }, 'Bilidown'),
        div({ class: 'nav nav-underline' },
            div({ class: 'nav-item' },
                a({ class: classStr('work'), href: '#/work' }, '视频解析')
            ),
            div({ class: 'nav-item' },
                a({ class: classStr('task'), href: '#/task' }, '任务列表')
            ),
        )
    )
}