# 首版 MVP：当前证据与尚未通过的验收

**用户新要求（2026-10-03）**：连接学校数据源后自动出现学习信息为主流程，ICS只作为备用。Canvas作业/事件与SIS正式课表必须分别接入、统一展示。当前两者未接通，是核心功能缺口，不能只用iOS运行环境阻塞来概括剩余工作。详见 `../superpowers/specs/2026-10-03-school-learning-sync.md`；下表原V03/ICS证据不证明自动同步完成。

核对日期：2026-10-03。范围依据 `docs/superpowers/specs/2026-10-02-ios-mvp-v1-product.md`，不扩大首版、不删除长期路线图。原生项目在 `apps/mobile`，真实持久化后端在 `src/product`，网站/后台在 `apps/hub`；`design/campus-apple.pen` 和网页 mock 是独立交付物。

本次重新检查规格、原生保存/账户/校园操作源码、相关测试用例及实际运行结果。最新 `npm test` 为289个测试/50文件通过，原生 TypeScript 和 iOS Hermes 导出通过。已有网页截图/浏览器操作记录是历史证据，此次没有重新执行那些网页交互。

**整体尚未通过。** 当前 developer directory 为 CommandLineTools，`simctl` 不可用，标准 Xcode 路径不存在。用户已推迟 Xcode；是否有获准测试的 iPhone 尚未收到答复。手机上的三条主流程均无运行截图或交互验收，不用网页、mock、测试数或编译结果抵扣。

后续只读运行环境复核见 `evidence/native-runtime-preflight/blocker.md`：未发现可用安装、运行时或连接的USB设备；旧模拟器记录无对应运行时。重复阻塞审计后，Goal工具已返回 **blocked**，等待恢复安装或提供现有运行环境的明确选择。此状态不改变以下完成标准。

## 功能覆盖 V01–V10

| 要求 | 当前实现和依据 | 尚缺的直接证据/范围边界 |
| --- | --- | --- |
| V01 账户 | `session.ts`、AccountScreen、`src/product/auth.ts`；邮箱验证码、资料、资格 unknown、退出/删除、权限；真实HTTP账户及退出测试 | Keychain、手机登录/失效/换号实际行为；正式邮件和学校SSO未接入 |
| V02 今天/学习 | StudyScreen/StudyForm、learning store；课程、日/周、任务、笔记、资料链接；当前保存响应与操作恢复测试 | 手机端查看/编辑/返回/刷新、长文本与键盘；日期时间仍为明确格式输入，不能称原生日历选择体验已完成 |
| V03 ICS | ImportScreen/SourceScreen、calendar store/parser；预览/确认、周期例外、单次修改、冲突和来源管理；product-ics/ics-calendar/calendar-store测试 | iOS系统文件选择器、真实文件导入、预览长列表和冲突选择尚未操作验收 |
| V04 交通 | CampusScreen/PublicTransitScreen、campus shuttle/public-transit；已登记路线、假期、来源有效期/失效；product-shuttle/public-transit测试 | 手机断网、重入、预测过期表现；当前上游可用性不由旧抓取证明。无GPS车位；具体覆盖见 campus-api.md |
| V05 目录 | DirectoryScreen/TargetActions、directory store；分类搜索详情、收藏、官方入口、纠错；product-directory及native-campus-actions测试；已补导航保护/固定请求恢复和刷新期间保留 | 手机端跨页、定时刷新、输入和返回确认尚未实际验收 |
| V06 发现/墙 | Community/Discover/Wall/Form/Detail、social store/wall；活动/招募筛选发布、文字求助回复/解决 | 手机发布/编辑/筛选/返回；媒体未开放，不提供假上传入口 |
| V07 参与/组织 | ActivityDetail/JoinActivitySheet、activity-join controller；确认、候补、退出、改期取消及评论；真实事务/并发与本地HTTP证据 | 另一账户在iOS完成整条链；名额状态弹层、返回与键盘实际交互 |
| V08 消息/提醒 | InboxScreen/inbox-controller、reminders controller/device及服务端投影；真实已读/重启HTTP验证；模拟OS调度测试 | 实际iOS通知权限、送达、取消、点开目标；不等于远端APNs |
| V09 我的/数据 | ProfileScreen、本人保存/参与入口、导出/删除；后端隔离和原生会话测试 | 手机分享面板导出、重新登录后无旧私有内容、偏好及提醒实际持久化 |
| V10 后台/官网 | Next官网/支持/隐私/公开分享、受限后台维护地点/来源/已有路线/假期/活动/举报；web gateway及维护测试 | 公开部署不在本目标；新路线创建不在现有编辑器。历史浏览器证据不代表iOS完成 |

