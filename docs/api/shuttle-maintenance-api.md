# 校巴时刻与公众假期维护（已实现）

2026-10-03。本地开发 API；继承[校园维护](campus-maintenance-api.md)的管理员 Bearer 鉴权、固定同源网页代理及 CSRF 规则。没有学校 GPS、实时余位或自动发布官方 HTML。

## 数据读取与持久化

迁移9建立单行 `shuttle_catalog`。首次创建复制已经核验的24条方向/上车点记录和51条假期，后续启动不覆盖编辑。公开 `GET /api/v1/transport/routes` 和 `GET /api/v1/transport/routes/:id/departures?at=<带偏移时间>` 均读取 SQLite 中当前目录。既有收藏/纠错目标 ID 保持不变。

维护快照为 `{revision:number,catalog}`。公开 `catalog.version` 保存后为 `maintenance-N`。每条线路包含自己的 `source` 和 `refresh_due_at`；目录顶层 source 仍为初始来源快照，具体线路以线路内的 source 为准。时刻详情响应返回该线路来源。目录 refresh_due_at 是全部线路及假期截止时间的最早值，因此一条旧线路会让整体 freshness=stale，但已单独核对线路的详情可正常查询。

## 管理接口

以下路径相对 `/api/v1`，均需要管理员。网页对应 `/api/campus` 代理路径。

| 方法/路径 | 请求 | 返回 data |
| --- | --- | --- |
| GET `/admin/campus/shuttle` | 无 | revision 与完整 catalog |
| POST `/admin/campus/source-checks` | `{target_kind:"shuttle_timetable",target_id:"catalog"}` | 固定 CSO 来源证据 |
| POST `/admin/campus/source-checks` | `{target_kind:"shuttle_holidays",target_id:"calendar"}` | 固定1823来源证据 |
| POST `/admin/campus/shuttle/routes/:id/preview` | `{revision,fields,at}` | 未保存的候选班次查询结果 |
| POST `/admin/campus/shuttle/routes/:id` | `{revision,fields,source_check_id,reason}` | 保存后的完整维护快照 |
| POST `/admin/campus/shuttle/holidays` | `{revision,years,holidays,source_check_id,reason}` | 保存后的完整维护快照 |
| GET `/admin/campus/history?target_kind=shuttle&target_id=:id` | 现有线路 ID | 最近50条线路审计 |
| GET `/admin/campus/history?target_kind=shuttle_holidays&target_id=calendar` | 无其他参数 | 最近50条假期审计 |

来源 URL 固定为 `https://cso.hkust.edu.hk/index.php/tran/stud_sh_b` 与 `https://www.1823.gov.hk/common/ical/en.json`。禁止调用者传入任意URL；沿用8秒、1MB、拒绝重定向、非空200响应及每管理员每小时30次成功捕获记录的限制。仅捕获不更新公开目录。

## 线路字段与预览

`fields` 为完整线路可编辑内容，不能携带 id/source/refresh_due_at 或额外字段：

```json
{
  "name":{"zh":"坑口 → 科大","en":"Hang Hau → HKUST"},
  "origin":"Ming Shing Street (next to East Point City)",
  "destination":"HKUST",
  "departures":["08:30","08:35","08:40"],
  "fare_minor":0,
  "eligibility":"student_only",
  "note":"",
  "valid_from":"2026-09-01",
  "valid_to":"2026-12-18",
  "weekdays":[1,2,3,4,5],
  "exclude_public_holidays":true
}
```

示例只说明结构，后续真实维护必须重新核对官方来源。双语名称、origin/destination 各1–2000字符；note最多2000字符。费用为港币分，0–100000整数或 null（未知），0代表免费。资格为 student_only 或 student_or_staff。

departure须1–200项，24小时 `HH:mm`，严格升序、无重复。日期必须是真实日历日期，结束不得早于开始。weekdays用0=周日到6=周六，1–7项且不重复。exclude_public_holidays=true同时排除公众假期和周日；false时按所选运行日运行。

preview使用同一公开查询算法，不写目录、不刷新有效期。`at` 要求带时区偏移的 ISO 时间；按香港日期计算。修改字段/查询时间后前端会清除旧预览与人工勾选；正式保存前需再次预览。预览沿用当前来源期限，不能把过期预览当作已发布的新证据。

## 保存、假期与有效期

所有保存要求全目录 revision 匹配、reason去空白后5–1000字符、对应来源证据不早于24小时前。线路保存只刷新该线路的来源与7天复核期限；不会把其他线路重新标记为已核对。catalog revision全局递增，跨线路/假期同时编辑也可能产生409，避免覆盖未看到的变更。保存与审计同事务。

假期写入替换完整清单：years为1–10个不重复的2000–2100年份，holidays为1–400条 `{date:"YYYY-MM-DD",name:"..."}`。日期不能重复、不能落在覆盖年份以外，每个覆盖年必须有条目。服务器能验证格式和对应关系，**不能凭几条记录证明整年完整**；管理员必须逐年对照官方清单。保存按日期排序，记录1823证据并设置30天复核期限，不更新任何线路时刻期限。

遵守假期规则的线路在假期证据过期或查询年份未覆盖时隐藏 upcoming。线路过期、非运行日、假日、学期外和末班结束仍保留带标签的完整 timetable，不制造即将发车状态。

## 失败与界面保护

400参数错误；401会话失效；403无管理权限/代理CSRF或同源失败；404未知线路；409目录版本变化或来源证据失效/类型不符；429来源限流；502来源读取失败。代理超时可能503，结果不确定时应回读版本与历史。无自动回滚或幂等回执，不盲重试覆盖。

后台草稿保留在内存：切换后台栏目后继续保留，重新加载有页面内放弃确认，校验失败保留输入并禁止保存过期预览。退出、账户失效、浏览器刷新仍会丢弃草稿，不承诺持久草稿箱。一次只能编辑一个线路或完整假期表；有草稿时禁用目标切换并说明原因。尚不支持新增/删除路线、临时停运公告独立工作流或审计回滚。

## 验收证据

- `tests/product-shuttle-maintenance.test.ts`：5个集成测试覆盖预览不变更、学生读到修改、重启保留、鉴权、证据类型/时效、日期/班次校验、冲突、独立期限、假期规则及审计。
- `tests/product-web.test.ts`：浏览器代理预览/保存和所有新增POST的Origin/CSRF拒绝。
- `docs/progress/evidence/shuttle-maintenance/`：228测试/44文件、Next构建、原生TypeScript和iOS导出；真实Chrome线路/假期保存、公开API回读、官方假期逐项比对、390px布局。
- 此证据不替代iOS运行、键盘/VoiceOver或通知交付验收；Xcode仍按用户指令暂缓。
