# iOS two-account activity runtime acceptance

## Ownership / state
- Goal remains active and incomplete. This unit adds native interaction evidence, not feature-count or mock acceptance.
- Worktree `/Users/bennie/.codex/worktrees/campus-school-sync/All in one HKUST`; branch `codex/campus-school-sync`; PMO base `b036e577a9d2769dcd0dbe4bd20e27a3e8c6881c`; tested implementation `0fbf898`.
- Xcode iOS 27 simulator / iPhone 18 Pro, same running API4328, Metro8087 and loopback bridge as prior handoff. No restart of backend, global changes or external messages.
- Local development SQLite `.local/native-acceptance/campus.sqlite`; both accounts are test-only, unverified school identities. All activity content remains local, marked development/demo.

## Executed through native UI
1. Organizer `native.acceptance@example.test` created “原生验收 · 安静自习”: Oct 5, 2026, 14:00–15:00 HKT, location 图书馆入口（本地验收）, capacity one excluding organizer, free, quiet mode, members visibility. Saved to organizer's private calendar.
2. Logged out and logged in with `native.peer@example.test` through local OTP UI. Peer profile had no previous name. Today → 全部记录 had no organizer's private task.
3. Peer opened the activity. No organizer edit/cancel/roster controls appeared. Confirm sheet displayed time/location/capacity/cost and calendar toggle default OFF.
4. Peer explicitly enabled calendar save and confirmed. Success screen reported confirmed and calendar saved; detail showed 1/1 and confirmed participation.
5. Today → 日程 → next day showed the same activity. Expanded 查看与管理 → 查看活动／管理参与 opened the same detail with confirmed state.
6. Peer chose withdraw; native confirmation explained release of slot and removal of saved calendar/reminder. Confirmed. Detail changed to 已退出, 0/1, and unsaved calendar action.
7. Returned to Today: selected Oct 5 remained selected, activity removed, empty state shown without manual reload.
8. Read-only SQLite check confirmed peer status withdrawn, calendar_saved=0, remind_minutes=null; no token, OTP or auth-secret exported.

## Saved evidence
Under `docs/evidence/ios-2026-10-04/`:
- `activity-confirmed.png` and `activity-confirmed-ax.txt`.
- `activity-withdrawn.png` and `activity-withdrawn-ax.txt`.
- `activity-calendar-cleared.png` and `activity-calendar-cleared-ax.txt`.
- `activity-persistence.json` (only local test record fields).

## Acceptance scope
- AC01: actual native social flow added to earlier learning/transport evidence; full item not declared passed.
- AC02/AC03: observed account-switch private-task isolation and own profile reset; not a replacement for adversarial object-access/admin/export acceptance.
- AC06: native publish → second-account confirm → optional calendar → deep-entry → withdraw → slot/calendar cleanup verified. Concurrency, waitlist promotion, organizer edits/cancellation and message propagation still require runtime coverage.
- AC09: basic keyboard/form operation possible; full accessibility/motion/type-size/appearance coverage still outstanding.
- No code changed, so no repeated broad unit test run in this evidence-only unit.

## UX observations / next
- Activity form is long and asks users to type HKT date strings; improve date/time input with design handoff, preserving timezone and validation behavior. Keyboard can occupy much of the form; inspect focus and dismissal before claiming final usability.
- “全部记录” currently shows learning records but not saved activities; activities appear in the date agenda. Investigate label/scope against PRD before calling it a data-loss bug or changing behavior.
- Continue native organizer reschedule/cancel and inbox/calendar propagation, waitlist/concurrency, then X04 mutual/withdraw/block. Keep school approval and R1.1 implementation gaps from prior handoffs open.

## Follow-up: reschedule / cancel and return-origin defect

- Setup/organizer actions in this follow-up used real HTTP endpoints against the same isolated backend (local OTP authenticated), not native organizer forms: rejoined peer with calendar saved; changed activity to Oct 6 15:00–16:00 HKT and 新集合点（本地改期验收）; later cancelled with current version. These do not count as native organizer edit-form acceptance.
- Native participant Inbox showed the change notice; tapping it fetched new time/location and confirmed participation. Native return incorrectly switched to discovery feed. Reproduced before fix.
- Fix `apps/mobile/App.tsx`: activity/post targets retain optional Today/Inbox return tab, bound to the same owner; dismiss clears target and returns to source. Notification cold-start targets retain existing default behavior. Existing detail draft/write guards remain in place. No new layout or Pen screen is introduced; this corrects the existing back transition.
- Repeated Inbox → activity → back in actual iOS after hot refresh: Inbox selected and same message list restored. Saved `inbox-return-fixed.png` and `inbox-return-fixed-ax.txt`. Today-origin and wall-post variant need additional native regression coverage.
- Native Inbox refresh then showed cancellation notice. Deep link showed cancelled state, 0/1, no join or calendar-save action, and preserved changed time/location for context. `cancelled-native.png` and matching AX evidence saved.
- Backend responses `reschedule-api.json`, `cancel-api.json` contain no credentials; cancelled participation, calendar_saved false, reminder null and empty projected date confirmed over HTTP. System-notification delivery is still untested.
- Mobile TypeScript check passed; no full suite rerun for this narrowly scoped navigation change. Goal remains incomplete.