## 必须通过的 MV01–MV12

| 项 | 当前直接证据 | 判定及未完成部分 |
| --- | --- | --- |
| MV01 启动+iOS运行 | development-ios.md启动序列、环境检查、最新原生编译/导出 | **未通过**：没有运行中的iOS App或环境/主流程截图 |
| MV02 多账户/管理员隔离 | product-auth/learning/governance/web、mobile-session等真实服务端用例 | **部分**：后端隔离有证据；三角色手机/后台组合验收未完整记录 |
| MV03 持久化/退出/缓存 | directory/social/wall、native-inbox/account-exit及mobile-session重启/隔离用例；inbox HTTP smoke | **部分**：实际手机缓存、Keychain、换号/退出场景未验收 |
| MV04 ICS语义 | product-ics、ics-calendar、calendar-store，真实预览/确认/重导/例外测试 | **部分**：服务端有证据；iOS选择文件→预览→保存→课表无端到端证据 |
| MV05 交通边界/过期 | product-shuttle/public-transit；旧公开接口探测在e3/public-transit | **部分**：规则与适配器已测；实际手机断网/时间变化、当前上游状态未验收 |
| MV06 名额并发/联动 | product-social独立SQLite连接并发、候补/撤回/改期/取消投影；e4/activity-http-smoke | **部分**：后台联动有证据；两账户iOS操作及本地提醒未实际验收 |
| MV07 墙/治理可见性 | product-wall/governance及wall-governance HTTP smoke；历史后台浏览器操作 | **部分**：服务端写入和可见范围已测；原生输入/报告/屏蔽链未验收 |
| MV08 提醒与已读 | reminders投影测试、native-reminders模拟OS、native-inbox及实际HTTP已读/重启 | **部分**：真实系统通知权限和取消/送达缺证据 |
| MV09 弱网/空/键盘/字号 | 原生controllers断网/异常响应测试；页面对应状态实现；纠错输入保护已补代码和测试 | **未通过**：没有键盘、安全区、动态字体、VoiceOver和真实原生动效验收 |
| MV10 删除/分享/隔离 | product-auth/wall/governance/public-share/web及release guard用例 | **部分**：API/开发配置隔离有证据；iOS删除/分享实际行为未验收。无媒体上传，不能宣称媒体链已实现 |
| MV11 回归与保留失败 | 最新289测试/50文件；typecheck/export；历史失败记录保留 | **部分**：当前相关自动化通过；原生关键流程验证缺失，已记录依赖发布门槛仍未通过 |
| MV12 可复现交付包 | development-ios、implemented API目录、覆盖/限制、网页和Pen证据、此表 | **未通过**：缺原生截图/三条主流程录像或操作记录；不能保证无死路和全部反馈已验收 |

## 已确认的下一步

1. 校园纠错原有输入保护、未知结果重试和成功/刷新失败混淆已在代码修复；个人操作区已移出校巴的定时刷新/可见性条件。验证见 `evidence/campus-action-continuity/acceptance.md`。还需在手机上实际输入，等待一次轮询、切换标签、尝试返回和断网重试，才能验收挂载与触摸行为。
2. 完成获准的iOS运行路径后，执行下列三条链并留截图、系统/依赖版本、失败及修复记录。当前不重新安装Xcode，不把浏览器当原生替代。
3. 公开内测仍另需真实邮件配置、受控服务部署、组织者供给与治理责任、依赖发布门槛处理，以及独立的分发授权；本目标不自动批准它们。

## 手机端验收脚本（待运行，不是测试结果）

- 学习：测试账号A登录→手动创建课程/任务和有例外的ICS导入→今天/周切换→修改/完成→许可或拒绝提醒→核对旧提醒撤销→退出重登→保存数据仍在；键盘打开、放大字体、中英文、浅深色分别检查。
- 校园：访客选路线和方向→核对运行日/计划发车/来源→假期和过期数据→公开ETA断网停止更新→登录收藏→我的返回该内容→纠错取消/重试；确认条件未知时没有承诺车况。
- 社交：A发起活动→B报名或候补且自选保存日程→A改期/取消→B消息、参与、今天和系统提醒一致→B退出；再验校园墙/举报/屏蔽以及账号删除后的可见性。确认社交可跳过，私人课表未公开。

相关证据目录均在 `docs/progress/evidence/`；最新结果在 `campus-action-continuity/`，学习保存核对在 `native-study-save-confirmation/`，此前浏览器/mock证据在 `apple-ui/`、后台证据在各maintenance目录。所有“部分”都保留为未完成验收，不累计成整体通过。
