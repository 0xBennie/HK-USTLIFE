# HKUST Skills Hub

HKUST Clear Water Bay 主校区学生生活的 **MCP server + Agent Skills + Web Hub**。它把本来分散在 ARO、CSO、SHRLO、Library、DSTO、HSEO、ITSO 等处的**官方入口**变成 Agent 可调用的工具；并在获得学生本人授权后，提供只读的 Outlook 邮件信号与日历信号。

> 只覆盖 Clear Water Bay 主校区；不覆盖 HKUST(GZ)。

## 为什么不是再做一个 USThing

HKUST 已有 [Student App](https://studentapp.hkust.edu.hk/functions) 与学生开发的 [USThing](https://usthing.xyz/)。本项目不复制一个万能 App，而是做一个有来源、可被 Codex/Claude/ChatGPT 调用的“学生生活操作层”：先告诉你这件事应该找谁、依据是什么、链接在哪里；再把你的课表、天气、提醒和邮件信号合成行动建议。

## 三个组成部分

| 部分 | 是什么 | 入口 |
| --- | --- | --- |
| MCP server | 7 个 source-grounded 工具，stdio 或 Streamable HTTP | `src/`，见[下方](#运行) |
| Agent Skills | 7 个可安装的 Skill 包，Claude/Codex 自动触发 | [`skills/`](skills) |
| Web Hub | Next.js 站点，展示 Skill 目录、新生流程、选课流程与来源治理 | [`apps/hub/`](apps/hub) |

## 可安装的 Skills

每个目录含 `SKILL.md` 与 `agents/openai.yaml`，可直接复制到 Claude Code 的 skills 目录或注册到 Codex。

| Skill | 何时触发 |
| --- | --- |
| [`skills/hkust-today`](skills/hkust-today) | 今天要做什么、下一节课、天气是否影响出行、把确认过的日程变成提醒 |
| [`skills/hkust-newcomer`](skills/hkust-newcomer) | 新生不知道第一周要办哪些账号、住宿、报到事项 |
| [`skills/hkust-campus-status`](skills/hkust-campus-status) | 天气、停课、校车、路线、开放时间、校园服务 |
| [`skills/hkust-academic`](skills/hkust-academic) | 学务规则、校历、选课、截止、先修、考试、负责办公室 |
| [`skills/hkust-opportunities`](skills/hkust-opportunities) | 官方活动、社团、身心支持、职业、交换、奖助学金与联系人 |
| [`skills/hkust-course-planner`](skills/hkust-course-planner) | 给出课表截图或课程 section，需要可行的排课方案 |
| [`skills/hkust-life-mcp`](skills/hkust-life-mcp) | 宽泛的校园生活问题，需要先路由到正确来源或某个专门 Skill |

## MCP 工具

| MCP tool | 现在能做什么 | 数据/权限边界 |
| --- | --- | --- |
| `hkust_search_services` | 用自然语言找学校负责单位：图书馆、自习、宿舍、校车、食堂、Wi-Fi、奖助学金、职业、交换等 | 只搜索内置的主校区官方来源索引 |
| `hkust_get_weather` | 取得香港天文台即时温湿度、图标和有效警告 | 公开 HKO API，响应带来源 URL 与抓取时间 |
| `hkust_get_daily_brief` | 以天气 + 你传入的当天课表/截止事项生成按时间排序的 morning brief | 不读 SIS，不写日历；调用者可传已获授权的日程 |
| `hkust_get_campus_updates` | 抓取一个 allow-list 中的官方页面为文本摘要 | 只能请求注册的 HKUST URL，不能请求任意网址 |
| `hkust_plan_reminders` | 课程提前 45 分钟；截止提前 24 小时和 2 小时；去重并按 `Asia/Hong_Kong` 排序 | 只生成计划，不发送通知、不创建日历事件 |
| `hkust_account_status` | 显示 Outlook/Canvas/SIS 到底能否接入、最小权限及下一步 | 不读取任何私人内容 |
| `hkust_get_outlook_signals` | 已授权后读邮件标题、发件人、时间、重要性、已读状态；读日历时间、地点与忙闲 | 仅读 `Mail.ReadBasic` 和 `Calendars.ReadBasic`；不读正文/附件，不写入 |

### 覆盖的官方入口

ARO/Registry（学期、选课与学务）、CSO（校车、交通、食堂、商店、邮政）、Path Advisor（路线/教室）、SHRLO（宿舍）、Library（开放时间/自习）、DSTO（活动/辅导）、HSEO（健康/安全）、University Calendar（活动）、FBS（体育）、ITSO（账户/Wi-Fi）、SFAO（奖助）、Career Center、Office of Global Learning 都已进入来源索引。

每项结果都应该优先让学生点进负责部门的原始页面；Agent 不应把不确定的页面文本冒充为学校规则。

## 运行

要求：Node.js 22+。

```bash
git clone https://github.com/0xBennie/hkust-skills-hub.git
cd hkust-skills-hub
npm install
npm run build
```

### 本机 MCP（Codex、Claude Code 最直接）

MCP client 应启动 `node <repo>/dist/index.js`。通用配置形状见 [examples/mcp-server.example.json](examples/mcp-server.example.json)。

Claude Code 可直接运行：

```bash
claude mcp add --transport stdio --scope user hkust-life -- node "$PWD/dist/index.js"
```

再用 `claude mcp get hkust-life` 或 Claude Code 内的 `/mcp` 核对工具状态。Claude Code 对本机 stdio 和远程 HTTP MCP 都有官方支持。[Claude Code MCP 文档](https://code.claude.com/docs/en/mcp)

### ChatGPT / 远程 MCP

ChatGPT 连接的是**远程** MCP server，不能直接连这台电脑上的 stdio server。该项目已包含标准 Streamable HTTP 入口：

```bash
HKUST_MCP_API_KEY='replace-with-a-long-random-secret' npm run http
```

默认入口是 `http://127.0.0.1:3000/mcp`。生产使用时要把它放在 HTTPS 之后，或使用 OpenAI 支持的 Secure MCP Tunnel，再在 ChatGPT Developer Mode 中连接。ChatGPT 的可用范围和功能会随套餐/管理员策略变化；目前官方说明是本机 MCP 不能直接连接，完整 MCP 功能处于 beta，并主要面向 Business、Enterprise 与 Edu。[ChatGPT MCP 官方说明](https://help.openai.com/en/articles/12584461-developer-mode-and-full-mcp-connectors-in-chatgpt)

HTTP 模式需要 `Authorization: Bearer <HKUST_MCP_API_KEY>`。它有意拒绝加载单一共享 `HKUST_GRAPH_ACCESS_TOKEN`：一台公开服务不能把某一个人的邮箱暴露给所有使用者。要让 ChatGPT 读取每位学生的私人信号，需要完成逐用户 OAuth（见[下节](#学校账号可以做什么不能做什么)）。

### Web Hub

```bash
npm run hub
```

默认在 `http://localhost:3000`：

| 页面 | 内容 |
| --- | --- |
| `/` | Skill 目录总览 |
| `/start` | 新生第一周清单流程，完成状态只留在本机 |
| `/skills` | 全部 Skill 与各自的来源边界（`/skills/<slug>` 为详情页） |
| `/plan` | 课表截图与 ARO course section 的选课规划流程 |
| `/sources` | 来源治理：每条公开答案对应哪个 allow-list 官方来源 |
| `/connect` | 数据与账号边界：公开 Hub 能做什么、永远不会索取什么 |
| `/api/mcp` | 部署后的远程 MCP 入口（Streamable HTTP） |
| `/api/health` | 健康检查，返回 `clear-water-bay-public` |

部署到公开环境时只启用公开 MCP：不要为其配置 `HKUST_GRAPH_ACCESS_TOKEN`。

## 截图与选课的边界

课表截图是**学生自己提供的私有上下文**，由学生当下使用的 Agent 在会话内解析；本仓库和 Hub 都不存储、不上传截图。截图只用来理解**当前**课表。

下学期的 course section、时间、名额与先修条件以 **ARO 官方页面为准**，不以截图或模型记忆为准。规划结果是一份**待学生自己核对并提交**的候选清单：本项目不会代为选课、退课、抢课或修改任何学籍记录。

## 学校账号：可以做什么，不能做什么

`@connect.ust.hk` 邮箱/日历可以用 Microsoft Graph 的 delegated OAuth 以只读方式接入。第一阶段请求：

- `Mail.ReadBasic`：主题、发件人、时间、已读、重要性；**不含**正文、预览、附件或扩展。
- `Calendars.ReadBasic`：课程/会议的基本时间、地点、忙闲状态；不写入日历。

在 HKUST Entra tenant 中完成 app registration 和管理员/用户同意前，`hkust_account_status` 会显示 `awaiting_consent`。开发人员可只在本机短时设置 `HKUST_GRAPH_ACCESS_TOKEN` 测试连接器；不得把 token 放进 Git、聊天内容、MCP tool 参数或共享服务器。

Canvas 需要 HKUST Canvas root-account Developer Key；SIS 需要 ARO 与 ITSO 提供正式的只读 protected API。没有这些批准，本项目不会自动登录、抓 cookie、询问密码或绕过 MFA。完整申请材料在 [docs/account-approval-request.md](docs/account-approval-request.md)。

HKUST 的 SSO/MFA 与学生账户由 ITSO 管理；这些约束是为了不破坏其身份验证边界。[HKUST SSO](https://itso.hkust.edu.hk/services/cyber-security/authentication-service/sso) · [学生账户](https://itso.hkust.edu.hk/services/general-it-services/user-account/student/student-account) · [Microsoft Graph delegated access](https://learn.microsoft.com/en-us/graph/auth-v2-user)

## 自动提醒如何落地

MCP tool 负责“查询和生成提醒计划”，不应在安装时暗自启动后台进程。实际推送由你选择的运行环境执行：

1. Agent 读取 `hkust_plan_reminders` 的提案，依照每条 `scheduledFor` 提醒。
2. Agent 在每天早晨调用 `hkust_get_daily_brief`；在授权完成后再调用 `hkust_get_outlook_signals`。
3. 每周日生成下周课程/截止事项预览。

推荐默认规则：课程前 45 分钟（加上 Path Advisor 路线链接）、截止前 24 小时和 2 小时、严重天气/校车更新即时提醒。正式启用后还应提供 quiet hours、去重、取消/断连与每个提醒的来源链接。

OpenClaw 可以作为可选 scheduler，但不是项目依赖。Codex/ChatGPT/Claude 使用同一组 MCP tools；不同平台的“如何在某一时刻主动推送”由该平台自身的 schedule/automation 能力承担。

## 质量验证

```bash
npm test
npm run build
npm run smoke
npm run release:check
```

测试覆盖来源检索、提醒去重/时间、HKO 响应规范化、Graph 最小字段、MCP tool 注册、Skill 包一致性、Hub 内容模型与受密钥保护的 HTTP 初始化握手。`release:check` 在发布前扫描已跟踪文件中的凭证式赋值与学生数据，并运行 `npm audit --omit=dev`。

## Source and safety notes

- 完整范围、来源策略、隐私边界与非目标： [docs/architecture/hkust-life-mcp.md](docs/architecture/hkust-life-mcp.md)
- 只请求 allow-list URL；返回中保留来源、机构与抓取时间。
- 公开信息可刷新；课程、成绩、住宿名额、公告有效期等不应被当作永久事实。
- 紧急情况不能等 Agent：请直接使用 HKUST/Hong Kong 的官方紧急渠道。

## 参与与许可

- 贡献规则与来源要求： [CONTRIBUTING.md](CONTRIBUTING.md)
- 安全与私人数据披露： [SECURITY.md](SECURITY.md)
- 许可： MIT，见 [LICENSE](LICENSE)

本项目由学生维护，不是 HKUST 官方产品，也不代表任何 HKUST 办公室发言。
