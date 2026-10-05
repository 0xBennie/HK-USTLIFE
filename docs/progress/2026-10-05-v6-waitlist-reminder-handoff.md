# 候补与提醒收口、Pen 同批入库 — 交接（2026-10-05）

## 目标与需求

PMO 收口单（`hkust-pmo/pmo/LATEST-REVIEW.md` 待收口清单，及用户 10-05 下午的三项任务）：

1. Pen 与代码同批对齐：逐屏画板 ID、资源、保存版本可核查，不再拿旧稿开发。
2. V6-03：候补者（以及只加入日历、未报名的人）单独管理日历和提醒，不影响候补顺位。
3. V6-04：本机提醒关着、通知被拒、同步失败时明确提示，区分「偏好已保存」和「本机会通知」。
4. 候补退出文案；底部面板在「减少动态」下松手不回弹。
5. 移动端类型检查的 10 个错误。

## 版本

- worktree `/Users/bennie/HKUST/.worktrees/hkust-native-ui`，分支 `claude/native-ui-refresh`，本提交的父提交 `1ff1e38`。主线 `feat/hkust-life-mcp` 未改动，合并等用户「推」。
- Pen：活动编辑器即仓库文件 `design/campus-apple.pen`，15:45 保存，SHA-256
  `3bc338bf8d3935eb643e21f9a6d5925f44c76f9c679dc119d4bf7cdebf669166`（237 个顶层画板）。
  它在 PMO 记录的 12:21 工作稿上增改；该工作稿在 Codex 归档时随目录删除，从快照 `eba6af1` 恢复，哈希与 PMO 记录一致（`54576229…11f2`）。
- 新画板：`X9umEe` V6 / 报名卡 · 候补与只加入日历，`dY9tt` V6 / 报名卡 · 本机能否提醒，`fEcT9` V6 / 退出确认（报名与候补），
  `TBMCw` V6 / 底部面板 · 拖动与减少动态（交互说明），`auiwc` V6 / 画板索引（画板 ↔ 原生页面）。
- 对照表：`design/BOARD-MAP.md`（与 auiwc 同一份数据）；35 张被取代的旧稿在 Pen 中改名「（旧稿 → 用 …）」。
- 资源：Pen 唯一的本地图片 `design/assets/map-hkust.png` 已在库中；快照里的 `design/school-sync/g6IET|g8DPsq|jMZip.png`
  按该目录 README 属作废草稿，不入库，已移到 `~/.claude/backups/pen-before-restore-20261005/school-sync-superseded/`。

## 改动

- `apps/mobile/src/social/ActivityDetail.tsx`：日历/提醒按钮（`MyPlan`）用于已报名、候补、未报名（有名额、已满、暂停报名）；
  订阅本机提醒状态，已设提醒但本机提醒没开、系统通知被关、同步没完成时显示提示行和一个处理动作（开启 / 去设置 / 重试），
  同步进行中保留上一个结论不闪烁；退出确认按状态写明失去名额或候补位置，按钮写「退出报名 / 退出候补」。
- `apps/mobile/src/ui/BottomSheet.tsx`：松手没到关闭距离、手势被系统打断都走同一个 `settle`：减少动态时直接回位，
  否则用同一组弹簧参数；减少动态下关闭时面板不再先跳回原位；手势里读取当下的减少动态设置。
- `src/product/affairs/types.ts`（新）+ `store.ts` + `apps/mobile/src/affairs/controller.ts`：事务记录的数据结构改为只含类型的共享文件，
  服务端用它声明返回类型，移动端不再引用依赖 `node:sqlite` 的 store。
- `tests/product-social.test.ts`：候补与未报名用户改日历/提醒不改变报名状态、顺位和 version，FIFO 递补不变。
- 画板引用注释改成真实画板名和 ID（11 个文件）：App、AccountScreen、CampusScreen、DirectoryScreen、PublicTransitScreen、
  CommunityScreen、LifeScreens、SocialExtras、ReminderControls、StudyForm、TodayHome。
- `docs/PRD.md` v3.1；`design/BOARD-MAP.md`；本交接与证据。

## 检查

```
npx vitest run                                  # 73 个文件 / 414 项通过
npx tsc --noEmit -p tsconfig.json               # 根目录 0 错误
cd apps/mobile && npx tsc --noEmit -p tsconfig.json   # 移动端 0 错误（原 10 个）
```

日志：`docs/progress/evidence/native-ui-refresh/v6-waitlist/checks/`。

## 运行入口

