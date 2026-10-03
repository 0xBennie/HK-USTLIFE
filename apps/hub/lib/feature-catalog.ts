export type FeatureStatus = "local" | "partial" | "connection" | "planned" | "review";
export type Feature = {id:string;group:string;zh:string;en:string;status:FeatureStatus;detail:string;detailEn:string};
export const features:Feature[] = [
  {
    "id": "B01",
    "group": "study",
    "zh": "日列表与周课表，课程/教室/时间",
    "en": "Day and week timetables",
    "status": "partial",
    "detail": "日/周视图已接入本地日程；正式教务课表尚未同步。",
    "detailEn": "Local day/week calendar exists. Official timetable sync is pending."
  },
  {
    "id": "B02",
    "group": "study",
    "zh": "学期、假日、调课与补课例外",
    "en": "Term dates, holidays and schedule changes",
    "status": "partial",
    "detail": "ICS 重复、取消与变更已支持；学校学期和调课自动同步待接入。",
    "detailEn": "ICS recurrence, cancellation and changes exist; official term and timetable sync is pending."
  },
  {
    "id": "B03",
    "group": "study",
    "zh": "个人日程与 TA/辅导课、重复周及课程关联",
    "en": "Personal plans, tutorials and recurring events",
    "status": "partial",
    "detail": "个人日程、课程关联与 ICS 重复安排已实现；未接入正式 TA 排课。",
    "detailEn": "Personal events, course links and recurring ICS imports exist; official tutorial scheduling is pending."
  },
  {
    "id": "B04",
    "group": "study",
    "zh": "作业、活动与个人事项的统一截止视图",
    "en": "One view for deadlines and tasks",
    "status": "partial",
    "detail": "私人任务与截止视图已实现；完成任务不代表已向学校提交。",
    "detailEn": "Private tasks and deadlines exist. Completion is not school submission."
  },
  {
    "id": "B05",
    "group": "study",
    "zh": "按课程/章节组织资料与学习活动",
    "en": "Course links, notes and learning resources",
    "status": "partial",
    "detail": "课程、笔记和资料链接已实现；学校文件库尚未接入。",
    "detailEn": "Courses, notes and resource links exist. School file access is pending."
  },
  {
    "id": "B06",
    "group": "study",
    "zh": "课程文件查看、下载、打开、分享",
    "en": "View, download and share course files",
    "status": "connection",
    "detail": "需按 HKUST 可用数据与授权逐项接入；目前没有正式学校连接。",
    "detailEn": "Requires verified HKUST data or scoped authorization. No official school connection yet."
  },
  {
    "id": "B07",
    "group": "study",
    "zh": "批量课程资料打包、资源库与再次打开",
    "en": "Batch downloads and resource library",
    "status": "connection",
    "detail": "需按 HKUST 可用数据与授权逐项接入；目前没有正式学校连接。",
    "detailEn": "Requires verified HKUST data or scoped authorization. No official school connection yet."
  },
  {
    "id": "B08",
    "group": "study",
    "zh": "作业要求、截止与学校提交状态",
    "en": "Official assignment requirements and submission status",
    "status": "connection",
    "detail": "需按 HKUST 可用数据与授权逐项接入；目前没有正式学校连接。",
    "detailEn": "Requires verified HKUST data or scoped authorization. No official school connection yet."
  },
  {
    "id": "B09",
    "group": "study",
    "zh": "文本／附件作业提交及回执",
    "en": "Submit coursework with a verified receipt",
    "status": "connection",
    "detail": "需按 HKUST 可用数据与授权逐项接入；目前没有正式学校连接。",
    "detailEn": "Requires verified HKUST data or scoped authorization. No official school connection yet."
  },
  {
    "id": "B10",
    "group": "study",
    "zh": "课程论坛／讨论与问题回复",
    "en": "Course discussions and questions",
    "status": "partial",
    "detail": "本平台求助与回复已实现；课程专属讨论和学校论坛连接待做。",
    "detailEn": "Local questions and replies exist. Dedicated course forums and school connections are pending."
  },
  {
    "id": "B11",
    "group": "study",
    "zh": "本人成绩、学分、学校 GPA/累计 GPA 与相关学业记录",
    "en": "Private grades, credits and GPA",
    "status": "connection",
    "detail": "需按 HKUST 可用数据与授权逐项接入；目前没有正式学校连接。",
    "detailEn": "Requires verified HKUST data or scoped authorization. No official school connection yet."
  },
  {
    "id": "B12",
    "group": "mail",
    "zh": "邮箱文件夹、消息列表、搜索与阅读",
    "en": "Read and search school email",
    "status": "connection",
    "detail": "需按 HKUST 可用数据与授权逐项接入；目前没有正式学校连接。",
    "detailEn": "Requires verified HKUST data or scoped authorization. No official school connection yet."
  },
  {
    "id": "B13",
    "group": "mail",
    "zh": "撰写、发送、回复、转发邮件",
    "en": "Compose, reply and forward email",
    "status": "connection",
    "detail": "需按 HKUST 可用数据与授权逐项接入；目前没有正式学校连接。",
    "detailEn": "Requires verified HKUST data or scoped authorization. No official school connection yet."
  },
  {
    "id": "B14",
    "group": "mail",
    "zh": "邮件草稿、附件、删除与恢复",
    "en": "Email drafts, attachments, delete and restore",
    "status": "connection",
    "detail": "需按 HKUST 可用数据与授权逐项接入；目前没有正式学校连接。",
    "detailEn": "Requires verified HKUST data or scoped authorization. No official school connection yet."
  },
  {
    "id": "B15",
    "group": "mail",
    "zh": "邮件摘要、优先级、截止提取、变化与下一步",
    "en": "Optional email summaries and deadline extraction",
    "status": "planned",
    "detail": "已纳入后续规划，尚未交付。",
    "detailEn": "In the roadmap; not yet delivered."
  },
  {
    "id": "B16",
    "group": "campus",
    "zh": "学院/部门/教师公开专业资料、研究方向与查询",
    "en": "Faculty, department and researcher directory",
    "status": "connection",
    "detail": "需按 HKUST 可用数据与授权逐项接入；目前没有正式学校连接。",
    "detailEn": "Requires verified HKUST data or scoped authorization. No official school connection yet."
  },
  {
    "id": "B17",
    "group": "campus",
    "zh": "从课程/目录联系教师或部门",
    "en": "Contact teachers and departments",
    "status": "connection",
    "detail": "需按 HKUST 可用数据与授权逐项接入；目前没有正式学校连接。",
    "detailEn": "Requires verified HKUST data or scoped authorization. No official school connection yet."
  },
  {
    "id": "B18",
    "group": "campus",
    "zh": "学年安排、请假及统一门户办理",
    "en": "Academic calendar, leave and service portals",
    "status": "connection",
    "detail": "需按 HKUST 可用数据与授权逐项接入；目前没有正式学校连接。",
    "detailEn": "Requires verified HKUST data or scoped authorization. No official school connection yet."
  },
  {
    "id": "B19",
    "group": "campus",
    "zh": "本人校园项目进度与已有参与/考勤记录",
    "en": "Campus programme and attendance records",
    "status": "connection",
    "detail": "需按 HKUST 可用数据与授权逐项接入；目前没有正式学校连接。",
    "detailEn": "Requires verified HKUST data or scoped authorization. No official school connection yet."
  },
  {
    "id": "B20",
    "group": "campus",
    "zh": "楼宇/地点搜索、地图、导航与私人标记",
    "en": "Campus places, maps and private markers",
    "status": "partial",
    "detail": "已核验地点、搜索、官方地图入口及收藏已实现；室内路线与地图标记待做。",
    "detailEn": "Reviewed places, search, official map links and bookmarks exist; indoor routing and markers are pending."
  },
  {
    "id": "B21",
    "group": "campus",
    "zh": "校园生活目录、地点详情、评分/评论/回复/有用/分享",
    "en": "Campus listings, reviews, replies and sharing",
    "status": "planned",
    "detail": "已纳入后续规划，尚未交付。",
    "detailEn": "In the roadmap; not yet delivered."
  },
  {
    "id": "B22",
    "group": "campus",
    "zh": "社团、校外推荐、活动目录",
    "en": "Clubs, off-campus recommendations and activities",
    "status": "partial",
    "detail": "活动发布、筛选与报名已实现；社团完整目录和校外推荐待补。",
    "detailEn": "Local activity publishing, filters and registration exist. Club listings and recommendations are pending."
  },
  {
    "id": "B23",
    "group": "social",
    "zh": "校园墙访问、发帖与交流",
    "en": "Campus wall and student conversations",
    "status": "partial",
    "detail": "本地校园墙、求助、回复及状态管理已实现；尚未开放运营。",
    "detailEn": "Local wall posts, questions, replies and status controls exist. Not publicly operating."
  },
  {
    "id": "B24",
    "group": "identity",
    "zh": "本人校园资料与电子信息卡",
    "en": "Personal campus profile and information card",
    "status": "connection",
    "detail": "需按 HKUST 可用数据与授权逐项接入；目前没有正式学校连接。",
    "detailEn": "Requires verified HKUST data or scoped authorization. No official school connection yet."
  },
  {
    "id": "B25",
    "group": "identity",
    "zh": "Face ID／Touch ID 本机隐私保护",
    "en": "Face ID and Touch ID app protection",
    "status": "planned",
    "detail": "已纳入后续规划，尚未交付。",
    "detailEn": "In the roadmap; not yet delivered."
  },
  {
    "id": "B26",
    "group": "identity",
    "zh": "自愿导出 Apple Wallet 信息卡",
    "en": "Optional Apple Wallet information card",
    "status": "planned",
    "detail": "已纳入后续规划，尚未交付。",
    "detailEn": "In the roadmap; not yet delivered."
  },
  {
    "id": "B27",
    "group": "ios",
    "zh": "日课表／周课表的小组件及不同尺寸",
    "en": "Day and week timetable widgets",
    "status": "planned",
    "detail": "已纳入后续规划，尚未交付。",
    "detailEn": "In the roadmap; not yet delivered."
  },
  {
    "id": "B28",
    "group": "ios",
    "zh": "截止与下一项安排概览小组件",
    "en": "Deadline and next-event widgets",
    "status": "planned",
    "detail": "已纳入后续规划，尚未交付。",
    "detailEn": "In the roadmap; not yet delivered."
  },
  {
    "id": "B29",
    "group": "ios",
    "zh": "可调次数／提前量的课程及截止提醒",
    "en": "Custom class and deadline reminders",
    "status": "planned",
    "detail": "提醒偏好已有数据字段；iOS 系统通知调度和取消尚未完成。",
    "detailEn": "Reminder preferences are stored; iOS scheduling and cancellation are not complete."
  },
  {
    "id": "B30",
    "group": "ios",
    "zh": "静默时段、相近提醒合并、静默前摘要",
    "en": "Quiet hours and grouped reminders",
    "status": "planned",
    "detail": "已纳入后续规划，尚未交付。",
    "detailEn": "In the roadmap; not yet delivered."
  },
  {
    "id": "B31",
    "group": "ios",
    "zh": "灵动岛／锁屏实时活动，课程与截止分别设置",
    "en": "Live Activities and Dynamic Island",
    "status": "planned",
    "detail": "已纳入后续规划，尚未交付。",
    "detailEn": "In the roadmap; not yet delivered."
  },
  {
    "id": "B32",
    "group": "ios",
    "zh": "Apple Watch 概览、两周课表、截止",
    "en": "Apple Watch timetable and deadlines",
    "status": "planned",
    "detail": "已纳入后续规划，尚未交付。",
    "detailEn": "In the roadmap; not yet delivered."
  },
  {
    "id": "B33",
    "group": "ios",
    "zh": "Watch 卡片排序/隐藏及 iPhone 同步",
    "en": "Watch card preferences and iPhone sync",
    "status": "planned",
    "detail": "已纳入后续规划，尚未交付。",
    "detailEn": "In the roadmap; not yet delivered."
  },
  {
    "id": "B34",
    "group": "ios",
    "zh": "浅深色主题、简繁英与可访问性",
    "en": "Appearance, languages and accessibility",
    "status": "partial",
    "detail": "中英界面、深浅色与减少动态效果已实现基础支持；繁体及设备无障碍验收待做。",
    "detailEn": "Basic English/Chinese, appearances and reduced motion exist. Traditional Chinese and device accessibility review are pending."
  },
  {
    "id": "B35",
    "group": "ios",
    "zh": "课程个人名称、隐藏/排序、列表阅读偏好",
    "en": "Personal course names, ordering and visibility",
    "status": "planned",
    "detail": "已纳入后续规划，尚未交付。",
    "detailEn": "In the roadmap; not yet delivered."
  },
  {
    "id": "B36",
    "group": "ios",
    "zh": "个人安排与偏好跨设备同步、离线合并",
    "en": "Cross-device preferences and offline reconciliation",
    "status": "planned",
    "detail": "已纳入后续规划，尚未交付。",
    "detailEn": "In the roadmap; not yet delivered."
  },
  {
    "id": "B37",
    "group": "ios",
    "zh": "头像选择/裁剪；获准时更新学校头像",
    "en": "Profile picture selection and cropping",
    "status": "planned",
    "detail": "已纳入后续规划，尚未交付。",
    "detailEn": "In the roadmap; not yet delivered."
  },
  {
    "id": "B38",
    "group": "ai",
    "zh": "AI 查询本人课表、截止、课程与安排",
    "en": "AI help with your schedule and deadlines",
    "status": "planned",
    "detail": "已纳入后续规划，尚未交付。",
    "detailEn": "In the roadmap; not yet delivered."
  },
  {
    "id": "B39",
    "group": "ai",
    "zh": "AI 查询校园、教师/研究方向及导师候选信息",
    "en": "Source-linked campus and faculty answers",
    "status": "planned",
    "detail": "已纳入后续规划，尚未交付。",
    "detailEn": "In the roadmap; not yet delivered."
  },
  {
    "id": "B40",
    "group": "ai",
    "zh": "AI 解释课程资料、整理资源及获准邮件",
    "en": "AI help with course resources and authorized email",
    "status": "planned",
    "detail": "已纳入后续规划，尚未交付。",
    "detailEn": "In the roadmap; not yet delivered."
  },
  {
    "id": "B41",
    "group": "ai",
    "zh": "AI 图片、相机、文件提问与资源引用",
    "en": "Ask about selected images and files",
    "status": "planned",
    "detail": "已纳入后续规划，尚未交付。",
    "detailEn": "In the roadmap; not yet delivered."
  },
  {
    "id": "B42",
    "group": "ai",
    "zh": "AI 提出提醒/安排/草稿/提交/打包等动作并预览确认",
    "en": "Preview and confirm AI-proposed actions",
    "status": "planned",
    "detail": "已纳入后续规划，尚未交付。",
    "detailEn": "In the roadmap; not yet delivered."
  },
  {
    "id": "B43",
    "group": "ai",
    "zh": "AI 对话管理/同步、可确认编辑或拒绝的长期记忆",
    "en": "AI conversations and editable memory",
    "status": "planned",
    "detail": "已纳入后续规划，尚未交付。",
    "detailEn": "In the roadmap; not yet delivered."
  },
  {
    "id": "B44",
    "group": "ai",
    "zh": "AI 思考强度选择与透明用量",
    "en": "AI effort controls and transparent usage",
    "status": "planned",
    "detail": "已纳入后续规划，尚未交付。",
    "detailEn": "In the roadmap; not yet delivered."
  },
  {
    "id": "B45",
    "group": "platform",
    "zh": "iPhone App 与内测/正式发行",
    "en": "iPhone app and beta distribution",
    "status": "partial",
    "detail": "已有 Expo/React Native 工程并通过编译导出；未完成模拟器、真机与分发验收。",
    "detailEn": "Expo/React Native source compiles and exports. Simulator, device and distribution acceptance are pending."
  },
  {
    "id": "B46",
    "group": "platform",
    "zh": "iPad/Mac 大屏学习与相应系统体验",
    "en": "iPad and Mac learning experience",
    "status": "planned",
    "detail": "已纳入后续规划，尚未交付。",
    "detailEn": "In the roadmap; not yet delivered."
  },
  {
    "id": "B47",
    "group": "platform",
    "zh": "Android 与 Windows 客户端",
    "en": "Android and Windows clients",
    "status": "planned",
    "detail": "保留远期范围；当前只做 iOS，不启动安卓或 Windows 开发。",
    "detailEn": "Retained for the longer term. Current development targets iOS only."
  },
  {
    "id": "B48",
    "group": "platform",
    "zh": "官网功能介绍、下载/内测、支持/隐私、反馈与分享",
    "en": "Product website, support, privacy and sharing",
    "status": "partial",
    "detail": "本地官网、公开活动分享、帮助与隐私页已实现；暂无下载或内测分发。",
    "detailEn": "Local website, public activity pages, help and privacy exist. No app download or beta distribution."
  },
  {
    "id": "B49",
    "group": "platform",
    "zh": "教师／课堂体验评价历史能力",
    "en": "Teaching-experience ratings: historical review only",
    "status": "review",
    "detail": "竞品已停用的历史功能，仅保留评估记录；没有启用教师评分榜。",
    "detailEn": "A retired reference-product feature, kept for review only. No teacher rating board is enabled."
  },
  {
    "id": "B50",
    "group": "platform",
    "zh": "内容维护、权限治理、用户/设备服务状态与运营概览",
    "en": "Content maintenance, access controls and operations",
    "status": "partial",
    "detail": "举报处理、屏蔽及管理员权限已实现；数据源维护和运营概览待做。",
    "detailEn": "Reports, blocking and restricted moderation exist. Source maintenance and operational dashboards are pending."
  },
  {
    "id": "C01",
    "group": "study",
    "zh": "ICS 导入与冲突处理",
    "en": "ICS import and conflict review",
    "status": "local",
    "detail": "选择文件、预览、确认导入、重复项与私人修改冲突处理；可删除来源。",
    "detailEn": "Choose, preview and confirm imports; review recurrence and private-edit conflicts; remove sources."
  },
  {
    "id": "C02",
    "group": "campus",
    "zh": "校巴时刻表",
    "en": "Campus shuttle timetables",
    "status": "local",
    "detail": "方向、运行日、假日、计划班次和来源时效；没有校巴实时定位。",
    "detailEn": "Directions, service days, holidays, scheduled departures and freshness. No shuttle GPS."
  },
  {
    "id": "C03",
    "group": "campus",
    "zh": "九巴与绿色小巴",
    "en": "KMB and green minibuses",
    "status": "local",
    "detail": "已接入校园相关路线、站点与到站接口；区分无预测、过期和断网。",
    "detailEn": "Campus-linked routes, stops and arrival APIs; empty, stale and offline states stay distinct."
  },
  {
    "id": "C04",
    "group": "campus",
    "zh": "地点收藏与信息纠错",
    "en": "Saved places and corrections",
    "status": "local",
    "detail": "私人收藏、纠错提交与本人历史；纠错不会直接覆盖公开资料。",
    "detailEn": "Private bookmarks, correction requests and history. Requests do not overwrite public facts."
  },
  {
    "id": "C05",
    "group": "social",
    "zh": "小型活动与学习组队",
    "en": "Small activities and study groups",
    "status": "local",
    "detail": "发布、搜索、语言与互动偏好筛选；地点、人数和参与要求明确。",
    "detailEn": "Publish and search by language and interaction preference; clear location, capacity and requirements."
  },
  {
    "id": "C06",
    "group": "social",
    "zh": "报名、候补与退出",
    "en": "Registration, waitlists and withdrawal",
    "status": "local",
    "detail": "名额分配、候补递补、退出与幂等重试已在本地 API 验证。",
    "detailEn": "Local API checks cover capacity allocation, waitlist promotion, withdrawal and safe retries."
  },
  {
    "id": "C07",
    "group": "social",
    "zh": "组织者与活动日历",
    "en": "Organizer tools and activity calendars",
    "status": "local",
    "detail": "组织者改期、取消、名单管理；主动保存后关联私人日历。",
    "detailEn": "Organizer rescheduling, cancellation and rosters; optional saving to a private calendar."
  },
  {
    "id": "C08",
    "group": "social",
    "zh": "站内消息与互动回复",
    "en": "In-app updates and replies",
    "status": "local",
    "detail": "活动变化、报名和回复通知及已读状态；目前不是即时私聊系统。",
    "detailEn": "Activity, registration and reply updates with read state; not a direct messaging system."
  },
  {
    "id": "C09",
    "group": "identity",
    "zh": "本地账号与数据管理",
    "en": "Local accounts and data controls",
    "status": "local",
    "detail": "开发邮箱验证码、会话、本人导出与账号删除已实现；不是学校 SSO。",
    "detailEn": "Development email-code login, sessions, private export and account deletion exist; not school SSO."
  },
  {
    "id": "C10",
    "group": "identity",
    "zh": "举报、屏蔽与治理",
    "en": "Reports, blocking and moderation",
    "status": "local",
    "detail": "举报队列、双向屏蔽、管理员处理与审计记录已实现。",
    "detailEn": "Report queues, bilateral blocking, restricted review and audit records exist."
  },
  {
    "id": "C11",
    "group": "social",
    "zh": "跨校社交与全港活动",
    "en": "Cross-campus connections and Hong Kong activities",
    "status": "planned",
    "detail": "保留全港愿景；多校身份、组织者网络、跨校发现与信任机制尚未实现。",
    "detailEn": "Long-term direction; multi-campus identity, organizers, discovery and trust mechanisms are not implemented."
  }
];
