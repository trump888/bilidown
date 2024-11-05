import van, { State } from 'vanjs-core'
import { Route, goto, now } from 'vanjs-router'
import { checkLogin, GLOBAL_HAS_LOGIN, GLOBAL_HIDE_PAGE, ResJSON, VanComponent } from '../mixin'
import { deleteTask, getActiveTask, getTaskList, showFile } from './data'
import { TaskInDB, TaskStatus } from '../work/type'
import { LoadingBox } from '../view'

const { div } = van.tags

const { svg, path } = van.tags('http://www.w3.org/2000/svg')

export class TaskRoute implements VanComponent {
    element: HTMLElement

    loading = van.state(false)

    taskList: State<(TaskInDB & {
        /** 音频下载进度百分比 */
        audioProgress: State<number>
        /** 视频下载进度百分比 */
        videoProgress: State<number>
        /** 合并进度百分比 */
        mergeProgress: State<number>
        /** 任务状态 */
        statusState: State<TaskStatus>
        /** 是否正在打开 */
        opening: State<boolean>
    })[]> = van.state([])

    constructor() {

        this.element = this.Root()
    }

    Root() {
        const _that = this
        return Route({
            rule: 'task',
            Loader() {
                return div(
                    () => _that.loading.val ? LoadingBox() : '',
                    () => div({ class: 'list-group', hidden: _that.loading.val },
                        _that.taskList.val.map(task => {
                            const filename = `${task.title} ${btoa(task.id.toString()).replace(/=/g, '')}.mp4`
                            return div({
                                class: () => `list-group-item p-0 hstack user-select-none ${task.statusState.val != 'done' && task.statusState.val != 'error' || task.opening.val ? 'disabled' : ''}`,
                            },
                                div({
                                    class: 'vstack gap-2 py-2 px-3',
                                    style: `cursor: pointer;`,
                                    onclick() {
                                        if (task.statusState.val != 'done') return
                                        showFile(`${task.folder}\\${filename}`)
                                        task.opening.val = true
                                        setTimeout(() => {
                                            task.opening.val = false
                                        }, 3000)
                                    }
                                },
                                    div({
                                        class: () => `
                                        ${task.statusState.val == 'error' ? 'text-danger' : ''}
                                        ${task.statusState.val == 'waiting' || task.statusState.val == 'running'
                                                ? 'text-primary' : ''}`
                                    },
                                        () => task.opening.val ? '正在打开...' : filename),
                                    div({ class: 'text-secondary small' },
                                        () => {
                                            if (task.statusState.val == 'waiting') return '等待下载'
                                            if (task.statusState.val == 'error') return '下载失败'
                                            if (task.videoProgress.val == 0) {
                                                return `正在下载音频 (${(task.audioProgress.val * 100).toFixed(2)}%)`
                                            } else if (task.mergeProgress.val == 0) {
                                                return `正在下载视频 (${(task.videoProgress.val * 100).toFixed(2)}%)`
                                            } else if (task.statusState.val == 'running') {
                                                return `正在合并音视频 (${(task.mergeProgress.val * 100).toFixed(2)}%)`
                                            } else {
                                                return task.folder
                                            }
                                        }
                                    ),
                                    div({
                                        class: `progress`,
                                        style: `height: 5px`,
                                        hidden: () => task.statusState.val == 'done' || task.statusState.val == 'error'
                                    },
                                        div({
                                            class: () => `progress-bar progress-bar-striped progress-bar-animated bg-${(() => {
                                                if (task.videoProgress.val == 0) return 'primary'
                                                if (task.mergeProgress.val == 0) return 'success'
                                                else return 'info'
                                            })()}`,
                                            style: () => {
                                                let width = 0
                                                if (task.videoProgress.val == 0) width = task.audioProgress.val * 100
                                                else if (task.mergeProgress.val == 0) width = task.videoProgress.val * 100
                                                else width = task.mergeProgress.val * 100
                                                return `width: ${width}%`
                                            }
                                        }),
                                    )
                                ),
                                div({
                                    class: 'ps-3 pe-4',
                                    hidden: task.statusState.val != 'done' && task.statusState.val != 'error' || task.opening.val
                                },
                                    div({
                                        class: 'delete-btn', title: '删除视频',
                                        onclick() {
                                            if (!confirm('确定要删除该视频文件吗？')) return
                                            deleteTask(task.id).then(() => {
                                                _that.taskList.val = _that.taskList.val.filter(taskInDB => taskInDB.id != task.id)
                                            }).catch(error => {
                                                alert(error.message)
                                            })
                                        }
                                    },
                                        _that.DeleteSVG()
                                    )
                                )
                            )
                        })
                    )
                )
            },
            async onFirst() {
                if (!await checkLogin()) return
            },
            async onLoad() {
                if (!GLOBAL_HAS_LOGIN.val) return goto('login')
                _that.loading.val = true

                getTaskList(0, 360).then(taskList => {
                    if (!taskList) return
                    _that.taskList.val = taskList.map(task => ({
                        ...task,
                        audioProgress: van.state(1),
                        videoProgress: van.state(1),
                        mergeProgress: van.state(1),
                        statusState: van.state(task.status),
                        opening: van.state(false)
                    }))

                    const refresh = async () => {
                        const activeTaskList = await getActiveTask()
                        if (!activeTaskList) return false
                        setTimeout(() => {
                            _that.loading.val = false
                        }, 200)

                        _that.taskList.val.forEach(taskInDB => {
                            activeTaskList.forEach(task => {
                                if (taskInDB.id == task.id) {
                                    taskInDB.audioProgress.val = task.audioProgress
                                    taskInDB.videoProgress.val = task.videoProgress
                                    taskInDB.mergeProgress.val = task.mergeProgress
                                    taskInDB.statusState.val = task.status
                                }
                            })
                        })
                        if (activeTaskList.filter(task => task.status == 'running').length == 0) {
                            clearInterval(timer)
                            clearInterval(halper)
                        }
                        return true
                    }

                    refresh()

                    let timer = setInterval(() => {
                        refresh()
                    }, 1000)
                    let halper = setInterval(() => {
                        if (now.val.split('/')[0] != 'task') {
                            clearInterval(halper)
                            clearInterval(timer)
                        }
                    })
                })
            },
        })
    }

    DeleteSVG() {
        return svg({ style: `width: 1em; height: 1em`, fill: "currentColor", class: "bi bi-trash3", viewBox: "0 0 16 16" },
            path({ "d": "M6.5 1h3a.5.5 0 0 1 .5.5v1H6v-1a.5.5 0 0 1 .5-.5M11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3A1.5 1.5 0 0 0 5 1.5v1H1.5a.5.5 0 0 0 0 1h.538l.853 10.66A2 2 0 0 0 4.885 16h6.23a2 2 0 0 0 1.994-1.84l.853-10.66h.538a.5.5 0 0 0 0-1zm1.958 1-.846 10.58a1 1 0 0 1-.997.92h-6.23a1 1 0 0 1-.997-.92L3.042 3.5zm-7.487 1a.5.5 0 0 1 .528.47l.5 8.5a.5.5 0 0 1-.998.06L5 5.03a.5.5 0 0 1 .47-.53Zm5.058 0a.5.5 0 0 1 .47.53l-.5 8.5a.5.5 0 1 1-.998-.06l.5-8.5a.5.5 0 0 1 .528-.47M8 4.5a.5.5 0 0 1 .5.5v8.5a.5.5 0 0 1-1 0V5a.5.5 0 0 1 .5-.5" }),
        )
    }
}

export default () => new TaskRoute().element