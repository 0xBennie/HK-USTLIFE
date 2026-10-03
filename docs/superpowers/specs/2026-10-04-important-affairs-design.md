# X05 重要事务：版本化说明与私人进度

状态：依据已授权 PRD R1/R1.1 整理的实施合同；已补六个 Pen 核心状态；API、原生流程和完整异常交互尚未实现。2026-10-04。
关联：J06、C06/C07/C10、X05、AC02/03/10/19。首批是办事指南与本人进度，不申请学校写权限，不代办、不收费。

## 1. 用户任务与范围

学生需要知道适用条件、准备什么、去哪里办理、是否真的完成，以及规则变化对本人意味着什么。App 保留官方原文入口，集中本人已经做到哪一步。

首批两种重复发生的有限场景：图书续借核对、学生卡挂失与补办核对。它们来自现查官方公开来源，不是学生需求已验证的结论。试用需检验是否减少来回查找和误判结果。

完整 PRD 的住宿、交换、奖学金等继续保留；没有维护好的内容时不生成假模板。无登录可看说明，保存个人进度需平台账户；邮箱登录不证明官方资格。

## 2. 方案选择

- 选用版本化人工核验模板＋私人事务实例：能明确引用、版本差异和个人状态，初始维护成本可控。
- 单纯链接目录无法保留准备进度或解释规则变化，不满足 X05。
- 自动爬取/AI 生成所有流程会引入错误资格、期限与结果；后续可以辅助发现变化，但必须人工审核发布。首版不采用自动发布。

## 3. 首批来源边界

详见 `docs/product/affairs/source-register.json`。说明为短摘要，逐项挂来源，不复制完整官方文章。

图书续借：从 Library My Account 操作并核对系统回复。不能从打开链接、勾选步骤推断续借成功；个人到期日必须来自本人核对/输入或未来获批读取，不设统一借期。

学生卡：挂失与申请补卡是两件事；进入官方入口办理。Academic Registry 与 HKUST Card 页面对支付/随附材料描述详略不同，卡模板标注 source_conflict（表示材料描述待人工核对，不断言两份来源矛盾），付款或材料以当前官方办理页/Registry 答复为准，不自动选择某版本。App 不收卡号、证件或支付凭证图片。

## 4. 数据对象

**AffairTemplateRevision** 不可变公开版本：template_id、revision、school_id、zh/en 标题及摘要、适用范围文本、条件、材料、steps（稳定 step_id）、deadline（none / per_user / fixed）、sources、reviewed_at、review_due_at、source_health（verified / stale / conflict / unavailable）、published_at、retired_at。

每个条件/材料/步骤指向 source_id。公共版本号来自业务字段变化；网站导航、页脚等噪声不产生业务更新。review_due_at 是本产品复核日期，不能标成官方截止。缺日期表示未知，不等于永久有效。

**AffairInstance** 私有：id、owner_id、template_id、accepted_revision、version、label（可选，最多120字）、step_checks（step_id 与checked）、submission（not_reported / self_reported，reported_at可空）、self_reported_outcome（unknown / received / approved / rejected / completed，note可空）、personal_due（nullable 日期或精确时刻＋Asia/Hong_Kong）、note（最多2000字）、archived_at、created_at、updated_at。

三个事实分别呈现：准备步骤由本人勾选；提交由本人报告；official_status 仅来自独立官方证据。个人报告“我已完成”仍显示“本人记录”，绝不变成“学校已确认”。同一模板可建立多次实例，例如不同书籍续借，不能按template_id自动合并。首版最多100个未归档实例/人以限制误操作。

**OfficialEvidence** 未来接入合同：instance_id、issuer、subject_binding、external_reference、status、effective_at、verified_at、adapter_id。只允许经批准、服务端验证的适配器写入。R1.1 没有适配器，official_status 返回 unknown、reason=not_connected；用户及普通管理员不能写。本人记录的回执文字依然是 self_reported，不能进入此表。

