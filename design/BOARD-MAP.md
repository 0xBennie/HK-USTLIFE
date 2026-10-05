# Pen 画板 ↔ 原生页面对照

设计稿：`design/campus-apple.pen`，用 Pen 打开（文件加密，只能通过 Pen 或 Pen MCP 读写）。本表与 Pen 里的索引画板
「V6 / 画板索引（画板 ↔ 原生页面）」（`auiwc`）出自同一份数据，2026-10-05 与代码同批提交。

**规则**

1. 原生页面只按下表的画板实现；代码注释写画板名和 ID，例如 `Pen "V6 / 帖子详情" (kSIaN)`。
2. 名字带「旧稿 →」的画板已被取代，只作参考，不再据此开发（清单见文末）。
3. 下表没有的页面或状态：先在 Pen 画出来，再写代码。
4. 「版本」是该页面现在依据的画板版本。V6 以外的页面还没有 V6 稿，按所列旧版画板实现；这不代表已和画板逐像素核对。

原生文件路径相对 `apps/mobile/src/`，`App.tsx` 在 `apps/mobile/`。

## 页面对照

### 登录

| 页面 | 原生文件 | 画板 | 版本 |
| --- | --- | --- | --- |
| 学校邮箱登录（验证码） | `screens/AccountScreen.tsx` · LoginScreen、`App.tsx` · 登录门禁 | `Nlb7d` V6 / 登录入口（学校邮箱） | V6 |

### 今天

| 页面 | 原生文件 | 画板 | 版本 |
| --- | --- | --- | --- |
| 今天首页 | `study/TodayHome.tsx`、`study/DayRibbon.tsx` | `QWmzy` V4 / 今天 · 一日时间轴<br>`jV0eP` V2 / 今天 / 今日简报<br>`vmgSM` V2 / 今天 / 已登录未连接（真实能力） | V4 / V2 |
| 排队等着的提醒横幅 | `App.tsx` | `xZUzJ` V5 / 自动提醒（当前可用） | V5 |
| 本周课表、全部记录 | `study/StudyScreen.tsx`、`study/WeekGrid.tsx` | `QkyT2` V6 / 本周课表<br>`cYjzG` V6 / 全部记录（课表） | V6 |
| 添加截止与日程 | `study/StudyForm.tsx` | `Q5QFX` V3 / 添加截止（弹出面板） | V3 |
| 导入日历文件 | `study/ImportScreen.tsx` | `r1S0Aq` V6 / 导入日历文件 | V6 |
| 导入的日历 | `study/SourceScreen.tsx` | `V8htx3` V6 / 导入的日历 | V6 |
| 学校连接与学校记录 | `study/SchoolSourcesScreen.tsx` | `nAckt` V5 / 学校连接<br>`lTrEk` V5 / 学校连接 · 连接状态<br>`LfGB3` V6 / 学校记录（私人笔记与提醒） | V5 / V6 |
| 桌面小组件 | `widgets/TodayWidget.tsx` | `VPKlH` V3 / 桌面小组件 | V3 |

### 校园

