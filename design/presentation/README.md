# Campus · Pen UI 交付

更新：2026-10-03。范围：iPhone App 的完整设计与浏览器展示。

## 打开

- 可编辑主文件：`design/campus-apple.pen`。在 Pen 中打开；右侧找到 **START HERE / 完整 App 设计与演示**。
- 画布内 **LIVE / 点击这里体验完整 App**（节点 `rqscf`）是可操作的浏览器展示。
- 展示地址：http://127.0.0.1:14331/
- 本地服务关闭后，在项目根目录运行：`zsh scripts/preview-pen-ui.sh`。
- 全页 PDF：`design/presentation/pdf/export.pdf`，102 页，方便离线审阅。
- 图层导出：`design/presentation/all-screens.html`；页面索引与路由：`manifest.json`。
- 原设计备份：`.local/pen-complete/campus-apple.before.pen`。

直接双击 HTML 会受到浏览器本地文件读取限制；请使用上面的本地地址。照片沿用原设计的 Unsplash 示例素材，浏览器加载照片需要网络；不代表真实 HKUST 场景。

## 本次完成

- 102 个页面与状态，另有 8 个深色样例。页面数量包含空态、失败、确认等状态，不等于 102 个业务功能。
- 7 个可复用组件：主按钮、导航行、五栏导航、状态栏、列表行、文本输入、反馈提示。
- 基础色彩使用 Pen 的 light/dark 变量；补齐输入默认、聚焦、错误、禁用，以及按钮保存中、成功、重试样例。
- 五个主入口保持今天 / 校园 / 发现 / 消息 / 我的，补齐周课表、全部校园服务、学校连接、设置及活动管理入口。
- 英文和大字号为代表性设计检查页；尚未逐页完成英文与繁体翻译。
- 新展示直接使用 Pen 导出的文字、图标与图层，再补上输入、路由和示例状态，支持键盘聚焦、返回、草稿保留、空值校验、外观切换和减少动态效果。
- 活动与帖子通过同一详情模板展示不同示例内容；无需每条内容各画一套业务页面。

## 已验收的浏览器行为

1. 活动详情 → 报名确认 → 已确认；日程选项开启时，今天和消息同步更新。
2. 日程选项默认关闭；不选择时不会自动加入个人日程。
3. 满员 → 候补；离线情境 → 结果待确认；切换情境后重试恢复。候补与确认分开显示。
4. 退出活动后清除对应演示日程，并新增消息。
5. 任务名称为空时停留编辑并标记错误；返回弹出草稿确认；重开恢复输入；保存后今天和课程出现同一安排。
6. 发起活动 → 预览保留字段 → 发布至本次演示中的管理页。
7. 地点页的纠错入口、收藏操作；应用内返回；海边活动的详情与确认信息一致。
8. 102 个页面在 360px 视口下无页面横向溢出；筛选项通过横向滚动展示。
9. 深色标签对比度修复；手动减少动态效果开关移除动画，CSS 同时尊重系统 prefers-reduced-motion。
10. Pen 完整画布几何检查无被父容器裁切的节点。组件板与核心页面已目视检查。

这里验证的是浏览器演示；没有以截图或导出成功代替原生 App 验收。

## 交付边界

- **可直接使用**：Pen 源文件继续设计、评审和开发交接；本地浏览器演示用于操作展示；PDF 用于全页审阅。
- **不等于生产实现**：102 个设计页面没有全部移植到 Expo/SwiftUI。浏览器里的新交互仅保存在内存中，刷新重置；不会向学校、邮箱或社交后台发送数据。
- 学校 SSO/SIS/Canvas/邮箱尚未接通；学校认证不能由第三方 App 收集密码代办。对应页面是授权流程与接入边界的设计。
- 学业记录、邮件、作业提交、AI、数字身份、小组件及跨设备能力均标明后续设计或授权要求；没有伪造真实成绩、收件箱或提交回执。
- 系统触觉、原生手势、系统权限弹窗、真机布局与原生动画仍需 iOS 运行验收。
- 浏览器内地图是地点导览概念，没有真实室内导航或实时车辆位置。
- 官网与管理后台不属于这次 iPhone 画板的 102 页范围；现有代码保持原状。

## 动效交接

