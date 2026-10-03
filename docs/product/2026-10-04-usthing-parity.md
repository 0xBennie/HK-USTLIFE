# USThing 功能对标与 Campus 超越方案

日期：2026-10-04 · 状态：调研稿，待产品确认 · 范围：只读调研，未改动代码

> 标注约定：**[已核实]** 有公开来源；**[截图]** 仅来自用户提供的 USThing 截图，未找到公开文字佐证；**[推断]** 根据公开信息推测，未经抓包或官方确认；**[未核实]** 未找到任何来源。

---

## 0. 结论速览

1. USThing 的核心价值是**用学生的 ITSC 账号替学生登录学校系统**（SIS、FBS 预约、图书馆房间），把课表、成绩、候补、考试、预约集中在一处。我们目前在这一层**完全没有真实数据**：`src/product/school/sync.ts` 明确写着「No network adapter is shipped」，学业类功能全部缺失。
2. USThing 已在 2026-09 的 7.23.1 版加入个人主页、好友和私信，社交上开始与我们正面重叠；但它的社交是「名录 + 聊天」，没有我们的报名/候补/改期/双向同意等完整活动生命周期。
3. 我们相对 USThing 的结构性机会是**主动推送**：USThing 只有「下一节课通知」一种推送 [已核实]，其余都要学生自己点开查。我们把「查询」变成「变化发生时通知」，这是最大的超越点。
4. USThing 网页端（app.usthing.xyz）有选课排课器、毕业进度、学期规划、成绩计算器四个规划工具 [已核实]，我们只有 PRD 里的 L07/X06 规划，没有实现。

---

## 1. USThing 产品事实