| 页面 | 原生文件 | 画板 | 版本 |
| --- | --- | --- | --- |
| 校园首页（下一班、图书馆、常用） | `campus/CampusScreen.tsx`、`campus/DepartureBoard.tsx`、`campus/LibraryNow.tsx` | `nQ3Ls` V4 / 校园 · 发车看板<br>`gWkUE` V2 / 校园 / 我的下一班 | V4 / V2 |
| 校巴路线 | `campus/CampusScreen.tsx` | `n71ixQ` 13 / Shuttle route | V1 |
| 交通（从科大出发） | `campus/TransitHub.tsx` | `d6fkS7` V6 / 交通（从科大出发） | V6 |
| 公共交通与到站 | `campus/PublicTransitScreen.tsx` | `fpXlD` public-transit / 离开校园<br>`SMNyM` transit-detail / 到站预测 | V1 |
| 餐厅 | `campus/DiningScreen.tsx` | `pVLzF` V6 / 餐厅（现在营业） | V6 |
| 校园生活目录与地点 | `campus/DirectoryScreen.tsx` | `DzQxm` directory / 校园生活<br>`d7WFL` 14 / Place detail | V1 |
| 办事指南 | `affairs/AffairsScreen.tsx` | `WZaR0` V6 / 我的办事清单<br>`EOy54` V6 / 办事指南 · 详情<br>`NMWlS` V6 / 说明有更新（核对）<br>`pvPTj` V5 / 办事指南 | V6 |
| 学业、成绩、场地、空闲、社团、宿舍、校园服务 | `life/LifeScreens.tsx` | `ivz0E` V5 / 学业（真实数据）<br>`c1QOeO` V3 / 成绩分布<br>`acWzf` V5 / 预约场地（官方系统）<br>`Kphqs` V3 / 找共同空闲<br>`jYEm4` V3 / 社团<br>`R64Nw` V6 / 分类显示真实数量<br>`k2Old` V5 / 宿舍服务（未计时）<br>`rbykj` V5 / 宿舍服务（计时中）<br>`InJbr` V3 / 校园服务 | V3 / V5 |
| 二手、校招、同学名片、我的数据 API | `life/SocialExtras.tsx` | `N3tva` V3 / 二手市场<br>`BlIE0` V3 / 企业校招主页<br>`QOgeS` V3 / 同学名片<br>`O6b1L` V3 / 我的数据 API<br>`pD6xT` V5 / 交互 · 截止滑动与 AI 钥匙 | V3 / V5 |
| 交通 · 地图与路线、选择交通方式 | 未实现 | `wpfpa` V6 / 交通 · 地图与路线<br>`nk8OO` V6 / 交通 · 选择交通方式 | 已设计，未实现 |

### 校园墙

| 页面 | 原生文件 | 画板 | 版本 |
| --- | --- | --- | --- |
| 校园墙（标签页） | `social/CommunityScreen.tsx`、`social/WallScreen.tsx`、`social/wall-ui.tsx` | `ddOiF` V6 / 校园墙 | V6 |
| 帖子详情 | `social/WallDetail.tsx` | `kSIaN` V6 / 帖子详情 | V6 |
| 发帖 | `social/WallForm.tsx` | `M6vKMj` V6 / 发帖 | V6 |
| 全部活动 | `social/DiscoverScreen.tsx` | `H4f7id` V6 / 全部活动（按日期分组） | V6 |
| 活动筛选 | `social/ActivityFilterSheet.tsx` | `s99lg` V6 / 活动筛选（面板） | V6 |
| 科大官方活动 | `social/OfficialEvents.tsx` | `xKe4t` V6 / 科大官方活动<br>`z2v9N` V6 / 官方活动面板（App 内） | V6 |
| 活动详情与报名卡 | `social/ActivityDetail.tsx` | `Czib6` V6 / 活动详情（报名卡）<br>`BExSK` V6 / 报名卡 · 其他状态<br>`RyOui` V6 / 报名卡 · 发起人与其他状态<br>`X9umEe` V6 / 报名卡 · 候补与只加入日历<br>`dY9tt` V6 / 报名卡 · 本机能否提醒<br>`fEcT9` V6 / 退出确认（报名与候补） | V6 |
| 活动讨论 | `social/ActivityDetail.tsx` | `p59aZA` V6 / 活动讨论 | V6 |
| 确认报名 | `social/JoinActivitySheet.tsx` | `brKH6` V6 / 确认报名（面板） | V6 |
| 发起活动 | `social/ActivityForm.tsx` | `l8rkBv` V6 / 发起活动（一页表单）<br>`IlP6B` V6 / 发起活动 · 选项展开与提示 | V6 |
| 再次同行 | `social/ReconnectionScreen.tsx` | `pdYON` V6 / 再次同行 | V6 |
| 联系方式 | `social/ContactCardScreen.tsx` | `P3c5M` V6 / 联系方式 | V6 |
| 举报或屏蔽 | `social/SafetyActions.tsx` | `dsJS2` V6 / 举报或屏蔽（面板） | V6 |

