# Super App 数据需求与 API 接入可行性

核查日期：2026-10-02（UTC+8）。依据产品总体设计 v1.1。完成公开资料、当前代码与部分公开接口的只读核查；没有连接学生私人账户、申请权限、购买服务或实现新功能。

## 1. 结论和证据分级

首版可以用官方公开数据、本人导入和组织者主动提供的数据，形成学习安排、校园生活及社交活动的完整基础流程。正式选课/考试、完整 Canvas 作业与资料、个人设施预约等深度能力仍依赖校方批准。API 存在、能够调用、允许产品使用、已经接入并稳定运行，是不同状态。

本报告使用以下标记：

- **实测**：本轮无凭证读取成功，检查了内容格式或相关字段；不代表全量覆盖或长期可靠性。
- **文档确认**：官方说明了接口、导出或接入方式，尚未用用户凭证完成产品联调。
- **网页来源**：能查到官方资料或办理入口，未确认可供本产品使用的结构化 API。
- **机构/合作接入**：需要数据拥有者和相应机构批准，接口及字段仍待确认。
- **平台自产**：通过用户、组织者或平台运营在本产品中建立，不依赖外部 API。

本轮公开读取的可复核摘要见 [检查记录](2026-10-02-super-app-public-data-checks.json)。证据分布在各节官方链接中；接口与政策可能变化，实施前需复核。

## 2. 平台提前准备什么，用户什么时候提供什么

| 时点 | 必要数据 | 获取方式 | 暂不需要 |
| --- | --- | --- | --- |
| 首位用户到来前 | 学校/校区、学期、地点、核心服务、交通来源、办理入口、来源更新时间 | 官方来源登记、获准公开接口、人工核验 | 全校学生名单、所有人的课表和联系方式 |
| 首轮活动开放前 | 真实组织者、具体活动、地点/入场条件、语言/费用、容量、接应及取消方案 | 组织者直接提交，平台核验准备情况 | 假活动、复制外站报名人数、未经授权的嘉宾名单 |
| 访客浏览 | 当前查询条件，可临时选择学校/地区/语言 | 用户选择；可先不建账户 | 邮箱、课表、定位、通讯录 |
| 用户保存个人内容 | 平台账户 ID、登录凭据所需的最少资料、显示名和个人设置 | 自有账户体系；学校 SSO 是可选机构连接 | 真实姓名、学号、院系并非所有功能的必填项 |
| 用户使用学习安排 | 本人选择的课程、事件、截止、来源链接、材料与笔记 | 手动输入、ICS 文件；后续获准 OAuth/API | 全量邮箱、成绩、所有云盘文件 |
| 用户访问校内成员内容 | 资格类型、验证方式、有效期和范围 | 经核验的试点名单或获准学校身份服务 | 仅凭自填学校或邮箱后缀推定在籍 |
| 用户找活动/同伴 | 自选时间窗口、地区、语言、预算、经验/角色与投入要求 | 主动选择、明确发布范围 | 私人全课表、实时人员位置、MBTI 或通讯录 |
| 用户报名或组织 | 对应活动的参与状态、必要联系方式/条件回答、名额和变更 | 自有报名系统或明确授权的外部主系统 | 把一次报名自动转成营销订阅 |
| 运行后 | 核心行为、来源错误、取消/出席未知状态、自愿反馈和运维成本 | 本平台最小化记录 | 从其他 App 批量导入社交关系或聊天历史 |

社交所需的兴趣、语言和时间等信息应按用途逐步询问，不把第一次打开变成完整个人资料调查。学校资格、使用偏好、内容可见范围独立记录。

## 3. 校园与学习数据清单

