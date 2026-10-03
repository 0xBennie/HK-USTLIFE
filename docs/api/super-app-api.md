# 香港校园与社交 Super App：API 文档

> 实现状态更新（2026-10-03）：本文及 OpenAPI 是完整拟议合同。当前已运行的原生账户 API、Bearer 会话和本地开发限制见 [实际 MVP API](implemented-mvp-api.md)，校园来源核对、地点编辑及纠错处理见 [校园维护 API](campus-maintenance-api.md)，不能把下文全部端点视为已实现。

版本：0.1，2026-10-02。本文是统一接口设计及接入说明，重点展开学生登录和校巴时间。**下文为初始拟议合同；已实施子集以以上实际 API 文档为准。外部接口可读取、文档合同通过、规则样例通过、真实产品通过，是四种不同结果。**

- 已实现的校巴时刻与假期维护：[接口与验证](shuttle-maintenance-api.md)。
- 机器可读合同：[OpenAPI 3.1](super-app.openapi.json)。所有产品操作均标记 `x-implementation-status: planned`，不能拿本文件当作现有服务器地址。
- 数据源完整调查：[来源、字段与权限](../research/2026-10-02-super-app-data-and-api-feasibility.md)。
- 2026-10-03主流程更新：[HKUST账号登录与SIS正式课表接入](hkust-sis-integration.md)。目标为学校登录后自动同步正式课表；SSO与SIS权限分别申请，目前均未接通，ICS仅为备用。
- 本轮测试：[结果与限制](test-report-2026-10-02.md)。测试结果文件与复跑方式见该报告。
- 范围更新：用户已将参考网站全部功能纳入[长期路线图](../superpowers/specs/2026-10-02-bnbu-full-feature-roadmap.md)。该文件第 5 节登记原生身份、邮件读写、作业提交、成绩/信息卡、跨端及 AI 的合同增补；当前 OpenAPI 0.1 尚未覆盖，原测试结果不适用于这些新增能力。

## 1. 边界与通用约定

客户端调用本平台；平台按获准方式访问上游。身份、个人连接和业务权限分离。首期推荐浏览器应用使用服务器会话，学校 OAuth Token 只存服务端；手机原生登录另做分发渠道与回调验收。

产品 API 的相对基础路径为 `/api/v1`。UTF-8 JSON；标识符是不透明字符串；金额用最小币种单位和币种；时间用带时区 RFC 3339，校巴服务日按 `Asia/Hong_Kong`。日期是 `YYYY-MM-DD`，不能静默补成某个时间。列表使用游标分页、`limit` 默认 20、最大 100；客户端必须继续读 `next_cursor` 才能称本查询完整。

成功响应包含 `data`、`meta.request_id`、`meta.generated_at`；来源数据保留 `source_id`、原文、接入方式、源更新时间、读取时间和有效期。未知源更新时间返回 null，不能用读取时间替代。错误结构为 `error.code/message/retryable/request_id`，不回显 OAuth code、Token、私人 URL 或用户原始文件。

错误约定：400 参数错误；401 无有效会话；403 资格/授权不足；404 不存在或无权知悉的私人资源；409 状态或版本冲突；410 一次性流程已过期；422 已理解但内容无法处理；429 限流并带 Retry-After；503 来源或连接尚不可用。带有可显示旧数据的查询可返回 200，但状态必须为 stale/partial 等，不能显示实时成功。

私有响应 `Cache-Control: no-store`；所有按用户变化的响应不得进入公共缓存。写入 API 校验 Origin、会话和 CSRF；认证之前使用仅限同源的临时会话与 CSRF Token。创建任务、确认导入、创建活动/意向等要求 Idempotency-Key；重复键与不同请求体返回 409，幂等记录与业务写入原子提交，建议保存 24 小时。Token 类一次性流程另有单次消费机制。

## 2. 学生如何登录

### 2.1 两种登录入口与三种状态