### 消息

| 页面 | 原生文件 | 画板 | 版本 |
| --- | --- | --- | --- |
| 消息 | `social/InboxScreen.tsx` | `dqbRa` V3 / 消息<br>`DDS0O` V3 / 消息 · 未读与已读 | V3 |

### 我的

| 页面 | 原生文件 | 画板 | 版本 |
| --- | --- | --- | --- |
| 我的首页 | `screens/AccountScreen.tsx` · ProfileScreen | `OsfrE` V3 / 我的 | V3 |
| 你的校园名片 | `screens/AccountScreen.tsx` | `r3fvkB` V6 / 你的校园名片 | V6 |
| 我的收藏与活动 | `screens/AccountScreen.tsx` | `UemvP` V6 / 我的收藏（活动、地点与路线） | V6 |
| 语言 | `screens/AccountScreen.tsx` | `biMye` V6 / 语言（系统菜单） | V6 |
| 提醒设置 | `reminders/ReminderControls.tsx` · ReminderSettings | `xZUzJ` V5 / 自动提醒（当前可用） | V5 |
| 隐私与安全 | `social/GovernanceScreen.tsx` | `ctYQS` V6 / 隐私与安全（举报与屏蔽） | V6 |

### 通用

| 页面 | 原生文件 | 画板 | 版本 |
| --- | --- | --- | --- |
| 离开确认 | `navigation/InputProtection.tsx` | `hFxMD` V6 / 离开确认（系统弹窗） | V6 |
| 底部面板 | `ui/BottomSheet.tsx` | `brKH6` V6 / 确认报名（面板）<br>`TBMCw` V6 / 底部面板 · 拖动与减少动态（交互说明） | V6 |
| 组件与标签栏 | `ui/Pen.tsx`、`App.tsx` | `k34MbX` V5 LIQUID GLASS · 设计系统<br>`NvpXX` V3 GLASS · 设计系统与组件<br>`C2KuRh` Component / Tab bar（图标） | V5 / V3 |

## 本轮新增画板（2026-10-05）

| ID | 画板 | 画了什么 |
| --- | --- | --- |
| `X9umEe` | V6 / 报名卡 · 候补与只加入日历 | 候补中（已加日历与提醒 / 还没加）；未报名只加入日历（还有名额或已满）；暂停报名但已加入日历 |
| `dY9tt` | V6 / 报名卡 · 本机能否提醒 | 已设提醒时：本机提醒没开、系统通知被关、同步没完成（各带一个处理动作），以及恢复后提示消失 |
| `fEcT9` | V6 / 退出确认（报名与候补） | 退出报名与退出候补两种系统弹窗，候补写明会失去候补位置 |
| `TBMCw` | V6 / 底部面板 · 拖动与减少动态（交互说明） | 打开、跟手、松手未到关闭距离、关闭、手势被打断、键盘，标准与「减少动态」两列 |
| `auiwc` | V6 / 画板索引（画板 ↔ 原生页面） | 本表的 Pen 版 |

## 已被取代的旧稿

这些画板在 Pen 里已改名，名字末尾带「（旧稿 → 用 …）」。

