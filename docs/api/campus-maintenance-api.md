# 校园资料维护 API（已实现的本地版本）

更新：2026-10-03。适用于现有地点编辑、官方来源核对与地点/校巴纠错处理。本页不包含新增/删除地点；校巴时刻与假期表的已实现接口见 [校巴维护 API](shuttle-maintenance-api.md)。接口成功不代表原生 iOS 体验已验收。

## 权限与传输

基础路径 `/api/v1`；以下六个管理端点均要求有效 Bearer 管理员会话，普通成员返回 403。使用现有成功/错误响应封装，数据位于 `data`。仅支持本地开发账户，不是学校 SSO。

网页通过 `/api/campus/admin/campus/...` 固定代理调用。代理使用 HttpOnly、SameSite=Strict 会话 Cookie，校验 Host；POST 额外要求精确同源 Origin、JSON Content-Type 和 `X-CSRF-Token`。CSRF 值从 `/api/campus/session` 获取，每次管理请求仍由上游检查角色。当前配置仅接受 loopback HTTP，不能直接作为公网部署方案。

## 接口

| 方法与路径（相对基础路径） | 输入 | 返回 data |
| --- | --- | --- |
| GET `/admin/campus/places` | 无 | 当前全部地点，含双语字段、version、freshness 和 source |
| GET `/admin/campus/corrections` | status=pending/resolved/rejected（默认 pending）；limit 默认20、最大50；cursor 为 UUID | `{items,next_cursor}`；按 ID 游标排序，并非时间排序 |
| GET `/admin/campus/history` | target_kind=place/shuttle；target_id | 最近50条审计，按记录 ID 倒序 |
| POST `/admin/campus/source-checks` | `{target_kind,target_id}` | `{id,target_kind,target_id,url,sha256,retrieved_at}` |
| POST `/admin/campus/places/:id` | 当前 version、source_check_id、reason、完整 fields | 保存后的地点，version 加1 |
| POST `/admin/campus/corrections/:id/resolve` | 当前 version、status、resolution、source_check_id | 保存后的纠错，version 加1，带 reviewed_at |

`target_kind` 只接受 place 或 shuttle，target_id 必须是既有目标。校巴来源核对与纠错处理不会修改实际班次。

## 官方来源核对

客户端不传 URL。服务器从现有地点/校巴目录取得固定 URL，禁止跟随重定向；8秒超时、仅接受200、正文非空且最多1,000,000字节。成功捕获保存原始正文（数据库 base64）、SHA-256、来源 URL、核对时间和操作者。接口只返回元数据，不返回原始正文。

每个管理员每小时最多30次已成功捕获记录；计数发生在抓取前，目前不是严格的并发额度预留。抓取失败返回502 `SOURCE_UNAVAILABLE`，已有资料不变。仅捕获来源不会刷新地点版本或资料有效期，也不表示人工已阅读内容。

## 地点保存

请求示例（UUID 使用本次抓取返回值）：

```json
{
  "version": 1,
  "source_check_id": "00000000-0000-4000-8000-000000000001",
  "reason": "核对官方来源后统一双语位置表述",
  "fields": {
    "name": {"zh": "邮务柜台", "en": "Postal counter"},
    "location": {"zh": "主校园 2 楼 2615 室，近 31、32 号电梯", "en": "Main Campus, Room 2615, 2/F, near lifts 31 and 32"},
    "description": {"zh": "邮件、包裹及邮票服务", "en": "Mail, parcel and stamp services"},
    "published_hours": {"zh": "请核对官方公布时间", "en": "Check the published official hours"},
    "map_url": null,
    "action_url": "https://cso.hkust.edu.hk/index.php/mail/pos_ctr"
  }
}
```

这是结构示例，不可不经核对直接替换已有资料。四组双语字段各1–2000字符，reason 去首尾空白后5–1000字符；字段严格校验，不接受额外字段。链接仅接受 HTTPS、无用户名密码、hkust.edu.hk 或 ust.hk 及其子域；map_url 可为 null。

要求版本匹配，来源捕获与目标一致且不早于24小时前，来源 URL 未变。保存和审计在同一事务提交；review_due_at 为捕获时间后30天，`open_now`、`availability` 均保持 `unknown`。双语校对勾选是前端人工流程，不是后端自动内容验证。

## 纠错处理与学生回读

```json
{"version":1,"status":"resolved","resolution":"已核对官方来源并修正双语位置。","source_check_id":"00000000-0000-4000-8000-000000000001"}
```

仅 pending 可以处理。status 为 resolved 或 rejected；resolution 去首尾空白后5–1000字符。resolved 必须携带24小时内匹配目标的 source_check_id。rejected 可以省略或传 null；如传入则仍校验。地点保存与纠错处理是两个独立操作，不会互相自动完成。

学生通过 `GET /api/v1/me/campus/corrections` 只读取本人记录，包括 status、resolution、version、reviewed_at。处理时间及审计时间为 Unix 毫秒，地点 source.retrieved_at/review_due_at 为 ISO 时间。审计记录操作者、原因、前后状态及 source_check_id；纠错审计不复制原始反馈正文或提交者 ID，处理说明本身会留存。审计最多返回最近50条，暂无分页导出。

## 冲突与重试

- 400：参数无效；401：会话无效；403：非管理员/网页同源或 CSRF 失败；404：目标不存在。
- 409 `VERSION_CONFLICT`：旧版本或纠错已处理。重新读取后再决定，不能盲目覆盖。
- 409 `SOURCE_CHECK_REQUIRED`：来源捕获缺失、目标不符或超过24小时；`SOURCE_CHANGED`：地点来源 URL 改变。
- 429 `SOURCE_CHECK_LIMIT`：来源捕获额度已用完；502 `SOURCE_UNAVAILABLE`：官方来源未能捕获。
- 网页代理不可达/超时可能返回503，此时写入结果未必确定。先重新读取版本、处理结果和历史；管理写入没有创建类幂等回执，不能把重试409当成保存成功。

## 验证与剩余边界

`tests/product-maintenance.test.ts` 覆盖角色/归属隔离、来源失败和限制、版本冲突、审计和重启持久性；`tests/product-web.test.ts` 覆盖三个写入入口的 CSRF/Origin 拒绝及代理完整流程。自动测试使用固定来源响应，独立于真实来源可用性。

真实本地 Chrome 管理流程已执行：官方来源捕获 → 邮务柜台位置文字修改 → 纠错处理 → 管理历史 → 学生本人 API 回读。证据见 `../progress/evidence/campus-maintenance/browser-acceptance.md`。本轮222项测试、Next生产构建通过。校巴时刻/假期维护由上述独立接口交付；iOS运行时和公网部署未验收。
