# Native local reminder acceptance

- Active goal remains incomplete. Own worktree `/Users/bennie/.codex/worktrees/campus-school-sync/All in one HKUST`, branch `codex/campus-school-sync`, PMO base `b036e577a9d2769dcd0dbe4bd20e27a3e8c6881c`.
- Tested iPhone18Pro / iOS27 simulator, Expo development client against isolated persistent API4328. Local test account native.peer@example.test remains signed in.
- Native Me → enable reminders showed the actual iOS notification permission dialog. Allowed alert notifications for this development App in the simulator. No APNs token registration or external push occurred.
- Native Today created private task 本机通知送达验收, due Oct4 2026 01:43 HKT, reminder offset0. UI save succeeded, Me showed one scheduled reminder and recent successful synchronization. `notification-scheduled.png` records that state.
- Returned simulator to Home with Campus backgrounded before due time.
- Notification implementation uses generic lock-screen title/body, excluding private task title. Actual presentation and tap target must be confirmed separately; scheduled count alone is not delivery evidence.

## Observed result / boundary
- At 01:43:05 the captured Home screen had no visible banner. A subsequent notification-center gesture was interrupted by a user app change; fresh UI state showed Campus campus tab. Stopped UI manipulation to avoid competing with the user. Do not claim a verified notification tap or visible banner.
- Read-only simulator system logs independently confirm permission authorized and local scheduler firing: `Deliver local notification 6A88-5D1B at 2026-10-04 01:43:00.013 +0800`. Filtered evidence saved as `notification-os-delivery.txt`; broader bundle-filtered log remains ignored at `.local/school-sync/notification-runtime.log`.
- Thus actual OS local delivery pipeline is verified; visual presentation and correct tap target remain unverified. APNs remains not configured. This is partial AC08, not full acceptance.
- Reminder remains enabled for native.peer in the simulator; original task remains in local backend. No account/data cleanup performed.
- Next: re-run a new future reminder when simulator is available, capture notification center before re-entering Campus, then tap and inspect exact target. Also verify denied permission, reschedule/cancel cleanup, account isolation, and reduced-motion/accessibility. User's current simulator view was preserved.