| 旧画板 | 原名 | 改用 |
| --- | --- | --- |
| `HOhBe` | V3 / 帖子详情 | `kSIaN` V6 / 帖子详情 |
| `j2X69` | 16 / Wall post | `kSIaN` V6 / 帖子详情 |
| `nVjon` | V3 / 校园墙 | `ddOiF` V6 / 校园墙 |
| `oSpb6` | 15 / Campus wall | `ddOiF` V6 / 校园墙 |
| `jve7S` | V3 / 发帖 | `M6vKMj` V6 / 发帖 |
| `XiMkD` | wall-compose / 有什么想分享？ | `M6vKMj` V6 / 发帖 |
| `gr33p` | V5 / 登录入口（学校邮箱） | `Nlb7d` V6 / 登录入口（学校邮箱） |
| `KVyBB` | V5 / 本周课表 | `QkyT2` V6 / 本周课表 |
| `uwRFc` | week / 本周课表 | `QkyT2` V6 / 本周课表 |
| `NOkeI` | V3 / 活动详情 | `Czib6` V6 / 活动详情（报名卡） |
| `lAQTw` | 02 / Activity details / Light | `Czib6` V6 / 活动详情（报名卡） |
| `zrHOJ` | 04 / Confirmed / Light | `Czib6` V6 / 活动详情（报名卡） |
| `AGbbT` | 07 / Activity details / Dark | `Czib6` V6 / 活动详情（报名卡） |
| `v69Dn` | 05 / Waitlisted / Light | `X9umEe` V6 / 报名卡 · 候补与只加入日历 |
| `oiYrF` | 03 / Join review / Light | `brKH6` V6 / 确认报名（面板） |
| `CIoM7` | withdraw / 这次先不参加了？ | `fEcT9` V6 / 退出确认（报名与候补） |
| `UyFsc` | activity-chat / 活动讨论 | `p59aZA` V6 / 活动讨论 |
| `zMWmp` | create-activity / 一起做点小事 | `l8rkBv` V6 / 发起活动（一页表单） |
| `M24zBk` | V3 / 发现 | `H4f7id` V6 / 全部活动（按日期分组） |
| `MjoHv` | 01 / Discover / Light | `H4f7id` V6 / 全部活动（按日期分组） |
| `D3Jdk` | Reconnection / 私下说一声 | `pdYON` V6 / 再次同行 |
| `PSjRA` | Reconnection / 已保存你的意愿 | `pdYON` V6 / 再次同行 |
| `oKBe2` | Reconnection / 双方都愿意 | `pdYON` V6 / 再次同行 |
| `Y1V0gg` | X04 / Contact card / Share preview | `P3c5M` V6 / 联系方式 |
| `Ee7DV` | X04 / Contact card / Shared | `P3c5M` V6 / 联系方式 |
| `whbTA` | X04 / Contact card / Uncertain | `P3c5M` V6 / 联系方式 |
| `wLxKM` | X04 / Contact card / Report and block | `P3c5M` V6 / 联系方式 |
| `K43Sjn` | account-profile / 你的校园名片 | `r3fvkB` V6 / 你的校园名片 |
| `xD7W4` | 19 / Joined and saved | `UemvP` V6 / 我的收藏（活动、地点与路线） |
| `gXcxl` | School management / 我的学校记录 | `LfGB3` V6 / 学校记录（私人笔记与提醒） |
| `B7wsR` | 18 / My account | `OsfrE` V3 / 我的 |
| `kpogc` | language / 语言 | `biMye` V6 / 语言（系统菜单） |
| `t1Arsk` | 17 / Inbox | `dqbRa` V3 / 消息 |
| `OtBqH` | reminders / 提醒，刚刚好 | `xZUzJ` V5 / 自动提醒（当前可用） |
| `qOuXf` | 06 / Uncertain result / Light | `RyOui` V6 / 报名卡 · 发起人与其他状态 |

另有两张早已标为「已废弃」的画板，名字现在也指向 V6 登录：`DCTVp` welcome、`TCURr` V2 / 今天 / 第一次使用（访客模式已取消）。

## 资源

- 画板里唯一的本地图片：`design/assets/map-hkust.png`（3 处引用，已入库）。其余图片填充是 Unsplash 远程地址，不需要入库。
- `design/school-sync/*.png` 是学校连接相关画板的导出图，说明见同目录 README。README 写明 `g6IET` / `g8DPsq` / `jMZip` 是作废的草稿导出，不入库。

## 版本

- Pen 文件 SHA-256：`3bc338bf8d3935eb643e21f9a6d5925f44c76f9c679dc119d4bf7cdebf669166`
- 恢复来源：Codex 归档前的快照 `refs/codex/snapshots/ef9e71a…` → 提交 `eba6af1`，该版 SHA-256 为 `54576229…11f2`（PMO 记录的 12:21 工作稿），本轮在其上增改。