**RevisionAcknowledgement**：instance_id、from_revision、to_revision、acknowledged_at、actor=owner。保留此次接受时的差异摘要。只是“已看过并采用说明”，不是学校已接受申请。

## 5. 生命周期

目录 → 说明/来源 → 创建私人实例 → 准备清单 → 外部官方办理 → 本人记录提交/结果 → 可归档或重新打开。

- 打开外部链接不修改任何进度。
- 步骤全部勾选不自动设置 submitted、completed 或 official_status。
- 本人记录已提交前预览：这是个人记录，学校状态未知。可更正/撤回本人记录，保留版本冲突保护。
- 归档只影响私人列表；不会取消任何学校申请。删除同样不代表撤回外部申请。
- 过期来源仍可查看旧说明和原文，显著显示核对提示；允许继续保存本人进度，禁止显示“规则已确认”。
- conflict / unavailable 模板禁止创建新实例，返回409 SOURCE_REVIEW_REQUIRED；可读公开说明和既有私人进度。stale 模板需先复核再开放新建。
- 模板停用后禁止创建新实例；旧实例及其已接受说明仍可读、归档、导出和删除。

## 6. 变更与本人确认

已有实例始终按 accepted_revision 呈现完成情况，响应同时提供 current_revision、change_summary、requires_review。

新版本修改条件/材料/步骤/期限/官方链接：逐字段提供 old/new、原因、来源。原有本人笔记、提交与自报结果不被覆盖。删除步骤保存在旧版本历史，不能悄悄从完成数中移除。

接受更新是独立带版本写操作：客户端必须提交看到的 from/to_revision 和 instance_version。保留未改动step_id的勾选；内容改变的步骤需用户在预览明确选择保留勾选或重置；新增步骤默认未勾选，删除步骤从当前清单移出但历史可核对。默认不替用户确认。

个人日期不因模板变化自动改动。用户可选新日期并在同一预览确认，随后更新其日程/提醒。日程必须标“个人办事提醒”，不冒充官方截止。本人撤销提醒只影响个人安排。

首版来源更新由受限内容维护流程发布，记录审核人、来源与差异。不能用通用管理员角色修改学生私人进度或代替学生确认版本。

## 7. API 合同（全部拟议，尚未注册）

统一 `/api/v1`，沿用项目 data/meta、错误码、会话权限、幂等收据及SQLite事务。

| Method / path | 权限与行为 |
|---|---|
| GET /affairs/templates | 公开已发布目录，limit1–50，cursor按稳定(template_id,revision)，q/学校/类型筛选；不含个人数目 |
| GET /affairs/templates/:id | 公开当前已发布版；下架返回410并提供原文入口，不包含任何人的进度 |
| GET /me/affairs | 本人分页实例，active/archived；stable(created_at,id)游标；不接受owner参数 |
| POST /me/affairs | 本人创建；template_id、revision、label；必需幂等键；过时版409，停用410 |
| GET /me/affairs/:id | 本人实例、已接受版本、待确认差异、来源时效、official_status；他人ID统一404 |
| PATCH /me/affairs/:id | 本人私人字段，必需version；严格字段白名单，禁止official_status与owner修改 |
| POST /me/affairs/:id/accept-revision | instance_version、from_revision、to_revision、changed_step_choices、可选日期调整；原子写和幂等键 |
| DELETE /me/affairs/:id | 本人、version；删除私人实例与个人提醒，不能删除公共模板或代办学校撤回 |

错误：401 AUTH_REQUIRED、404 NOT_FOUND、409 VERSION_CONFLICT/TEMPLATE_CHANGED、410 TEMPLATE_RETIRED、400 INVALID_INPUT、409 WRITE_KEY_REUSED、503 SOURCE_UNAVAILABLE（仅需要在线来源的动作）。只读旧说明不会因为源站离线而丢失。

创建、版本接受使用现有持久化幂等规范；相同键相同内容返回同一结果，相同键不同内容409。私人PATCH带version，重试未知结果先读服务器，不能重复创建或盲目覆盖。服务端以会话owner为准。