```
cd /Users/bennie/HKUST/.worktrees/hkust-native-ui
NODE_USE_ENV_PROXY=1 CAMPUS_MODE=local-development CAMPUS_PORT=4338 CAMPUS_DATA_DIR=.local/claude-ui npx tsx src/product/main.ts
cd apps/mobile && EXPO_PUBLIC_API_URL=http://127.0.0.1:4338/api/v1 REACT_NATIVE_PACKAGER_HOSTNAME=127.0.0.1 npx expo start --port 8098 --dev-client
xcrun simctl openurl booted "exp+hkust-campus-local://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8098"
```

开发版登录用本地测试账号（如 `student-a@example.test`），验证码在本机开发收件箱 `.local/claude-ui/mail/`，不发真实邮件。

## 真实操作证据（iPhone 18 Pro 模拟器，15:22–15:45）

目录 `docs/progress/evidence/native-ui-refresh/v6-waitlist/`：

- `waitlist-calendar-pen-vs-sim.jpg`：X9umEe 与模拟器——未报名只加入日历；候补第 1 位已在日历；单独取消日历；设提前 30 分钟。
- `device-reminder-pen-vs-sim.jpg`：dY9tt 与模拟器——本机提醒关着、系统通知被关、同步失败（停掉本地 API 后回到前台）、重试后恢复；
  以及通知允许时 15:30 本机真实弹出的「Campus · 日程提醒」。
- `withdraw-dialogs-pen-vs-sim.jpg`：fEcT9 与模拟器——退出活动（只看，点了返回）、退出候补（写明第 1 位）。
- `pen-TBMCw.jpg`、`pen-auiwc.jpg`：交互说明与索引画板。
- `steps/01…19.jpg` 每一步截图；`steps/db-state.log` 每一步之后从开发数据库只读查到的报名状态、queue_order、version 与日历/提醒字段。
  关键结论：从加入候补到改日历、改提醒、关开本机提醒、拒绝再允许通知、同步失败再恢复，`status=waitlisted queue_order=2 version=1 position=1`
  始终不变；退出候补后 `withdrawn`，`calendar_saved=0 remind_minutes=null`。

测试数据：Alex 发起「UI 测试 · 候补与提醒」（容量 1），Mina 占名额，模拟器里的 Bennie 走候补流程，最后 Bennie 退出、Alex 删除活动，
参与与偏好记录清零。站内留下 7 条与它相关的通知（显示为内容已移除）。测试前备份：`~/.claude/backups/dev-db-20261005-151744-before-waitlist-test.sqlite`。
模拟器设置已复原：本机提醒开、系统通知允许、浅色、减少动态关（全程未开）；慢动画保持原样（开）。

## 没做完 / 不能推定

1. **减少动态下的拖动没有实测。** 代码已改，Pen 已补说明；但模拟器自动注入的拖动（逐点拖动两次、平滑滑动一次、快速下滑一次）都没有进入面板的 JS 手势：
   面板不动也不关闭，标准模式同样如此；加日志确认手势回调未被调用，日志已删。点按按钮、拖动系统开关、滚动页面都正常。
   需要有人在 Simulator.app 用鼠标或在真机上拖一次面板（减少动态开 / 关各一次）。这也说明「下拉关闭」本身目前没有自动化验证。
2. iOS 26 系统弹窗正文左对齐，Pen 画的是居中，与已有的 hFxMD 情况相同。
3. 发起人仍没有日历/提醒按钮（本次未要求）。
4. 本机提醒正常时界面不额外承诺；提醒在打开 App 时排入本机（最近 14 天内最多 60 条），更远的活动之后才排上。
5. 今天、校园首页、消息、我的首页、提醒设置、生活页等仍依据旧版画板（见 BOARD-MAP 的版本列）。
6. 真机、学校 SSO/SIS/Microsoft 365、真实发信均未在本轮验证。

## 下一步

- PMO / QA：按本提交复验 V6-03、V6-04、退出文案和类型检查；人工拖一次底部面板。
- 用户：「推」后合并到 `feat/hkust-life-mcp`。

## 回执：Codex 协作单（`CLAUDE-CODEX-COORDINATION.md` 本轮收口要求）

1. Pen 同批对齐：已保存并随本提交入库，ID 与哈希见上，对照表 `design/BOARD-MAP.md`。
2. 候补独立管理日历/提醒、保留顺位，含只保存未报名：已做，证据与数据库记录见上。
3. 本机关闭 / 拒绝 / 异常与恢复：已做，三种状态和恢复都在模拟器走过。
4. 候补退出文案：已做；减少动态：代码与 Pen 已做，拖动实测待人工（第 1 条）。
5. 移动端类型检查：0 错误，未忽略任何报错，靠拆出共享类型解决。
6. 同状态 Pen/模拟器对照与真实操作证据：见证据目录；真机与学校接入另验。