| 项 | 内容 | 来源 |
|---|---|---|
| 运营方 | 学生团队，2014 年由 Zachary Lo 创立，2016 年成为 Prof. Kar Yan Tam 的学术项目；非 ITSO 官方产品 | [About us](https://www.usthing.xyz/about-us) |
| 当前版本 | iOS 7.23.1，2026-09-28 发布；最低 iOS 16.4；约 66 MB | [iTunes Lookup API](https://itunes.apple.com/lookup?id=965883733&country=hk) |
| 评分 | 香港区 3.68 / 151 条评分 | 同上 |
| 7.23.1 更新说明 | 个人主页与分享、加好友、私信；成绩分布（课程洞察、分学期）；校园服务搜索和交通筛选改进 | 同上 |
| 官方描述的功能 | FBS 与图书馆房间预约；成绩、课表、候补位置；下一节课通知；TimeMatch；校园信息与目录；新闻活动 | [App Store](https://apps.apple.com/app/id965883733) |
| 登录方式 | 需要 ITSO 账号密码，凭证「仅本机加密保存，不上传服务器」；用户截图显示有 Duo 2FA [截图] | App Store 描述 |
| 技术栈 | 新版 App 为 Expo/React Native（私有仓库 USThing/USThingApp，由 USThingAppBuilder 打包）；后端模板 Fastify + TypeScript + MongoDB [推断：模板仓库不等于生产后端] | [USThingAppBuilder](https://github.com/USThing/USThingAppBuilder)、[template-api](https://github.com/USThing/template-api)、[26-template-api](https://github.com/USThing/26-template-api) |
| SIS 抓取 | 2019 年实验项目 Excalibur：无头 Chromium 登录 SIS，scopes 为 grades / program_info / schedule，exams 未完成；记录 CAS Cookie 会话结束即失效、2FA「记住我」无法勾选 | [elise-ng/excalibur](https://github.com/elise-ng/excalibur) |
| 网页端 | app.usthing.xyz，2025 年上线：Timetable Planner、Graduation Tracker、Semester Planner、Grade Calculator；登录走 usthing.xyz/auth/signin | [Dashboard](https://app.usthing.xyz/)、[官网](https://www.usthing.xyz/) |
| 公开文档 | docs.usthing.xyz（目前只写了 Timetable Planner） | [USThing/docs](https://github.com/USThing/docs) |
| 用户主要抱怨 | 登录失败/认证错误（多条）、学术页卡死、通知仍提醒上学期课程、GPA 目标估算被移除、横屏不支持 | [App Store 评论 RSS](https://itunes.apple.com/hk/rss/customerreviews/id=965883733/sortBy=mostRecent/json) |

用户截图中「Grade Distribution 可搜 2231 门课」「Week 5/16」等具体数字未在公开资料中找到，标为 [截图]。Reddit、LIHKG 未检索到有效讨论 [未核实]。

---

## 2. 功能逐项对标

状态：**已有** = 本仓库有真实实现；**部分** = 有相近能力或仅框架/入口；**缺失** = 无实现。
我们的现状依据：`docs/PRD.md`、`docs/product/feature-register.csv`、`src/product` 的 API 路由（74 条显式注册 + study 模板生成 10 条，见附录 A）。

### 2.1 学业（USThing 最强的一块）

| USThing 功能 | 对学生的作用 | 可能的数据来源 / 接入方式 | 我们的状态 | 我们的更好版本（主动推送优先） | 优先级 | 归属 Tab |
|---|---|---|---|---|---|---|
| 首页问候 + 下一节课卡（课号、课室、时间）[截图] | 打开就知道下节课去哪 | SIS 课表（抓取）[推断] | 部分：`/api/v1/me/calendar` 汇总 ICS/手动日程，无 SIS 数据 | 下一节课前 N 分钟推送「COMP 2011 · 4619 室 · 走 31/32 号电梯约 4 分钟」，含 Path Advisor 路线；若课室变更或取消，单独推送变化 | P0 | 今天 |
| 下一节课通知 [已核实] | 不错过上课 | 本地通知 + SIS 课表 | 部分：移动端有本地提醒（`apps/mobile/src/reminders/device.ts`、`/api/v1/me/reminders`），无课表来源 | 学期切换时自动清理旧学期提醒（USThing 被投诉仍提醒上学期课）；支持按课程关闭 | P0 | 今天 |
| 周课表 Mon–Fri 色块、Today 按钮 [截图] | 看一周课 | SIS schedule scope [已核实：Excalibur] | 部分：ICS 导入/预览/确认/去重（`/api/v1/calendar/imports/*`），学校记录框架 `/api/v1/school/records` 无适配器 | 课表 + Canvas 截止 + 活动同一时间线；调课/取消推送 | P0 | 今天 |
| My Grades（含 MCGA 荣誉等级趋势）[已核实：评论] | 查成绩和 GPA 走势 | SIS grades scope [已核实：Excalibur] | 缺失（L10 规划 R2） | **成绩出分即推送**（只推「COMP 2011 已出分」，分数需 Face ID 后查看）；学期 GPA 与荣誉线差距 | P0 | 我的（推送到消息） |
| My Exams [已核实：官网] | 查考试时间地点 | SIS 考试安排 [推断] | 缺失 | **考试时间表发布即推送**；自动写入日历、考前 7 天/1 天提醒、考场路线；同日两考冲突提示 | P0 | 今天 |
| My Waitlists（候补位置）[已核实] | 知道候补排第几 | SIS 选课/候补页 [推断] | 缺失 | **候补名次变化推送**（「COMP 3511 候补从 5 → 2」），选课截止前提醒处理 | P0 | 消息 |
| 学期进度 Week 5/16 [截图] | 知道学期过了多少 | 学年日历 | 缺失（学年日历在 PRD 来源清单中，未接） | 今天页显示教学周；考试周/假期前推送 | P2 | 今天 |
| Grade Calculator（App + 网页）[已核实] | 模拟成绩对 GPA 的影响 | 本人成绩 + 本地计算 | 缺失 | 预填本人已出分课程，计算「要达到目标 GPA 剩余课程平均需几分」 | P1 | 我的 |
| GPA 目标 / 估算器 [已核实：评论称已被移除] | 设目标 | 本地计算 | 缺失 | 恢复 USThing 删掉的功能，作为成绩计算器的一部分 | P2 | 我的 |
| Grade Distribution（搜课、%A、样本量、隐藏 <10、只看我的课、按学科）[截图；7.23.1 已核实存在] | 选课时看给分 | **未知**：学校无公开逐课分布 [未核实]；可能来自用户匿名上报的成绩聚合 [推断] | 缺失 | 若来源为用户上报，我们需本人同意 + 最低样本门槛；与选课排课器联动 | P1 | 发现（选课区）|
| Timetable Planner（网页：搜课、Boolean/时段过滤、冲突标红、TBA、导入已选课、多方案、撤销）[已核实] | 选课前排课不冲突 | 课程目录与班别（公开 class schedule）+ SIS 已选课 | 缺失（L07 R1 辅助、X06 R2） | 在手机端做；**选课期内名额/候补变化推送**；选课开放时间提醒 | P1 | 发现 |
| Course Ratings 扩展（UST.space 内容/教学/给分/负担评分）[已核实] | 选课参考评价 | UST.space（社区插件，需登录 UST.space）| 缺失（L05 课程经验 R2） | 我们的课程经验自建，按学期和来源标注；不抓取 UST.space | P2 | 发现 |
| Graduation Tracker [已核实] | 看毕业还差哪些要求 | SIS program_info [已核实：Excalibur] + 课程要求规则 | 缺失 | 每学期结束推送「还差 X 学分 / 某 Common Core 区」 | P1 | 我的 |
| Semester Planner（拖拽排学期）[已核实] | 长期选课规划 | 用户输入 + 课程目录 | 缺失 | 与毕业进度、排课器打通 | P2 | 我的 |
| Common Core 课程搜索 [已核实：排课器 CC22:SA 等] | 找满足通识区的课 | 课程目录 + CC 区规则 | 缺失 | 合并到排课器筛选 | P2 | 发现 |
| TimeMatch（建/加入二维码，找共同空闲）[已核实] | 小组找时间开会 | 各成员课表 | 部分：G01 规划「本人授权空闲计算」，未实现；活动系统已有 | 只共享选中时段（PRD 原则 5）；**找到共同空闲后一键建活动**并推送给组员，接入现有报名/改期 | P1 | 发现 |

### 2.2 校园生活

| USThing 功能 | 对学生的作用 | 可能的数据来源 / 接入方式 | 我们的状态 | 我们的更好版本 | 优先级 | 归属 Tab |
|---|---|---|---|---|---|---|
| Booking：图书馆房间 + FBS 设施（羽毛球等）；收藏、地点、时间滑块、按类别搜索 [已核实] | 手机上订自习室/球场 | FBS 与图书馆系统，现已统一入口 booking.ust.hk [已核实]，用学生账号代操作 [推断] | 部分：C04 只有规则/官方入口；目录里 IC、LC 两个自习点 | **收藏时段有空位即推送**（「明晚 8–10 点 LG1 羽毛球场空出」）；预约前 1 小时提醒；与课表空档联动推荐 | P0 | 校园 |
| Campus Services 搜索（图书馆、交通、超市、诊所、纪念品店、饮水机、银行、理发、充电宝…）[已核实：7.23.1 改进] | 找设施和营业时间 | 人工整理 + 学校公开页 | 部分：9 条核验地点（邮务、EF 柜、Fusion、两家 7-Eleven、证件照机、零钱机、IC、LC），带来源哈希和复核期 | 覆盖扩到 50+；每条保留来源和复核时间（USThing 未见来源标注）；营业时间临近关闭提醒 | P0 | 校园 |
| Transport：往返 HKUST，Shuttle/Bus/Minibus 筛选、紧凑视图、隐藏无信息、起点、目的地（Hang Hau 等）、收藏 [截图；7.23.1 已核实] | 回家坐什么车 | 校巴时刻表 + 政府开放数据 KMB/GMB ETA [推断] | **已有**：校巴 14+ 条路线计划班次与假期（`/api/v1/transport/routes/*`）、KMB 与 GMB 路线/站点/ETA（`/api/v1/transport/public/*`） | 「我的下一班」按当前位置与下课时间主动推送；末班车前 15 分钟提醒；Citybus/MTR 待补 | P0 | 校园 |
| Path Advisor [截图] | 找课室 | 学校 pathadvisor.ust.hk [已核实] | 部分：目录条目带 Path Advisor 链接 | 课程、考试、活动地点自动带路线；输入房号直达 | P1 | 校园 |
| Hall Services：Hall waitlist、洗衣、空调 [截图] | 宿舍事务 | 洗衣 laundry.ust.hk 与空调 w5.ab.ust.hk/njggt 官方面板 [已核实]；Hall waitlist 来源 [未核实] | 缺失（C05 R1 只有指南/入口） | **洗衣完成推送**、空调余额不足推送、宿舍候补名次变化推送（均需确认面板是否有可读状态）| P1 | 校园 |
| Hall/Room Swapping [截图] | 找人换宿舍房间 | 用户发布 [推断] | 部分：校园墙有发帖/回复/举报，无专门类型 | 结构化交换帖（楼栋/房型/期望），匹配到对方即推送；双方同意后才交换联系方式 | P2 | 发现 |
| MarketPlace [截图] | 二手买卖 | 用户发布 [推断] | 部分：校园墙 S01 含二手类型（文字），无图片 | 关注的品类有新物品推送；毕业季交接（X09）| P2 | 发现 |
| Clubs & Associations（搜索、标签、logo、简介）[截图] | 找社团 | 人工整理 / 社团提交 [推断] | 部分：C06 核验目录规划；活动系统已有 | 社团主页直接挂真实的下一场活动，关注后有新活动推送 | P1 | 发现 |
| News & Events [已核实] | 看校园活动新闻 | 学校公告/RSS + 用户上传（「All contents are freely uploaded by our users」）| 部分：活动列表/报名/候补/评论（`/api/v1/activities/*`）| 只推和我相关的（我关注的社团、我能参加的时段）；报名/候补/改期全生命周期 | P1 | 发现 |
| Career / job board [用户提供，未核实] | 找实习 | 学校 CDC 或用户发布 [未核实] | 缺失（C06、X10 规划 R2） | 截止前提醒 + 准备清单 | P2 | 发现 |
| 校园目录（Directory）[已核实] | 查部门/联系方式 | 学校公开目录 | 部分：C09 规划；`/api/v1/campus/places` 仅地点 | 部门与教师目录，研究方向检索 | P2 | 校园 |

### 2.3 社交、账户与系统

| USThing 功能 | 对学生的作用 | 可能的数据来源 / 接入方式 | 我们的状态 | 我们的更好版本 | 优先级 | 归属 Tab |
|---|---|---|---|---|---|---|
| Chat / 私信、好友、个人主页分享（7.23.1）[已核实] | 和同学联系 | USThing 自有后端 | 部分：活动评论、站内通知、活动后「再次同行」双向同意（`/api/v1/me/reconnections`）；无私信 | 双方同意后才开会话；陌生请求箱；屏蔽/举报已具备（`/api/v1/me/blocks`、`/api/v1/reports`）| P1 | 消息 |
| Edit Home（自定义首页）[用户提供] | 把常用功能放前面 | 本地设置 | 缺失 | 今天页按时段自动排序（早上课程、傍晚交通），可手动固定 | P2 | 今天 |
| Settings [用户提供] | 偏好 | 本地 | 部分：资料、导出、删除（`/api/v1/me`、`/api/v1/me/export`）| 通知分类开关（学业/活动/互动）、静默时段 | P1 | 我的 |
| ITSC 登录 + Duo，凭证本机加密 [已核实；Duo 为截图] | 一次登录拿到全部数据 | 学校 SSO（2022 起并入 Microsoft 登录）| 部分：只有开发用邮箱登录；school_sso 状态为 `approval_required`；v2 评审已决定采用「App 内官方登录页 + 本机会话」 | 我们不经手密码（USThing 要输入密码）；会话过期提前提示重登，避免 USThing 评论里大量「认证失败」 | P0 | 我的 |
| 远程推送 | 主动通知 | APNs | 缺失：`/api/v1/auth/methods` 返回 `remote_push: not_configured`；只有本地通知 | 所有「变化推送」的前提，见第 4 节 | P0 | 消息 |
| 网页端 Dashboard | 电脑上规划 | 同账号 | 部分：`apps/hub` 为官网/分享，不含个人工具 | 选课季提供网页版排课器 | P2 | — |

---

## 3. 超越 USThing 的地方

### 3.1 从「我去查」到「变化来找我」

USThing 唯一确认的推送是下一节课。下面这些都是学生今天需要反复打开 USThing 或学校网页才能发现的变化，我们改为事件驱动推送，统一进入「消息」Tab 并可在锁屏查看：

| 事件 | 推送示例 | 检测方式 | 依赖 |
|---|---|---|---|
| 成绩发布 | 「COMP 2011 成绩已发布」（不在锁屏显示分数）| 定期比对 SIS 成绩页 | SIS 会话 |
| 考试时间表发布/变动 | 「期末考试时间表已出：3 科，12/9 有两场」| 比对 SIS 考试页 | SIS 会话 |
| 候补名次变化 | 「COMP 3511 候补 5 → 2」| 比对选课/候补页 | SIS 会话 |
| 收藏的预约时段空出 | 「周四 20:00 LG1 羽毛球场有空位」| 轮询 booking.ust.hk 可用性 | 学生会话；轮询频率需控制 |
| 洗衣完成 / 空调余额低 | 「3 号洗衣机已完成」| 洗衣/空调面板 | 需确认面板是否提供机器状态 |
| 宿舍候补变化 | 「Hall 候补前进 3 位」| 来源未核实 | 待调查 |
| 课室变更/停课 | 「明天 MATH 1013 改到 LTA」| 比对课表 | SIS 会话 |
| 活动改期/候补转正 | 已实现站内通知（`/api/v1/me/notifications`）| 自有数据 | 远程推送 |
| 末班车 | 「去坑口末班校巴还有 15 分钟」| 计划班次 + 位置 | 已有数据 |

原则：推送只给「变化 + 下一步」，可按类别关闭，学期切换自动清理旧学期提醒（USThing 被投诉的问题）。

### 3.2 其它结构性优势

1. **不经手密码**：学生在学校官方登录页登录，会话只留本机；USThing 需要学生把 ITSO 密码交给 App。
2. **来源可核对**：每条校园信息带来源链接、取得时间、复核期（已在目录数据中实现），USThing 未见此类标注。
3. **截止为中心**：Canvas 作业截止进入今天页（USThing 未见 Canvas 集成 [未核实]），截止 → 找人一起做 → 建活动。
4. **社交有完整生命周期**：报名、候补、确认期限、改期通知、再次同行双向同意、举报/屏蔽/申诉，均已有后端；USThing 7.23.1 只是刚加入好友和私信。
5. **TimeMatch 闭环**：找到共同空闲后直接生成活动并管理出席，而非只显示空档。
6. **AI 层（R4）**：基于本人课表和截止生成每日简报、考试复习排程；只读已授权数据并给出出处。

---

## 4. 需要的数据接入与风险

| 数据 | 支撑功能 | 接入方式 | 风险 | 缓解 |
|---|---|---|---|---|
| SIS（课表、成绩、考试、候补、学籍）| 2.1 大部分 P0 | 设备端会话解析页面（v2 评审已决定）；长期争取 ITSO 正式接口 | 页面改版导致解析失效；学校 IT 使用政策；会话频繁过期（Excalibur 已记录）；USThing 评论显示登录失败是最大痛点 | 解析规则可热更新；失败时明确显示「未同步」而非空数据；监控解析成功率 |
| booking.ust.hk（FBS + 图书馆房间）| 预约、空位推送 | 学生会话代操作 [推断 USThing 同样做法] | 轮询过频可能被视为滥用；代下单属写操作，需逐次确认 | 只在本人收藏时段低频检查；下单前预览确认 |
| 洗衣 laundry.ust.hk / 空调 w5.ab.ust.hk | 洗衣完成、余额推送 | 宿生登录官方面板 | 未知面板是否暴露机器状态；涉及付款 | 先只读；付款跳官方 |
| Hall waitlist | 宿舍候补推送 | [未核实] | 来源不明 | 先调研 SHRL 页面 |
| 成绩分布 | 选课参考 | 学校无公开逐课分布 [未核实]；若自建需用户匿名上报 | 隐私与样本偏差；学校可能不认可 | 本人明确同意、样本门槛（≥10）、只显示区间 |
| 课程目录与班别 | 排课器、TimeMatch | 学校公开 class schedule 页 [推断] | 结构变化 | 每学期复核 |
| Canvas | 截止 | 同一 SSO 会话调用 Canvas 接口 | 同 SIS | 同上 |
| 远程推送（APNs）| 第 3 节全部 | 需 Apple 开发者账号与推送证书；当前 `not_configured` | 推送由服务器发出，但变化检测在设备端完成时需要后台刷新 | 设备端检测 + 本地通知为第一步；服务器只接收结构化变化，不接收会话 |
| KMB / GMB | 交通 | 政府开放数据（已接）| 低 | 已实现 |
| 用户内容（交换房、二手、社团）| 2.2 社交类 | 用户发布 | 治理负担；交易纠纷 | 已有举报/屏蔽；不做平台内支付 |

**整体风险**：USThing 用同样的抓取方式运营多年，但评论中「登录失败」「学术页卡死」反复出现，说明这条路的稳定性是持续运维问题，不是一次性开发。我们的 P0 依赖全部压在 SIS 会话上，应把解析健康度当作上线指标。

---

## 附录 A：本仓库已实现 API（`src/product`，74 条显式 + 10 条 study 模板）

- 账户：`/api/v1/auth/methods`、`auth/email/challenges`、`auth/email/verify`、`auth/logout`、`/api/v1/me`（含删除）、`me/export`
- 学习：`/api/v1/study/courses`、`study/items`（增删改查）；日历 `calendar/imports/preview`、`imports/:id`、`imports/:id/confirm`、`calendar/sources`、`calendar/series/:id/occurrence(/status)`、`me/calendar`、`me/reminders`
- 学校：`school/connections`、`school/connections/:provider`（删除）、`school/records`、`school/records/:id`、`school/records/:id/personal`（无网络适配器）
- 校园：`campus/places`、`campus/places/:id`、`campus/corrections`、`me/campus/bookmarks`、`me/campus/corrections`；交通 `transport/routes`、`transport/routes/:id/departures`、`transport/public/routes`、`transport/public/routes/:id/stops`、`transport/public/routes/:id/arrivals`
- 事务：`affairs/templates`、`affairs/templates/:id`、`me/affairs`、`me/affairs/:id`、`me/affairs/:id/accept-revision`（来源登记状态为 `planning_sources_only_not_live_templates`）
- 活动：`activities`、`activities/:id`、`join`、`withdraw`、`cancel`、`comments`、`participants`、`preferences`、`reconnections/:target`、`contact-card`；`me/reconnections`
- 校园墙与治理：`posts`、`posts/:id`、`posts/:id/replies`、`reports`、`me/reports`、`me/blocks`、`me/notifications`、`me/notifications/:nid/read`
- 后台：`admin/status`、`admin/activities*`、`admin/campus/*`（地点、纠错、校巴、假期、来源检查、历史）、`admin/reports*`

## 附录 B：来源

- USThing 官网：https://www.usthing.xyz/ ；About：https://www.usthing.xyz/about-us
- USThing Dashboard：https://app.usthing.xyz/
- App Store 页面：https://apps.apple.com/app/id965883733
- iTunes Lookup（版本、更新说明、评分）：https://itunes.apple.com/lookup?id=965883733&country=hk
- App Store 评论 RSS：https://itunes.apple.com/hk/rss/customerreviews/id=965883733/sortBy=mostRecent/json
- USThing GitHub 组织：https://github.com/USThing （docs、USThingAppBuilder、template-api、26-template-api）
- Timetable Planner 文档：https://github.com/USThing/docs/tree/main/docs/dashboard/timetable-planner
- Excalibur SIS 抓取器：https://github.com/elise-ng/excalibur
- AppGoblin（首发 2015-04-04；其装机/活跃估算明显偏低，不采用）：https://appgoblin.info/apps/965883733
- HKUST 宿舍空调与洗衣系统：https://shrl.hkust.edu.hk/residential-halls/hall-life/hall-ac-and-laundry-service
- booking.ust.hk 统一预约入口公告：https://my-ai.hkust.edu.hk/node/3306
- Path Advisor：https://itso.hkust.edu.hk/node/113
- 官方 HKUST Student App 功能（对照：SIS 资料、电子学生证、选课、考试、成绩、财务、打印额度、设施预约、洗衣信息、交通）：https://studentapp.hkust.edu.hk/functions
- UST.space：https://ust.space/