## 8. 端内布局与导航

校园现有服务区新增“办事清单”入口；本人保存项在我的可访问。保持五个主入口。今天只显示本人明确保存的临近日期事项，不插入无限办事推荐。

Pen需补并截图核验六组状态：目录/空，来源与条件详情，私人进度，自报提交确认，版本差异与接受预览，来源过期/冲突/停用。每组同时说明加载、错误、未登录、写入结果未知、版本冲突和返回保留输入。

外部页面返回不能显示“已提交”，应仍显示原状态和“记录我刚才的操作”。模板来源与私人进度视觉分区；官方未知状态用正文说明，不做绿色完成徽章。

长清单支持逐项勾选、VoiceOver读出本人状态。动效只帮助展开/收起，减少动态时直接切换。不以庆祝动画暗示学校审批成功。

## 9. 权限、保留与集成

新表通过用户外键级联删除；本人导出包含实例、接受历史、本人记录、关联公共版本，不含其他用户进度/官方适配器秘密。普通内容维护人员只能看公开模板，不能搜索私人备注。

来源URL需https且域名/跳转经公开源审阅；个人提交的任意URL不由服务端抓取，不上传学校回执或证件。首版个人回执只允许简短文字，明确不要填写密码/卡号。

已有提醒控制器和今天投影复用：由事务来源生成稳定item_id，只在个人选择日期与提醒后进入投影。原私人记录不复制到通用task再双向漂移。删除/归档清理未来提醒；改日期撤销旧计划再安排新计划；失败保留可核对状态。

学校身份与事务官方确认独立；未来接上SIS不能自动赋予本模块查询或办理权限。

## 10. 实施顺序与交付

A. 已完成：核对PRD、现有模块缺口、首批官方来源，定义合同与下面的验收集。
B. 进行中：Pen 六个核心状态已保存，节点与转场见 design/affairs/README.md；仍需异常状态、输入控件和入口交互验收。随后落 schema/迁移/目录与 private store。
C. 后端：权限、版本、幂等、来源差异、导出删除、日程/提醒投影；测试必须先证明不把个人状态写成官方结果。
D. 原生：目录→创建→勾选→外部返回→自报→变化确认→归档；用户真实状态与服务端相同。
E. 验收：两个账户、重启、弱网、变化冲突、过期来源及删除；实际iOS和有限学生任务试用分开报告。

## 11. AC19 专项验收用例

1. 未登录可读说明，创建返回401；邮箱账户不能被标官方资格已核验。
2. 两人同模板有各自实例；随机他人实例ID读/写/删除均404。
3. 点击官方链接、勾选所有步骤、自报提交、自报完成均不能把official_status改为confirmed。
4. 直接PATCH官方状态/owner等未知字段400；内容管理员没有私人进度读取权。
5. 续借根据本人日期展示，未知到期日不产生虚假倒计时；无通用借期推断。
6. 挂失与补卡各自步骤；材料来源差异明确，不把支付成功或页面访问当补卡已受理。
7. 创建超时重试同键只产生一条；不同内容同键409；过期收据先核对现有记录。
8. 模板v2发布后用户v1勾选不变；显示具体old/new与来源，不静默采用新期限。
9. 两端同时接受更新/改进度只有一端成功，另一端409且草稿保留；已改步骤必须逐项选择保留/重置。
10. 接受更新中断或写失败不会一半换版本、一半保留错误步骤；当前版本再变化要求重新预览。
11. 源站不可达/过期/模板停用：旧进度可读、原文可核对、新建限制正确。
12. 归档/删除取消私人提醒且不声称取消学校申请；账户删除级联清理，其他用户不受影响。
13. 改个人日期后今天与系统提醒使用同一记录；离线/结果未知不显示已同步。
14. Native前后台、返回草稿、键盘、大字体、英文、VoiceOver、减少动态可操作；不以截图抵扣操作证据。
15. 学生试用分别记录查找时间、遗漏条件、本人误判状态、来源冲突处理；没有试用不声称价值已验证。