**平台邮箱验证码登录**可支持城市用户和初期用户；完成验证只获得平台账户和邮箱控制权。**学校登录**在 ITSO 同意并注册应用后，采用其批准的 OIDC 配置，用户在学校/Microsoft 页面输入账号并完成 MFA。平台不收学校密码、MFA 码、登录 Cookie 或校园电子身份二维码。

必须分别显示：`account_session`（平台会话）、`membership`（学校资格）、`connection`（获准数据源）。持有学校邮箱、成功学校登录、目前在籍、获准读取课表均不互相自动推定。身份资格仍为 pending/unknown 的用户可以用公共服务和个人任务。

官方依据：[HKUST SSO Integration](https://itso.hkust.edu.hk/services/cyber-security/authentication-service/sso-integration)，支持 OIDC/CAS/SAML，应用需注册；具体申请入口有权限限制。学校管理员确认的租户、issuer、client ID、回调和资格字段尚未获得，运行配置不得使用猜测值。

### 2.2 邮箱登录流程

1. `GET /auth/session` 返回匿名会话及 `csrf_token`，服务端设置临时 Cookie。
2. `POST /auth/email/challenges` 接收 `email`、`purpose=sign_in`，返回 202 和不透露账户存在性的 challenge ID。建议 6 位随机数字、10 分钟有效、单 challenge 最多 5 次核验、发送间隔至少 60 秒；按邮箱及 IP 分层限速。这些是拟议产品参数。
3. 用户在自己的邮箱取码，`POST /auth/email/verify` 提交 challenge ID/code；后端只保存验证码哈希，成功后单次消费并轮换会话 ID。
4. 返回平台会话，设置 `__Host-campus_session` Cookie：Secure、HttpOnly、SameSite=Lax、Path=/、无 Domain。登录失败使用通用文案，日志不得存验证码。

本轮没有发送验证码邮件或配置邮件供应商。此流程不是本轮已通过的账号服务。

### 2.3 学校 OIDC 流程

1. `GET /auth/methods` 显示 hkust 的 `available` 或 `approval_required`；尚未配置时不展示可成功登录的假按钮。
2. 已有同源临时会话后，`POST /auth/oidc/start` 提交 `institution_id=hkust-cwb` 和站内 `return_path`。服务端生成 state、nonce、PKCE S256，绑定会话、issuer、用途与 10 分钟有效期。学校身份登录与账户绑定是不同用途。
3. 返回学校授权页面地址；只允许已批准 issuer 和固定回调。不能接受任意 redirect URI。基础 scope 为 `openid profile`，邮箱声明按需要请求；不顺便索取邮件和课程权限。
4. 上游转到 `GET /auth/oidc/callback?code=...&state=...`。服务端校验 state 单次消费/会话绑定后换取 Token，并通过受维护的 OIDC 库校验签名、issuer、audience、时间、nonce 和租户；失败不建立会话。
5. 账户外部身份以已校验的 `(issuer, subject)` 关联；如使用 Entra 的 tenant/object ID，必须有一致映射。**不以 email 相同自动合并账户**。登录成功轮换会话，清理回调 URL，返回站内页面。
6. 若没有已批准的有效学生资格声明，只记录学校身份验证层级，membership 仍待核验。毕业/撤销后停止校园成员权限，个人账户和本人自建资料按产品规则保留。

推荐平台会话空闲 30 分钟、绝对有效 12 小时，明确为设计参数；敏感账户绑定需近期重新认证。`POST /auth/logout` 立即撤销本会话并清 Cookie，不等同于学校全局登出，也不自动撤销所有外部授权。使用学校与另一邮箱关联已有账户，需要证明双方控制权，首版不自动绑定。

参考：[Microsoft authorization code＋PKCE](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow)、[ID Token claims](https://learn.microsoft.com/en-us/entra/identity-platform/id-token-claims-reference)。不得把 ID Token 当作调用 Graph 的 access token。

### 2.4 个人数据连接

`POST /connections/{provider}/authorize` 与登录分开，provider 为 outlook/canvas；接入 SIS 时须已有学校数据合同。客户端选择明确的 `capability`（如 calendar_basic），不能提交任意 scope。服务端映射允许权限，再开始绑定当前用户和目的的 OAuth。

`GET /connections/{provider}/callback` 验证连接流程，返回连接状态；`GET /connections` 展示覆盖、权限、最近成功时间；`DELETE /connections/{connection_id}` 撤销本平台访问、删除 Token、停止同步并处理派生缓存。上游授权是否已撤销单独返回；无法远程撤销时告知用户官方授权管理入口，不能声称已经全局撤销。

Graph 基础日历为 delegated `Calendars.ReadBasic`，邮件基础为 `Mail.ReadBasic`；持续后台同步需要按策略请求离线访问。邮件正文、附件、写日历不在基础授权内。Canvas 需管理员启用相应 Developer Key 和端点范围，未获准返回 `CONNECTOR_NOT_APPROVED`。SSO 接入成功不解除上述依赖。

## 3. 校巴时间应该如何处理

### 3.1 数据源与发布流程

主来源为 [CSO 校巴页面](https://cso.hkust.edu.hk/index.php/tran/stud_sh_b)、交通公告和校方使用规则/通知。校巴页所链接的 `/policy/g_shb` 本轮返回 HTTP 404，带 `/index.php` 的对应路径返回 HTTP 500，故其具体恶劣天气条款尚未核验，不能自动编码。本轮页面列出的常规服务期为 2026-09-01 至 2026-12-18，周一至周五、公众假期除外；不同线路有学生专用或师生共用条件。学校仍要求乘客使用其认可的证件/二维码验证及相应付款，本 App 登录不是乘车证件。

时刻表处理：获取官方页面 → 提取候选结构 → 比较上个版本 → 人工核对运行日、时间、票价和地点 → 发布有有效期的新版本。页面变化无法明确解析时继续保留旧版本及过期提示，不能静默发布错误班次。校方/运营方提供正式结构化接口后可替换输入流程，保留同一版本与校验机制。

公众假期采用 [1823 官方公众假期数据](https://data.gov.hk/en-data/dataset/hk-dpo-statistic-cal)，接口 `https://www.1823.gov.hk/common/ical/en.json`。这是校巴运行规则所需的日历输入；不能把其他假日清单或用户个人放假当成该校巴停运依据。必须记录覆盖年份，查询年份未覆盖时返回 unknown。

官网还有早班 GPS 入口，属于外部查看能力；本轮不携带其 URL 参数尝试登录，也不把它当公开数据接口。后续向 CSO/运营方确认允许复用的 API、实时覆盖及认证。未获准时 `live_eta_supported=false`，客户端可通过 CSO 官方页面查看入口。

### 3.2 统一记录字段

| 对象 | 必需字段及规则 |
| --- | --- |
| Route | 平台 ID、campus、operator、公开名称、方向、按顺序的 stop_ids、资格、票价范围及币种、实时能力 |
| Stop | ID、名称/别名、文字上落点、坐标（未核验可 null）、官方导航来源 |
| TimetableVersion | route_id、version、Asia/Hong_Kong、valid_from/to、weekdays、exclude_public_holidays、假期覆盖、source、review_due_at |
| Trip | trip_id、service_id、按站序的 stop_times；时间未知填 null，不能推算各中途站发车 |
| ServiceException | 日期/有效时段、适用线路/方向、cancel 或 replace/add、官方来源、核验状态、版本及优先级 |
| Departure | trip_id、stop_id、scheduled_at、prediction_at、basis、service_status、source；计划班次 prediction_at=null |

复合线路的中途上客点属于同一车次不同 stop time，不能拆成两辆独立班车。票价按适用路段/乘客规则表达；0 表示有依据的免费，未知为 null。午间等条目如果适用日期/资格不够明确，记录待核验，不能自动继承其他标题规则。凌晨时间需要明确 service day offset。

### 3.3 对外接口

- `GET /transport/routes?campus=hkust-cwb&operator=hkust-shuttle`：线路、方向、上落点和资格条件。
- `GET /transport/routes/{route_id}/timetable?date=2026-10-02`：适用版本、运行日、车次、票价和来源。
- `GET /transport/routes/{route_id}/departures?stop_id=...&at=2026-10-02T08:19:00%2B08:00`：该上客点、该时刻起的当日计划班次与状态。
- `GET /transport/alerts?campus=hkust-cwb`：有来源的停运/调整，不把天气警告直接转成停课或停运。
- `GET /transport/arrivals?route_id=kmb-91m-outbound-1&stop_id=...`：公共交通预测接口，与校巴计划班次分开。route_id 从平台线路目录取得，服务端映射方向/服务类型、小巴 route_seq 或港铁站码，不能只按路线名称查询所有分支。

计划时刻示例仅展示规范，不是请求本平台实测返回：

```json
{
  "data": {
    "route_id": "hkust-diamond-hill-to-campus",
    "stop_id": "diamond-hill-sheung-yuen-street",
    "service_date": "2026-10-02",
    "status": "scheduled",
    "departures": [
      {
        "trip_id": "dh-0820",
        "scheduled_at": "2026-10-02T08:20:00+08:00",
        "prediction_at": null,
        "basis": "scheduled"
      }
    ],
    "next_service_date": "2026-10-02",
    "source": {
      "source_id": "cso-shuttle",
      "url": "https://cso.hkust.edu.hk/index.php/tran/stud_sh_b",
      "mode": "official_page",
      "source_updated_at": null,
      "fetched_at": "2026-10-02T08:00:00+08:00",
      "status": "fresh",
      "valid_until": "2026-12-18T23:59:59+08:00"
    }
  },
  "meta": {
    "request_id": "example-only",
    "generated_at": "2026-10-02T08:19:00+08:00"
  }
}
```

示例包含完整来源记录；时间仅用于说明合同。示例与测试夹具只选少量官方班次验证表达方式，不能当作全校完整时刻库。

### 3.4 计算顺序与异常

1. 查询参数必须含时区；转换成香港时间再选服务日。不存在的路线/站点组合为 404。
2. 已核验且当前有效的临时停运覆盖常规表；替代班次须有核验来源。冲突无法判定则 unknown，返回冲突来源。
3. 版本或必要的最新公告核验过期时为 stale/unknown；没有下一期表不能沿用当前学期承诺发车。
4. 尚未到适用日期为 not_started；超过日期为 expired。公众假期日历覆盖不明为 unknown。
5. 不运行的星期或公众假期为 no_service。当日计划班次已过为 ended_for_day，不能把明天时间标为今天下一班。
6. 发车列表只含严格晚于查询时刻的班次；到点车辆可能已走，不计作可赶上。未获得车况时始终说“计划发车”，不承诺一定坐得上。
7. 可返回另一个明确的 next_service_date，但不能把它放进当前日 departures。未知/过期/停运时不猜下一班。

天气处理只展示警告与官方规则/通知。未知停运状态需要提示核对；不能依据自己推断就宣布停课。过期实时 ETA 停止倒数，保留来源与错误原因。

## 4. 全部数据模块的产品接口目录

下列均是拟议产品合同；GET 私有数据必须逐用户鉴权，不靠前端隐藏。每个端点的请求/响应字段见 OpenAPI，范围继承产品 v1.1。

| 模块 | API | 数据/限制 |
| --- | --- | --- |
| 登录 | `/auth/methods`、`/auth/session`、`/auth/email/challenges`、`/auth/email/verify`、`/auth/oidc/start`、`/auth/oidc/callback`、`/auth/logout` | 学校与平台账户流程，详见上节 |
| 本人 | `GET /me`、`GET /me/memberships` | 公开资料与当前本人资格；不返回学校密码/完整 Token |
| 连接 | `GET /connections`、`POST /connections/{provider}/authorize`、`GET /connections/{provider}/callback`、`DELETE /connections/{connection_id}` | 授权、覆盖、失败、撤销 |
| 来源与学校 | `GET /sources`、`GET /institutions` | 来源能力/可用性/更新及校区；不暴露管理凭证 |
| 学年 | `GET /academic-calendar` | 学校学年安排，不是本人选修 |
| 课程 | `GET /courses`、`GET /me/enrolments`、`GET /me/assignments` | 公共目录与私人正式数据分离；未接入返回 503 对应错误，不返回空数组冒充没有课程 |
| 邮件 | `GET /me/mail-signals` | 基础字段；不声称读过正文或完整邮箱 |
| 我的日程 | `GET /me/calendar`、`POST /calendar/imports/preview`、`POST /calendar/imports/{import_id}/confirm` | 上传 ICS 后先预览；完整重复/例外语义；本人名额/正式选课状态不能由 ICS 推定 |
| 任务/笔记 | `GET/POST /tasks`、`PATCH/DELETE /tasks/{task_id}` | 本人任务、原文/材料链接、短笔记、截止精度；更新用版本控制 |
| 校园服务 | `GET /places`、`GET /services`、`GET /services/{service_id}/handoff` | 地点、餐饮/设施/洗衣等规则和办理入口；handoff 不产生预约成功 |
| 交通 | `/transport/routes`、`/timetable`、`/departures`、`/transport/arrivals`、`/transport/alerts` | 完整路径见第 3 节；计划与预测分离 |
| 天气 | `GET /weather` | 站点、预报、警告与时间；不代替校方决定 |
| 活动 | `GET/POST /activities`、`GET /activities/{activity_id}` | 条件筛选、发布、容量、原报名主系统；公开/校园范围分离 |
| 参与 | `POST /activities/{activity_id}/participations`、`GET /me/participations`、`DELETE /participations/{participation_id}` | 申请/确认/候补/退出；并发不超员，外部链接不产生已确认报名 |
| 社区 | `GET /posts`、`GET /circles` | 读取有权限的校园墙/圈子；发帖/聊天完整写入合同在 U4 深化，不伪称本文件已实现整个社交后台 |
| 我想做 | `GET/POST /demand-intents`、`DELETE /demand-intents/{intent_id}` | 本人意向、必要条件、分享同意及到期/撤回；不自动报名 |
| 纠错举报 | `POST /reports` | 来源错误或社区问题及处理回执；访问按受限职责 |

课程文件、平台付费、设施预订写入、聊天完整生命周期属于后续模块，当前返回能力与办理方式，不提供虚构供应商接口。完整目标仍保留于总体方案。

## 5. 上游 API 对照

| 来源 | 读取接口/入口 | 凭证与覆盖 |
| --- | --- | --- |
| HKUST SSO | 已批准 issuer 的 discovery/authorize/token/jwks | 校方应用注册；不在合同内硬编码猜测 tenant ID |
| HKUST 学年/活动 | `calendar.hkust.edu.hk/events/ics?ics_mode=academic_calendar` 与 `/events/rss?ics_mode=academic_calendar` | 公开；两者实际内容范围不同 |
| SIS/设施 | [学校 API Portal](https://hkust.developer.azure-api.net/)与拥有部门 | 接口/字段需批准，未知时能力状态为 approval_required |
| Canvas | 获准实例 `/api/v1/courses`、`/courses/{id}/assignments`、`/calendar_events` | scoped Developer Key + 本人 OAuth；分页/日期例外需处理 |
| Graph | `https://graph.microsoft.com/v1.0/me/calendarView`、`/me/mailFolders/inbox/messages` | 本人 delegated Token；nextLink 分页与读取范围分别记录 |
| KMB | `https://data.etabus.gov.hk/v1/transport/kmb/route/`、`/route-stop/{route}/{direction}/{service_type}`、`/eta/{stop_id}/{route}/{service_type}` | 公开；服务类型、方向、备注和源时间不可丢 |
| GMB | `https://data.etagmb.gov.hk/route/{region}/{code}`、`/route-stop/{route_id}/{route_seq}`、`/eta/route-stop/{route_id}/{route_seq}/{stop_seq}` | 公开；ID 从来源读取，不永久硬编码 |
| Citybus | `https://rt.data.gov.hk/v2/transport/citybus/route/CTB`、`/eta/CTB/{stop_id}/{route}` | 公开；V2，不用旧 NWFB 接口 |
| MTR | `https://rt.data.gov.hk/v1/transport/mtr/getSchedule.php?line=TKL&sta=TKO&lang=en` | 公开；服务异常/空数据不等于请求格式失败 |
| HKO | `https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=rhrread&lang=en`，warnsum/flw/fnd | 公开；观测站与更新时间保留 |
| 公众假期 | `https://www.1823.gov.hk/common/ical/en.json` | 公开；每次核验覆盖年份 |
| 地址 | `https://www.als.gov.hk/lookup?q={address}`，Accept JSON | 公开；多个候选由用户/地点核验决定 |
| Luma | `https://public-api.luma.com/v1/calendars/events/list`、`/v1/events/get` | Luma Plus 与获授权 Key；不代表全港活动库存 |
| Meetup | 官方 GraphQL 与获批 OAuth consumer | Pro 与审批；首版不依赖其未批准接入 |

所有来源的官方文档及许可门槛集中在数据报告。公共数据无 Key 实测成功不代表无限频率使用；敏感连接仅服务端访问，来源选择使用允许名单，不能接受用户任意提供内部地址。

## 6. 测试边界与验收

本轮执行三层检查：公开来源实时探测；OpenAPI 字段/引用/示例与负例验证；独立校巴规则样例验证，并运行仓库既有测试。**规则验证器是用于检验规格的独立参考模型，不是产品服务。** 它不能证明未来实现的 OAuth、会话、权限或并发报名已安全可用。

真实登录端到端必须在学校应用批准和测试环境实现后验证：正常授权/MFA、拒绝授权、state/nonce 错误、过期/重放、issuer/tenant/audience 错误、密钥轮换、会话固定攻击、CSRF、邮箱同名不自动合并、资格过期和跨账户访问、Token 撤销/刷新失败、退出后会话失效。当前全部标为 blocked/not_implemented，不计入通过率。

校巴产品上线还需：所有计划开放线路完成双向时刻/站点核验；临时公告有维护责任；公众假期覆盖正确；实际页面显示和时区处理通过；与官方规则核对。参考样例只覆盖少量线路，不声称已完成全部导入。

## 7. 复跑与交接

```sh
python3 scripts/verify-api-contract.py
python3 scripts/probe-public-apis.py
npm test
```

前两项使用当前环境已有的 Python `jsonschema`、`certifi`、`beautifulsoup4`；不需要学校凭证，不发送邮件，不创建外部账户。探测结果为执行时快照，写入 `docs/api/test-results/`，网络失败会在报告中明确失败并返回非零状态；机构未批准项列为 blocked。

上述结论记录的是最初 API 研究阶段。2026-10-03 已实现本地开发认证、个人安排、ICS、校园交通与目录、活动/校园墙及治理端点；实际可调用合同以 [implemented-mvp-api.md](implemented-mvp-api.md) 及其模块链接为准。本文件和早期 OpenAPI 仍包含规划能力，不能视为全部已接入。学校私有连接、正式邮件与原生 iOS 运行验收仍未完成；当前逐项状态见 [首版验收清单](../progress/2026-10-03-mvp-acceptance-matrix.md)。


## Implemented local reminder projection

Authenticated `GET /api/v1/me/reminders` and the native local scheduler are described in [reminders-api.md](reminders-api.md). This includes permission, per-account enablement, cancellation, bounded scheduling, failure behavior and evidence. Actual iOS delivery acceptance remains pending.
