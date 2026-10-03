# Native waitlist promotion acceptance

Goal remains active/incomplete. Worktree /Users/bennie/.codex/worktrees/campus-school-sync/All in one HKUST, branch codex/campus-school-sync, PMO base b036e577a9d2769dcd0dbe4bd20e27a3e8c6881c.

## Real runtime sequence

- Revalidated local API4328 via /auth/methods and existing iOS27 simulator session in Device Hub. Used existing fixture453be85b-4df7-4750-9ced-30b51006ec45; no duplicate activity or service restart.
- Native peer initially showed waitlist rank1, counts confirmed1/1 waitlisted1, calendar saved, no reminder. Captured promotion-before-native.
- At02:16 HKT first cached helper login succeeded for seat holder; peer challenge still429. No withdrawal had occurred. Read-only rate timestamps showed next slot02:24:34; did not reset or bypass. Changed acceptance method to use the already-issued seat-holder session and the existing native peer session, avoiding unnecessary peer reauthentication.
- Seat-holder withdrawal executed through authenticated local HTTP, not native UI. /activity detail then showed withdrawn for holder and counts confirmed1 waitlisted0. Evidence promotion-seat-release-api.json.
- Native peer refreshed same activity: confirmed, waitlisted0, own calendar still saved. Back returned to Inbox, which showed new promoted notification. Tapping that notice opened same confirmed activity.
- Today → Oct7 → expanded saved event showed confirmed participation. Opened activity from Today; Back returned Today and retainedOct7. Captured promotion-calendar-native and promotion-return-today-native.
- Read-only SQLite assertion independently checked peer confirmed, calendar_saved1, remind_minutes null and exactlyone promoted notification. Evidence promotion-persistence.json. No remote push or OS notification delivery asserted.

## Defect found and fixed

Native screenshot exposed literal backslash-n between organizer and count. Fixed JSX in apps/mobile/src/social/ActivityDetail.tsx to use actual newline expression. Metro reload reset current local view; reopened via notification and verified correct two-line display in screenshot and accessibility text. Final evidence promotion-confirmed-fixed-native.

Mobile TypeScript check passed. No extra unit test added for literal presentation change; actual native view verified. No school data, student accounts, external messages, deployment or production changes.

## Limits / next

This proves local persistent backend promotion + native peer rendering/message/calendar/return paths. Seat holder withdrawal was HTTP; no claim of simultaneous two-device UI test. Existing concurrency HTTP evidence is separate. Reminder visual presentation/tap and remaining X05 native flows still pending. Current simulator remains signed in as native.peer on activity detail. Auth helper has a protected local cached seat-holder session; no session data committed.