| 操作 | 浏览器实现 | 状态规则 |
|---|---|---|
| 进入详情 | 220ms 位移 20px + 淡入 | 聚焦页面标题 |
| 返回 | 200ms 反向位移 16px | 恢复上一页滚动位置 |
| Tab | 140ms 淡入 | 点击当前 Tab 回顶部 |
| 草稿确认 | 220ms 上移淡入 | 继续 / 保留 / 放弃 |
| 提交 | 350ms 示例延迟、防重复点击 | 成功 / 候补 / 待确认 |
| 减少动态效果 | 禁用动画和过渡 | 保留反馈与状态 |

## 页面索引

此处的“阶段”说明设计对应的产品阶段，不说明接口或原生页面已经实现。所有条目均为可编辑设计。

| 页面 key | 标题 | Pen 节点 | 阶段 |
|---|---|---|---|
| today | 今天 | vkMwi | MVP |
| campus | 校园 | DBOQz | MVP |
| discover | 发现 | MjoHv | MVP |
| inbox | 消息 | t1Arsk | MVP |
| me | 我的 | B7wsR | MVP |
| course | 信息系统管理 | C5VmhJ | MVP |
| task | 把想法，整理清楚。 | q22eT | MVP |
| import | 先看看，再放进日程。 | IDCj6 | MVP |
| shuttle | 校巴时刻表 | n71ixQ | MVP |
| place | 图书馆 | d7WFL | MVP |
| activity | 图书馆，自习一小时 | lAQTw | MVP |
| join | 确认报名 | oiYrF | MVP |
| confirmed | 报名已确认 | zrHOJ | MVP |
| waitlisted | 已加入候补 | v69Dn | MVP |
| uncertain | 暂时无法确认结果 | qOuXf | MVP |
| wall | 校园墙 | oSpb6 | MVP |
| post | 怎么找到课室？ | j2X69 | MVP |
| saved | 想再见的人和事。 | xD7W4 | MVP |
| privacy | 留好自己的空间。 | FiPCa | MVP |
| empty | 暂时没有合适的 | M2UXBG | MVP |
| offline | 暂时连不上 | FDPsd | MVP |
| welcome | 大学生活， 从容一点。 | DCTVp | MVP |
| school-login | 返回 | X155X | MVP |
| sis-consent | 返回 | y6wMQ | MVP |
| sync | 正在整理你的课表 | z3Hr2J | MVP |
| connections | 学校连接 | RukkW | MVP |
| week | 本周课表 | uwRFc | MVP |
| task-edit | 添加安排 | B4cNH | MVP |
| course-edit | 课程偏好 | l4ygQI | MVP |
| notes | 私人笔记 | VESOP | MVP |
| materials | 课程资料 | YtX8u | MVP |
| material-edit | 添加资料 | YDVa8 | MVP |
| ics-conflicts | 确认导入变化 | n5Chc | MVP |
| reminders | 提醒，刚刚好 | OtBqH | MVP |
| permission | 不错过，也不打扰 | oLmD5 | MVP |
| empty-study | 今天，留点空白 | xocoH | MVP |
| search | 想找什么？ | Bn29q | MVP |
| directory | 校园生活 | DzQxm | MVP |
| public-transit | 离开校园 | fpXlD | MVP |
| transit-detail | 到站预测 | SMNyM | MVP |
| correction | 帮大家改准一点 | JGoFz | MVP |
| correction-sent | 纠错已记录 | ISlgM | MVP |
| source | 信息从哪里来 | tLSyW | MVP |
| create-activity | 一起做点小事 | zMWmp | MVP |
| activity-preview | 发布前再看一眼 | ptJRT | MVP |
| manage-activity | 我的活动 | RlqMw | MVP |
| participants | 参与者 | Tkykq | MVP |
| reschedule | 修改活动 | nsF0l | MVP |
| cancel-activity | 取消这次活动？ | IXilt | MVP |
| cancelled | 活动已取消 | WENqH | MVP |
| activity-chat | 活动讨论 | UyFsc | MVP |
| wall-compose | 有什么想分享？ | XiMkD | MVP |
| report | 告诉我们问题 | bhwKo | MVP |
| blocked | 屏蔽管理 | tKFsu | MVP |
| unblock | 解除屏蔽？ | HtySB | MVP |
| feedback | 我的反馈 | Ff1nd | MVP |
| account-profile | 你的校园名片 | K43Sjn | MVP |
| avatar | 选择头像 | n08b1e | MVP |
| appearance | 按你的习惯 | A9wMaW | MVP |
| language | 语言 | kpogc | MVP |
| notification-settings | 消息与通知 | s1c5ns | MVP |
| delete-account | 离开前，再确认 | K09fbk | MVP |
| deleted | 账号已删除 | iFcjT | MVP |
| draft | 还有没保存的内容 | tYT5o | MVP |
| session-expired | 需要重新登录 | mFEgW | MVP |
| services | 办事，少走一步 | V8N7A | MVP |
| service-detail | 教务与注册 | oRLe9 | MVP |
| departments | 学院与教师 | Psv7X | MVP |
| teacher | 教师资料 | FtsjM | 授权后深化 |
| dining | 吃点什么 | mUCiT | MVP |
| reviews | 大家的体验 | sSRfe | 后续设计 |
| clubs | 找到你的圈子 | BvQO4 | MVP |
| club-detail | 周末摄影小组 | D3FVQh | MVP |
| file | 课堂资料 | G0jiP9 | 待学校授权 |
| downloads | 下载与打包 | B7R17K | 待学校授权 |
| grades | 学业记录 | qyFTN | 待SIS扩展授权 |
| mail | 学校邮箱 | w8P85 | 待Graph授权 |
| mail-detail | 课程通知 | O5vEDM | 待Graph授权 |
| mail-compose | 写邮件 | Iq5nu | 待Graph写入授权 |
| mail-review | 确认后再发送 | vbtnk | 待Graph写入授权 |
| assignment | 作业详情 | S9nEgX | 待Canvas授权 |
| submission | 提交前确认 | TOXNy | 独立写入交付 |
| submission-receipt | 提交结果待确认 | a7JxxC | 独立写入交付 |
| assistant | 需要一点帮助？ | nfmHc | 后续AI设计 |
| assistant-consent | 这次可以看什么 | ZRv5x | 后续AI设计 |
| assistant-answer | 把今晚安排轻一点 | p8I5c | 后续AI设计 |
| ai-settings | AI 与你的资料 | ab76M | 后续AI设计 |
| identity | 校园资料 | iR0FP | 待学校授权 |
| widgets | 抬眼就能看到 | Isf79 | 后续系统扩展 |
| devices | 设备与同步 | jgoe0 | 后续跨设备设计 |
| sync-conflict | 两处修改不一样 | zTekz | MVP |
| motion | 舒服的交互 | wr9bV | MVP |
| large-text | 字体大一点， 也能看清楚 | VfD1p | MVP |
| english | A little room in your day. | NUGyH | MVP |
| map | 返回 | htHkn | MVP |
| withdraw | 这次先不参加了？ | CIoM7 | MVP |
| withdrawn | 已经退出 | W8UbTL | MVP |
| login-failed | 还没有连接成功 | eM8ER | MVP |
| sync-partial | 有一部分还在等 | v0fqT | MVP |
| task-completed | 又完成了一件事 | N5SOGE | MVP |
| settings | 设置 | JHWsS | MVP |
| all-apps | 校园里的每件小事 | uMMvf | MVP |


### 2026-10-04 原生返回关系修正

沿用现有消息、今天、活动详情及校园墙详情页面，不新增视觉屏。消息/今天进入发现中的详情后，详情返回应回到来源入口；来源页面保留自己的列表或日期上下文。活动内编辑先返回活动详情，再返回来源。账户切换后清除旧来源目标。系统通知直接打开的详情沿用发现作为默认返回位置。对应实现 `apps/mobile/App.tsx`；消息与今天来源路径已有实际 iOS 证据（今天返回保留所选日期，见 2026-10-04-ios-promotion-handoff），校园墙路径仍需原生补验，不能由设计说明推定通过。

### 2026-10-04 X05 重要事务核心状态

新增六个设计节点，见 [专用交接](../affairs/README.md) 与 [节点索引](../affairs/manifest.json)。独立标记 design_only；尚未加入浏览器演示或原生路由，不计入已实现功能。
