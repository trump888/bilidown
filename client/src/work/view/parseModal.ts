import van, { State } from 'vanjs-core'
import { VanComponent } from '../../mixin'
import { PageInParseResult, PlayInfo } from '../type'
import { WorkRoute } from '..'
import { getPlayInfo } from '../data'
import PQueue from 'p-queue'

const { a, button, div, input } = van.tags

type Option = {
    workRoute: WorkRoute
}
export class ParseModalComp implements VanComponent {
    element: HTMLElement

    totalCount: State<number>
    finishCount = van.state(0)

    abortControllers: AbortController[] = []

    currentController?: AbortController

    allPlayInfo: State<{
        page: PageInParseResult
        info: PlayInfo
        selected: State<boolean>
        formatIndex: State<number>
    }[]> = van.state([])

    constructor(public option: Option) {
        const _that = this
        this.totalCount = van.derive(() => option.workRoute.selectedPages.val.length)
        const allFinish = van.derive(() => this.totalCount.val == this.finishCount.val)
        this.element = div({ class: `modal fade`, tabIndex: -1 },
            div({ class: () => `modal-dialog modal-xl modal-fullscreen-xl-down ${this.totalCount.val < 10 ? '' : 'modal-dialog-scrollable'}` },
                div({ class: `modal-content` },
                    div({ class: `modal-header` },
                        div({ class: `h5 modal-title` }, () => allFinish.val ? '批量下载' : '批量解析'),
                        button({ class: `btn-close`, 'data-bs-dismiss': `modal` })
                    ),
                    div({ class: `modal-body vstack gap-3`, tabIndex: -1, style: 'outline: none;' },
                        this.ParseProgress(),
                        this.ListGroup()
                    ),
                    this.ModalFooter()
                )
            )
        )

        this.element.addEventListener('hidden.bs.modal', () => {
            this.allPlayInfo.val = []
            this.finishCount.val = this.totalCount.val
            for (const controller of this.abortControllers) {
                controller.abort()
            }
            this.abortControllers = []
        })

        this.element.addEventListener('show.bs.modal', () => {
            this.start()
        })
    }

    /** 开始解析 */
    async start() {
        this.finishCount.val = 0
        const queue = new PQueue({ concurrency: 10 })
        for (const page of this.option.workRoute.selectedPages.val) {
            queue.add(async () => {
                if (this.totalCount.val == this.finishCount.val) return
                const controller = new AbortController()
                this.abortControllers.push(controller)
                const playInfo = await getPlayInfo(page.bvid, page.cid, controller)
                this.allPlayInfo.val = this.allPlayInfo.val.concat({
                    page,
                    info: playInfo,
                    selected: van.state(true),
                    formatIndex: van.state(0),
                })
                this.finishCount.val++
            }).catch(() => { })
        }
        await queue.onIdle()
    }

    async download() {
        const selectedPlayInfos = this.allPlayInfo.val.filter(info => info.selected.val)
        // 需要传递给服务器，需要创建下载任务的数据列表
        console.log(selectedPlayInfos)
    }

    ParseProgress() {
        return div({ class: 'vstack gap-3', hidden: () => this.totalCount.val == this.finishCount.val },
            div({ class: 'text-center fs-5' }, () => `正在解析，剩余 ${this.totalCount.val - this.finishCount.val} 项`),
            div({ class: 'progress' }, div({
                class: 'progress-bar progress-bar-striped progress-bar-animated',
                style: () => `width: ${this.finishCount.val / this.totalCount.val * 100}%`
            },)),
        )
    }

    ListGroup() {
        return () => div({ class: 'list-group', hidden: () => this.totalCount.val != this.finishCount.val },
            this.allPlayInfo.val.map(info => {
                const badgeNotNum = !info.page.bandge.match(/^\d+$/)

                return div({
                    class: 'list-group-item user-select-none py-0',
                    role: 'button',
                    onclick(event) {
                        if ((event.target as HTMLElement).getAttribute('class')?.match(/dropdown-?/)) return
                        info.selected.val = !info.selected.val
                    }
                },
                    div({ class: 'hstack gap-2' },
                        div({ class: 'hstack gap-3 flex-fill' },
                            input({
                                class: 'form-check-input', type: 'checkbox', checked: info.selected,
                            }),
                            div({},
                                div(info.page.part),
                                badgeNotNum ? div({ class: info.page.part ? 'small text-secondary' : '' }, info.page.bandge) : ''
                            ),
                        ),
                        div({ class: 'dropdown' },
                            div({ class: 'dropdown-toggle py-2', 'data-bs-toggle': 'dropdown' },
                                () => info.info.accept_description[info.formatIndex.val]
                            ),
                            () => div({ class: 'dropdown-menu' },
                                Array(info.info.accept_description.length).fill(0).map((_, index) => {
                                    return div({
                                        class: () => `dropdown-item ${info.formatIndex.val == index ? 'active' : ''}`,
                                        onclick() {
                                            info.formatIndex.val = index
                                        }
                                    }, info.info.accept_description[index])
                                })
                            )
                        )
                    )
                )
            })
        )
    }

    ModalFooter() {
        const _that = this

        const selectedCount = van.derive(() => this.allPlayInfo.val.filter(info => info.selected.val).length)
        const totalCount = van.derive(() => this.allPlayInfo.val.length)
        /** 解析完成列表全部选中 */
        const allSelected = van.derive(() => selectedCount.val == totalCount.val)
        /** 是否全部解析完成 */
        const allFinish = van.derive(() => this.totalCount.val == this.finishCount.val)

        return div({ class: `modal-footer` },
            div({ class: 'me-auto', hidden: () => !allFinish.val },
                () => `已选择 (${selectedCount.val}/${totalCount.val}) 项`
            ),
            button({
                class: `btn btn-secondary`,
                'data-bs-dismiss': `modal`,
                hidden: allFinish
            }, '取消解析'),
            button({
                class: 'btn btn-secondary', hidden: () => !allFinish.val || allSelected.val,
                onclick() {
                    _that.allPlayInfo.val.forEach(info => info.selected.val = true)
                }
            }, '全选'),
            button({
                class: 'btn btn-warning', hidden: () => !allFinish.val || !allSelected.val,
                onclick() {
                    _that.allPlayInfo.val.forEach(info => info.selected.val = false)
                }
            }, '全不选'),
            button({
                class: `btn btn-primary`, onclick() {
                    _that.download()
                },
                hidden: () => !allFinish.val,
                disabled: () => selectedCount.val <= 0
            }, '开始下载'),
        )
    }
}