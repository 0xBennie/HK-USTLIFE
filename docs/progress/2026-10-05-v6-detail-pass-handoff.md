# V6 detail pass — handoff (2026-10-05)

Goal: finish every visible detail on the native app against Pen, self-checked on the iOS simulator, real data only.
Branch: `claude/native-ui-refresh` (pushed). `feat/hkust-life-mcp` untouched — merging waits for the user's 「推」.

## Pen boards (in `design/campus-apple.pen`, **not yet saved** — press ⌘S in Pen, then copy the file here and commit)

New: `QkyT2` V6 / 本周课表 · `Nlb7d` V6 / 登录入口（学校邮箱） · `ddOiF` V6 / 校园墙 · `kSIaN` V6 / 帖子详情 ·
`M6vKMj` V6 / 发帖 · `hFxMD` V6 / 离开确认（系统弹窗） · `DDS0O` V3 / 消息 · 未读与已读 · `pdYON` V6 / 再次同行 ·
`P3c5M` V6 / 联系方式 · `LfGB3` V6 / 学校记录（私人笔记与提醒） · `lTrEk` V5 / 学校连接 · 连接状态 ·
`r3fvkB` V6 / 你的校园名片 · `UemvP` V6 / 我的收藏（活动、地点与路线） · `biMye` V6 / 语言（系统菜单） ·
`cYjzG` V6 / 全部记录（课表）.
Changed: `r1S0Aq` (empty file row), `dsJS2` (block confirm), `xZUzJ` (queued reminder banner), `dqbRa` (copy matches
real notifications), `OsfrE` (「语言」 row).

## Shipped (commits 37b3a25 … d9820a5)

- Calendar import / imported calendars in plain words; week grid merges overlaps, aligned day tiles, display-zone
  positions, natural due times; backend: restoring a cancel-only date drops the private override (+tests).
- Disabled buttons actually fade (pressFeedback overrode opacity).
- Guest-mode leftovers removed (the app is behind school-email sign-in).
- Sign-in V6 with code step, resend countdown, delivery-aware note.
- Campus wall V6: today-only 「今日热议」, no misleading badge, solved/closed chips, read-vs-write errors, post limit.
- Meet-again and contact-card pages rebuilt (V1 Primitives gone); withdraw after mutual consent asks first.
- School record editor V6; HKUST account card reflects SIS only; Canvas shows as 「Canvas 已连接」; HK sync times.
- Me: honest profile page, saved places/routes (open in Campus), ended activities, language menu saved to account.
- All-records view sorted by date, dated events, red overdue; course rows 「2 项」.
- Dark mode: course/topic colours readable (TintChip/useTint, lighten).

## Verification

- `npx vitest run`: 73 files / 413 tests pass. Root `tsc`: 0 errors. Mobile `tsc`: the 10 baseline errors in `src/product` only.
- Simulator (iPhone, light + dark pass, restored to light): every changed flow exercised, see
  `docs/progress/evidence/native-ui-refresh/v6-study/*.jpg` (Pen board next to simulator).

## Dev DB changes (local test data only; backups in `~/.claude/backups/dev-db-*`)

- Imported a labelled 「UI test calendar」 .ics, exercised cancel/restore, deleted it in the app; test file removed from the
  simulator's Files. Two expired-preview rows clear themselves.
- Signed `student-a@example.test` out and back in (local inbox code).
- Meet-again on 「课后，去海边走走」 between Bennie and Alex (`student-b`, via the local API): both agreed, then both withdrew;
  two `reconnection_intents` rows remain with `willing=0` (normal after withdrawing); no cards, no mutual notices left.
- One labelled Canvas test record created through the school store, saved with a 30-min reminder, removed with
  「断开并删除缓存」; the leftover test connection/scope rows were deleted.
- Language switched to English and back to 中文.

## Next

1. User: ⌘S in Pen → copy `campus-apple.pen` into `design/` and commit.
2. User: 「推」 to merge `claude/native-ui-refresh` into `feat/hkust-life-mcp`.
3. Remaining V3/V5-era boards without V6 versions (campus sub-pages, reminders settings) are visually consistent but
   could get V6 boards in a later pass.
