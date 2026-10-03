# HKUST账号登录与SIS正式课表接入

日期：2026-10-03。状态：接入方案，尚未实现、注册或获批；未执行真实学校账户联调。本文补充 `super-app-api.md`，不代表已有上游API地址。

## 学生流程

使用HKUST账号登录 → 系统认证浏览器中的学校官方登录/MFA → 确认读取本人课表的用途 → 返回App自动同步 → 今天/周课表显示本人课程。

用户不必另建密码或整理文件。若学校批准的是逐用户授权模式，进入其正式授权流程；若批准的是服务端数据访问模式，平台记录学生同意并按校方认可的身份映射访问。不能预先承诺存在“SIS OAuth授权页”，也不能保证学校策略不要求再次认证。Canvas作业/DDL另行连接，正式课表不依赖Canvas是否发布课程。

## 核验结论

- [ITSO SSO](https://itso.hkust.edu.hk/services/cyber-security/authentication-service/sso-integration)支持OIDC并推荐用于移动App，主要IdP为Microsoft Entra ID。注册入口标注Limited to CSC only；学生团队的申请人、责任人及是否需要部门支持须向ITSO确认。
- [API Gateway说明](https://itso.hkust.edu.hk/services/it-infrastructure/api-gateway-api-portal)要求先征得系统拥有者同意并采用约定访问方式。尚未取得本项目可用的SIS API产品、端点、scope、授权模式或测试环境。SSO身份令牌不能直接当SIS API凭证。
- [CEI FAQ](https://cei.hkust.edu.hk/en-hk/alh-and-edtech/faqs-students)说明正式课表来自SIS，Canvas Calendar提供作业和事件。

## 学校申请包

先通过ITSO公开联络点 `cchelp@ust.hk` 确认申请路径，请其协调Academic Registry及实际SIS数据拥有者。本文仅准备内容，未发送邮件或提交表单。

1. 说明团队、负责人、学生iOS应用用途、部署方及测试范围；确认申请资格与责任主体。
2. 申请OIDC配置：issuer、租户、client ID、批准的回调、客户端类型、PKCE/MFA要求，以及稳定身份声明和到本人SIS记录的获批映射。
3. 申请只读本人课表。所需信息（非已确认上游字段名）：学期、课程/班别标识、选课状态、日期时间、地点、教学周/重复规则、例外/取消/变更。考试安排若不在此授权内单独申请；首轮不请求成绩、选退课写权限或财务信息。
4. 请求API文档、访问认证方式、本人记录约束、分页、删除语义、配额、源更新时间、测试用户和故障联系人。确认逐用户授权/撤销是否存在，或是否采用服务器凭证访问。
5. 按学校[数据访问要求](https://itso.hkust.edu.hk/services/it-infrastructure/smart-campus-infrastructure/open-data-platform/data-access-form)说明频率、期限、存储保护、删除方式及第三方云处理。拟议参数不等于获批配置。

## 拟议实现约束

- 复用现有拟议OIDC入口，使用学校批准的Authorization Code流程、PKCE/state/nonce、固定回调及成熟OIDC库验证。iOS使用系统认证浏览器；不自建学校密码输入框或收取学校登录Cookie。
- 推荐后端管理学校令牌与数据连接。若使用后端回调返回App，返回短时、单次且绑定发起端验证信息的兑换凭据，不在URL携带长期会话令牌。客户端secret不打包到App。原生返回协议待学校注册配置确认后定稿。
- 用户身份依据验证后的issuer/subject，通过获批映射确定本人SIS记录，不信任客户端提交的学号作为读权限，不按邮箱直接合并账户；学校登录不自动证明当前在籍。
- SIS许可与平台会话独立记录。拟议连接状态：approval_required、not_connected、syncing、connected、partial、reauth_required、revoked、error。记录许可版本、同意时间、最近尝试及最近成功时间；SSO成功不能直接置SIS为connected。
- 首次授权自动同步；前台刷新及后台同步遵守实际配额和iOS运行限制，不承诺实时。完整抓取成功前不以部分结果删除旧课表；断网标旧数据，未连接不能显示“今天没课”。
- 来源记录与个人笔记/提醒分开；按源端语义更新改期、退课及取消。私人课表不自动进入社交展示或匹配。
- 撤销后停止同步，使在途任务不能重新写回，移除相应令牌；缓存及备份按获批政策删除。退出/换号隔离私人视图与本地缓存。

## 验收顺序

1. 校方确认申请资格、SSO注册和SIS访问合同；此前合同或mock不能称真实连接。
2. 获批环境测试学校登录、取消/MFA失败、错误issuer、回调重放、过期恢复及身份映射。
3. 获准账户A自动同步，对照SIS核对课程、班别、地点、时区和例外；账户B不得读取A的数据。
4. 覆盖分页、部分失败、限流、变更/取消、重复同步、拒绝授权、令牌过期、撤销及在途请求；日志/公开证据不含凭据和原始私人课表。
5. 实际iOS验证学校页返回、冷启动返回、首次同步反馈、恢复、换号及提醒更新；浏览器mock和编译不能抵扣。

当前结果：公开资料核验与方案文档完成；没有真实SSO/SIS测试结果。下一项外部依赖为学校确认资格与数据合同；Xcode是之后原生验收的另一独立依赖。