| 数据 | 最少字段与用途 | 官方来源/获取方式 | 当前结论和首版做法 |
| --- | --- | --- | --- |
| 学年、注册和考试时段 | 学校/校区、日期、名称、适用学制、来源版本 | University Calendar 的学年 ICS；ARO 的相关规则 | **实测**学年 ICS；它不包含个人课表和个人考试座位 |
| 课程目录 | 课程码、名称、学分、先修、描述、学制/学期 | [ARO Course Catalog](https://registry.hkust.edu.hk/resource-library/course-catalog) | **网页来源**；结构化读取需确认使用方式，公共目录不证明学生选修 |
| 开课、班别和额度 | 学期、班别、时间、地点、教师、配额/候补字段及数据时间 | [Class Schedule & Quota](https://w5.ab.ust.hk/wcq/cgi-bin/) | **实测网页**；未确认正式开放 JSON API，不能按自己抓取时间冒充源数据刷新时间 |
| 本人规划课表 | 标题、时间、结束、地点、重复/例外、源 UID | [Timetable Planner 官方说明](https://registry.hkust.edu.hk/resource-library/course-offering-and-class-schedule-ug)支持导出 iCalendar | **文档确认**；首版用户自行导出/导入。已核实说明属于 UG，不自动推定全部 PG 适用；规划、候补与正式选修分别标识 |
| 本人正式选修与考试 | 本人 enrolled sections、实际考试日期/地点、变更状态 | SIS，向 ARO + ITSO 确认获准只读 API | **机构接入**；公共课表和手动标记都不能替代正式学籍记录 |
| Canvas 作业与日历 | 本人课程、作业名称、有效截止、链接、取消/更新和可见性 | Canvas 官方 REST API；学校管理员启用 Developer Key 后个人 OAuth | **文档确认＋机构接入**；不能把通用 Canvas 文档当作 HKUST 已批准 |
| Canvas 轻量导入 | 课程日历事件、部分作业截止、链接、来源范围 | Canvas 官方 Calendar Feed / ICS 导出 | **文档确认**；需核验本校账户实际可见能力。无 API 批准时可先用本人文件导入 |
| Canvas 公告与学习资料 | 已授权课程的公告、模块/文件链接、版本、访问范围 | 获准 Canvas 端点或用户主动添加材料 | 首版材料链接和短笔记；公告、文件 API 范围须单列申请，不默认下载整个课程库 |
| Outlook 日历 | 标题、开始/结束、地点、取消、忙闲、来源 ID | Microsoft Graph `calendarView`，本人 delegated OAuth | **文档确认**；须注册应用、核查 HKUST 租户同意策略与用户授权 |
| 邮件提醒信号 | 主题、发件人、收到时间、已读/重要性 | Graph messages，`Mail.ReadBasic` | **文档确认**；基础权限没有正文，不能承诺从邮件内容提取所有截止 |
| 资料、笔记和个人任务 | 拥有者、课程/任务关联、来源、本人内容、共享范围、修改历史 | **平台自产**；本人上传是后续独立能力 | 默认私有；不用外部知识库替代个人真实课程材料 |
| 身份与在籍资格 | 稳定主体 ID、机构、资格类型、有效期、验证层级 | HKUST SSO/Entra；资格字段由校方约定 | **机构接入**；成功登录只证明提供的身份声明，不能自行推断当前在籍、校园准入或设施权限 |

官方课程规划说明提及可导出规划课表，并不授权我们直接读 SIS。Canvas 的个人作业截止需要使用当前学生权限下的有效日期，处理个别延期与例外，不能用课程全局截止覆盖所有人。

## 4. 校园生活、交通和地图数据清单

| 数据 | 需要哪些字段 | 来源与 API | 当前结论/限制 |
| --- | --- | --- | --- |
| 九巴/龙运 | 路线、方向、服务类型、站点、顺序、ETA、备注及源时间 | [运输署/KMB 数据集](https://data.gov.hk/en-data/dataset/hk-td-tis_21-etakmb) | **实测**路线列表和 91M ETA；部分返回标为原定班次，不全是实时车辆预测 |
| 绿色小巴 | 地区、线路 ID/方向、站点、班次资料、ETA 与启用状态 | [运输署 GMB 数据集](https://data.gov.hk/en-data/dataset/hk-td-sm_7-real-time-arrival-data-of-gmb) | **实测**11M 路线、站点和 ETA；记录表明路线连接坑口与科大北站。不能延伸为红色小巴或所有学校班车覆盖 |
| 城巴 | 路线、站点、方向、ETA 和备注 | [城巴官方 V2 规格](https://www.citybus.com.hk/datagovhk/bus_eta_api_specifications.pdf) | **实测**路线列表；ETA 规格已确认，本轮未逐站测试 |
| 港铁 | 线路/站码、方向、目的地、到站时间、服务状态和延误 | [MTR Next Train 数据集](https://data.gov.hk/en-data/dataset/mtr-data2-nexttrain-data) | **实测**将军澳站；覆盖按官方站码及服务范围，不推定全交通路线规划能力 |
| 学校大巴/班车 | 上落点、运行日、时刻、费用、资格、临时调整 | [CSO 学生班车](https://cso.hkust.edu.hk/index.php/tran/stud_sh_b)及公告 | **网页来源**已读取；本轮未确认公开实时接口。先维护有来源的计划时刻；车辆定位/ETA 向 CSO/运营方申请 |
| 天气与警告 | 观测站、温湿度、预报、警告、有效时间 | [HKO 官方 API 说明](https://www.hko.gov.hk/tc/weatherAPI/doc/files/HKO_Open_Data_API_Documentation.pdf) | **实测**当前天气和警告；全港或某观测站读数不冒充校园实测，天气警告不等于学校停课公告 |
| 香港地点/地址 | 标准地址、坐标、地区、来源 ID | [政府 Address Lookup Service](https://data.gov.hk/en-data/dataset/hk-dpo-als_01-als)；地图服务可另选 | **实测**地址 JSON。地址服务不提供室内楼层、电梯、无障碍通道或全部场地营业信息 |
| 校园地图/教室 | 校区、建筑、楼层、房间、入口、地点别名、导航链接 | [Path Advisor](https://pathadvisor.hkust.edu.hk/)和部门地图 | 官方入口；本轮未确认开放路网 API。首版核验常用地点和原站导航，室内路线需合作资料 |
| 餐饮/商店 | 位置、营业日/时间、菜单/价格出处、临时闭店 | [CSO](https://cso.hkust.edu.hk/)与商户提供资料 | **网页来源**；未确认统一菜单或排队 API。商家可提供更新；不显示未经测得的排队时长 |
| 图书馆/体育设施 | 位置、开放、规则、预约入口；后续才有余量/本人预约 | [Library Booking](https://library.hkust.edu.hk/facilities-space/booking)、[FBS](https://fbs.hkust.edu.hk/) | 已核验图书馆页面及办理入口；余量、预约/取消需分别获准接口，点击入口不等于预约成功 |
| 宿舍/洗衣/报修 | 服务点、适用宿舍、价格/使用规则、办理入口；后续私人状态 | [SHRLO 洗衣与空调服务](https://shrl.hkust.edu.hk/residential-halls/hall-life/hall-ac-and-laundry-service) | 官方页面已有支付/操作系统；本轮未确认机器实时空闲、余额或工单 API，不能推断设备状态 |
| 校园机会与支持 | 标题、适用人群、截止、地点、负责人/官方入口 | Calendar、[Career Center](https://career.hkust.edu.hk/)、[SFAO](https://sfao.hkust.edu.hk/)、[DSTO](https://dst.hkust.edu.hk/)等主管单位 | 按来源逐项登记与核验；招聘与个别申请资料可能限登录，不能假定公开可批量接入 |

交通提供方可能使用不同地点 ID、坐标和更新时间；先建立对应关系，再做统一展示。公共交通 API 不是学校班车 API，不能直接把前者拿来支撑后者的实时承诺。

## 5. 社交、活动与增长所需数据

| 数据 | 获取方式 | 应保留的边界 |
| --- | --- | --- |
| 学校公开活动 | University Calendar 的 RSS/详情页，进一步向校方申请结构化源；Engage 另行确认 | 学年日历与活动流分别处理；网页发布不证明报名仍开放、用户有资格或尚有名额 |
| 社团/兴趣组织 | 组织者注册、经核验的社团资料和负责人确认 | 学校目录不等于组织者同意入住；社团存在不等于活动已准备 |
| 全港外部活动 | 合作组织者直接发布；经批准的 Luma/Meetup 接入；原始报名链接 | 没有已确认的“一次接入即可完整获取全港活动”的来源；需要持续供给运营 |
| 本平台活动和报名 | 自有数据库：活动、条件、容量、参与状态、候补、变化、取消及结束 | 每场明确一个报名主系统；外部状态未知时不创建假确认 |
| 校园墙/问答/二手/招募 | 用户主动发布、互动与解决状态 | 不从外站复制私人帖子或成员名单；不伪造早期社区内容 |
| 认识同伴与需求撮合 | 本人自选兴趣、时段、地区、语言、角色/投入、是否允许分享 | 意向有期限、可撤回；全课表、邮箱内容和参加历史不作为公开匹配资料 |
| 圈子、关系、消息 | 自愿加入、双方联系确认、本产品会话 | 不要求导入通讯录或抓取其他社媒关系图 |
| 留存和增长测量 | 最小事件：真实事项保存/复用、报名状态、出席确认来源、复办、邀请来源、自愿反馈 | 行为记录无需复制私信/笔记正文；未知到场和未满观察窗口单列 |
| 数据质量与社区运营 | 来源健康、纠错、举报状态、处理记录、负责人与更新历史 | 审核人员按职责访问；业务数据与私人资料分离 |

### 外部活动 API 的实际门槛

**Luma：**[官方接入说明](https://docs.luma.com/reference/getting-started-with-your-api)要求 Luma Plus；API Key 关联特定 Calendar。本轮成功读取[公开 OpenAPI](https://public-api.luma.com/openapi.json)，其中有：

- `GET /v1/calendars/events/list`：默认列出该日历管理的活动；文档还支持已列入该日历、但由其他人管理的有限 view 数据。
- `GET /v1/events/get?event_id=...`：自己管理的活动与已知公开活动的可读字段不同。
- `GET /v1/events/guests/list?event_id=...`：涉及报名/受邀者，仅在有相应管理权限且业务必要时使用，不能为了展示活动而默认导入全部联系人。

这些不是已核实的“全港所有活动搜索 API”。本轮只查文档和公开规格，没有使用 Key 读取任何组织者账户。生产接入需要组织者授权、安全保管 Key、实际权限和计费核验。只接必要公开字段或本人参与状态，不自动搬走嘉宾名单。

**Meetup：**[官方 API 申请说明](https://help.meetup.com/hc/en-us/articles/41453576628749-How-can-I-get-access-to-Meetup-s-API)说明当前使用 GraphQL，申请 OAuth consumer 需要有效 Pro 订阅，付费也不保证审批。应作为后续合作选项；不能用旧版免费 REST 教程承诺首版数据覆盖。本轮未申请或测试其授权 API。

Gacha Chill、其他社交平台或学校现有 App，本轮没有核实到可直接用于本产品的开放数据合同。可提出合作需求，但不把别人的 App 内部请求当公共 API。

## 6. 已验证的具体接口与请求形态

以下只读示例用于后续工程评估；带占位符的请求必须使用相应官方数据中的真实 ID。通过一次读取不等于具备完整同步、重试、缓存和监控。

| 来源 | 请求示例/接口 | 鉴权与本轮状态 |
| --- | --- | --- |
| HKUST 学年日历 | `GET https://calendar.hkust.edu.hk/events/ics?ics_mode=academic_calendar` | 无凭证；实测返回 `text/calendar`、45 个 VEVENT |
| HKUST RSS | `GET https://calendar.hkust.edu.hk/events/rss?ics_mode=academic_calendar` | 无凭证；实测 73 个 item，包含一般校园活动，与上述学年 ICS 范围不同；不能按参数名猜内容 |
| KMB 路线 | `GET https://data.etabus.gov.hk/v1/transport/kmb/route/` | 无 Key 实测成功 |
| KMB ETA | `GET https://data.etabus.gov.hk/v1/transport/kmb/route-eta/91M/1`；单站 `/eta/{stop_id}/{route}/{service_type}` | 路线 ETA 实测成功；单站形态来自[官方规格](https://data.etabus.gov.hk/datagovhk/kmb_eta_api_specification.pdf) |
| GMB 路线/站点 | `GET https://data.etagmb.gov.hk/route/NT/11M`；`/route-stop/2004825/1` | 两者实测成功；2004825 是本轮从 11M 路线返回读取的 ID，不应永久硬编码 |
| GMB ETA | `GET https://data.etagmb.gov.hk/eta/route-stop/2004825/1/1` | 实测返回 enabled、ETA 与 Scheduled 备注；[官方规格](https://data.etagmb.gov.hk/static/GMB_ETA_API_Specification.pdf) |
| 城巴 | `GET https://rt.data.gov.hk/v2/transport/citybus/route/CTB`；ETA `/eta/CTB/{stop_id}/{route}` | 路线列表实测成功；ETA 文档确认、尚未实测；大小写按官方规范 |
| MTR | `GET https://rt.data.gov.hk/v1/transport/mtr/getSchedule.php?line=TKL&sta=TKO&lang=en` | 无 Key 实测返回站点资料和正常服务 status；[API 规格](https://opendata.mtr.com.hk/doc/Next_Train_API_Spec_v1.7.pdf) |
| HKO | `GET https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=rhrread&lang=en`；`dataType=warnsum` | 两者实测成功；`flw`、`fnd` 等预报按官方文档后续接入 |
| ALS 地址 | `GET https://www.als.gov.hk/lookup?q={URL编码的地址}`，请求 `Accept: application/json` | 无 Key 实测成功；从 SuggestedAddress 中选择结果，不直接假定第一项正确 |
| Microsoft Graph | `GET https://graph.microsoft.com/v1.0/me/calendarView?startDateTime=...&endDateTime=...` | 本人 delegated `Calendars.ReadBasic` 起步；[官方说明](https://learn.microsoft.com/en-us/graph/api/user-list-calendarview?view=graph-rest-1.0)，未实测私人账户 |
| Microsoft Graph 邮件 | `GET https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages` | delegated `Mail.ReadBasic` 起步；[messages](https://learn.microsoft.com/en-us/graph/api/user-list-messages?view=graph-rest-1.0)及[权限说明](https://learn.microsoft.com/en-us/graph/permissions-reference)，未实测私人账户 |
| Canvas | 获准实例域名下 `GET /api/v1/courses`、`GET /api/v1/courses/{course_id}/assignments`、`GET /api/v1/calendar_events` | 本人 OAuth＋管理员启用的范围；[课程](https://developerdocs.instructure.com/services/canvas/resources/courses)、[作业](https://developerdocs.instructure.com/services/canvas/resources/assignments)、[日历](https://developerdocs.instructure.com/services/canvas/resources/calendar_events)文档已读，未调用 HKUST 私人 API |
| Luma | 基础域 `https://public-api.luma.com`，具体 GET 路径见上节 | `x-luma-api-key`；规格可公开读取，业务 API 未授权实测 |

本轮 HTTP 200 后另做内容识别：网页页面不当 JSON；ICS 查事件记录；RSS 查 item；ETA 查真实数据数组/状态。特别注意 KMB 与 GMB 样本中的“Scheduled/原定班次/未开出”，显示时保留原含义。

### 导入与权限的具体限制

[Canvas 官方日历导出说明](https://community.instructure.com/en/kb/articles/662804-how-do-i-view-the-calendar-ical-feed-to-subscribe-to-an-external-calendar)列出：未来最多 366 天、过去 30 天、最多 1,000 项，不包含 To Do 项。它不是所有公告、所有文件或完整个人学习记录。HKUST 的实际账户功能仍需有权限的用户核验。私人订阅 URL 按可访问个人内容的秘密处理，不放公开日志；文件导入与持续订阅分别标识。

Graph 的 `Mail.ReadBasic` 不提供正文、正文预览和附件；`Calendars.ReadBasic` 也不提供全部日历内容。若以后要从邮件正文分析任务，需明确追加目的和合适只读权限，不能用现有基础授权悄悄扩大读取。授权日历也不意味着它包含学校所有课程。

## 7. 学校合作的正确入口

新核实到 [HKUST API Gateway & API Portal](https://itso.hkust.edu.hk/services/it-infrastructure/api-gateway-api-portal)及[Developer Portal](https://hkust.developer.azure-api.net/)。官方要求先获系统拥有者同意，并按约定方式接入。本轮公开 APIs 页面未返回可确认的具体接口目录；不能据此断言没有接口，也不能宣称 SIS、预约、地图已经开放。

[HKUST SSO Integration](https://itso.hkust.edu.hk/services/cyber-security/authentication-service/sso-integration)说明支持 CAS/OIDC/SAML，身份提供方使用 Entra ID，并有应用注册流程；注册入口注明限制，需与 ITSO 确认本项目由谁申请。SSO、Graph 数据读取、Canvas 权限和 SIS 数据访问是不同事项。

| 对接方 | 要求确认的具体问题 | 未获准前的产品承接 |
| --- | --- | --- |
| ITSO / API Portal 及对应数据拥有者 | 可用 API 产品、申请资格、字段、用途、缓存/再展示、频率、维护与撤销；身份声明具体含义 | 独立账户、公共信息和明确核验的试点资格 |
| ARO + ITSO | 本人选修/候补/考试的只读接口，UG/TPG/RPG 覆盖和更新方式 | 本人导入、手动核对和正式系统入口 |
| CEI / Canvas 管理员 | scoped Developer Key、学生 OAuth、课程/作业/日历/公告/文件分别允许哪些端点 | 本人 ICS 与主动添加材料；无完整同步承诺 |
| CSO / 交通运营方 | 班车时刻/调整公告的结构化源，是否有允许复用的 ETA | 有版本的计划时刻、官方通知 |
| Library / DSTO 设施 / SHRLO 及供应商 | 公开设施信息、余量、本人预约/工单、读写边界；各校区差异 | 说明与官方办理；不虚构实时或预约成功 |
| 校内外组织者 | 活动发布权、报名主系统、状态同步、必要参与资料、变更责任 | 组织者主动填写，外部报名状态不明示为未知 |

学校[数据接入条款](https://itso.hkust.edu.hk/services/it-infrastructure/smart-campus-infrastructure/open-data-platform/data-access-form)要求说明数据用途、访问频率、期限、存储及结束后的处理；外部处理/分享需相应数据拥有者同意。因此向学校申请只读数据时，资料再展示及可能的第三方 AI 处理不能混在未说明的用途里。本轮没有提交申请或联系任何人。

## 8. 首版建议顺序与成本门槛

**第一批：公开资料＋本人导入＋自有社交数据。** 核验学校地点/服务目录；接学年 ICS、真实活动 RSS、天气与所需交通路线；用户导入课表、添加任务和材料；组织者建立真实活动。没有机构接口也能开始验证基本价值，但不能声称学习记录全部自动同步。

**第二批：正式申请个人学习连接。** 优先 Graph 日历与 Canvas 作业/日历；学校资格、SIS 正式课表/考试按批准情况接入。邮件全文、成绩、学费、证件等不属于首版必要数据。对用户逐项展示实际接入范围。

**第三批：设施实时状态及更广活动来源。** 图书馆/体育/洗衣/预约依合作推进；Luma、Meetup 根据真实组织者需要与费用决定；逐学校核验来源与资格，不把 HKUST 的许可扩展到其他学校。

本轮实测的公共交通、天气与公开日历读取没有使用 API Key 或购买订阅；仍需逐来源落实条款、署名和访问负载，不把“可无凭证调用”写成无限制商业许可。学校文档确认服务存在，不代表已获得接口。

Google Maps/Places/Routes 可作为地图与城市地点的候选方案，但[官方 FAQ](https://developers.google.com/maps/faq)要求有效 API Key 和计费账户。先用已核验地点、ALS 和原站导航降低依赖；若采用付费地图，按实际功能、地区覆盖、缓存条款和用量估价。本轮未开通计费。Luma Plus/Meetup Pro 有付费及权限门槛，不将它们设为首版必备前置条件。

## 9. 每份数据必须一起保存的元信息

建议公共数据登记：来源拥有者、原文/端点、校区、来源记录 ID、字段范围、允许用途、接入方式、来源更新时间、抓取时间、有效时间、过期规则、负责人与失败状态。个人数据另记拥有者、授权范围、授权/撤销时间及保留规则；共享记录另记受众。

更新节奏是工程建议而非提供方承诺：静态地点/规则定期核验并响应纠错；课程/活动按源能力做增量或低频刷新；交通 ETA 仅在有人查看时按源发布节奏和条款读取，优先服务端合并缓存；个人连接按允许策略同步并显示最后成功时间。过期后停止假实时倒数。快照、官方导入、个人修改、正式确认必须可分辨。

首次上线前每个来源应通过样本检查：正常、无数据、过期、取消、重复、部分覆盖、权限失效；资料被撤销后搜索与缓存一致。日期和活动例外尤其需要检查。用户提供订阅 URL 时须做允许来源与网络访问边界校验，防止任意内网读取；私人 URL 和凭证不进入日志。

## 10. 当前项目实际已有多少

本轮读取 `src/data/source-registry.ts`、`src/domain/account-status.ts`、`src/adapters/graph-outlook.ts`、`src/adapters/hko-weather.ts` 与原接入申请草案：

- 当前登记 15 个校园入口；这是来源导航，不是 15 个已接通 API。
- HKO 已有天气/警告读取代码，本轮也验证公开端点可返回数据；尚不代表全产品监控及发布验收已完成。
- Graph 有基础邮件/日历读取代码，当前邮件只请求最近 10 条、日历窗口为 7 天，且没有实现完整分页等覆盖；不可称“全部学校信息”。生产逐用户授权仍需完成。
- 代码把 Canvas 和 SIS 标为机构审批前置。旧的账户申请草案以只读 MCP 为背景，若用于新产品，必须按持久化账户与真实功能重新审阅，不能直接当作已批准的数据合同。
- 先前 U0 审查已经确认 ICS 解析需补结束时间、时区、重复/例外和持久保存；公开 feed 读通不等于课表导入功能已做好。

此前 Canvas 项目的历史记录出现过个人 Token 自建受限。本轮没有登录个人 Canvas 复核这一设置，不能把历史观察作为今天全校统一政策；正式接入判断以当前管理员确认和[Canvas Developer Keys 文档](https://developerdocs.instructure.com/services/canvas/oauth2/file.developer_keys)为准。

## 11. 阶段交接

目标：把产品所需数据、来源、API 和门槛查清楚。已完成：公共及个人/自产数据清单、官方接口与接入流程核查、若干无凭证公开读取、现有项目覆盖审查、首版分批建议及公开检查记录。未完成：任何个人授权联调、学校审批、外部合作、商业订阅、正式接入代码与持续运行验证。下一步可据此确定首批数据源及拟申请字段，再进入逐连接器实施计划。没有收集新学生数据或向任何人发送消息。
