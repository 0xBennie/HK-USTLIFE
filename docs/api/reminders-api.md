# Personal reminder projection and native scheduling

Status: implemented for local development. Server behavior and scheduler state machine are tested. Native iOS permission dialogs, delivery, tap handling and system cancellation are **not runtime-accepted** yet.

## GET `/api/v1/me/reminders`

Requires the same bearer session as `/me/calendar`. Owner comes exclusively from the session. Uses server time, has no caller-supplied owner or date range, returns the standard `{data,meta}` envelope and `Cache-Control: no-store`. Missing or invalid authentication returns 401.

`data` fields:

| Field | Meaning |
|---|---|
| `owner_id` | Authenticated account; device rejects a mismatched owner |
| `generated_at` | UTC server snapshot time |
| `through` | Exclusive end of the 14-day firing-time window |
| `limit` | 60 nearest reminders returned |
| `deferred` | Eligible reminders beyond the returned limit |
| `items` | Sorted by `fires_at`, then stable ID |
| `import_issues` | `{source_id,series_id,title,code}` for recurrence series that could not be expanded |

Each item is `{id,fires_at,target_at,kind,target,title}`. `kind` is `event` or `task`; `target` is `{kind:'study'|'import'|'activity',id}`. Both times are ISO instants. Notification text does not include `title` or private notes on the lock screen; it asks the user to open Campus.

The projection includes active timed study events, open timed tasks, explicitly edited imported occurrences and explicitly saved activities. `remind_minutes` must be non-null (0–10080). Firing time equals target time minus lead minutes and must be strictly after server time and before `through`. All-day/date-only records, done tasks, cancelled events, removed sources, missing source occurrences and unsaved/cancelled/withdrawn activity projections do not produce reminders. ICS alarms do not automatically opt the user in. Recurrence expansion looks ahead beyond the firing window to cover seven-day lead times; import errors are surfaced, not silently described as full coverage.

Existing write endpoints remain the source of truth:

- Study create/update: `remind_minutes` plus a precise event start or task deadline.
- Imported occurrence update: private per-occurrence `event.remind_minutes`; source membership and version rules still apply.
- Activity preferences: `{bookmarked,calendar_saved,remind_minutes}`; reminders require calendar saving. Saving is independent of participation.

## Native behavior

- Expo Notifications 57.0.21; local DATE triggers only. No push token registration, APNs setup, remote service or school credentials.
- Enablement is stored in SecureStore separately for each account on this device. Only the explicit Enable button requests notification permission. Denial leaves basic functionality available.
- Reconciliation runs at session identity/language change, foreground, completed or uncertain authenticated mutations, and every five minutes while foregrounded. It serializes OS writes and checks session generation after async boundaries. A schedule that returns after account change is cancelled.
- After a known or uncertain mutation, identity change or explicit disable, the implementation clears Campus-owned pending and presented reminders before fetching. If that fetch fails, invalidated reminders stay cleared and the UI exposes retry. During an ordinary foreground refresh for the same verified account, the last queue remains while fetching; if offline, it is retained with an explicit stale status. A successful fetch replaces the queue. On startup when no account can be verified, old reminders are cleared for account isolation.
- Unrelated notifications are left intact. A conservative total budget of 64 pending requests and a Campus maximum of 60 limits scheduling; remaining items are counted as deferred. Queue contents are read back before the UI reports successful scheduling. This is queue evidence, not proof of delivery.
- Disable preference persists before OS cleanup, so a failed cancellation cannot re-enable scheduling on the next sync. OS cleanup failures are exposed as possibly remaining old reminders.
- Notification taps require current account ownership and an allowlisted target kind. Activity taps select that activity; study/import taps open the appropriate Hong Kong calendar date and re-fetch canonical records. Notification content never restores a removed record or launches an arbitrary URL.
- Remote changes made while the app is closed or offline cannot immediately revoke local notifications. The next successful sync is required. Reminders beyond the rolling horizon/cap require opening the app again.

## Verification and remaining acceptance

- `tests/product-reminders.test.ts`: actual Fastify/SQLite authentication, owner isolation, timed filtering, completion/cancellation/deletion, activity reschedule/withdraw/cancel, imported recurrence override/cancel, bounded queue and restart persistence.
- `tests/native-reminders.test.ts`: deterministic OS adapter tests for permission gating, account-switch/request/schedule races, unrelated requests, offline and cleanup failures, opt-out persistence, silent queue loss and notification routing.
- `docs/progress/evidence/reminders/http-smoke.txt`: actual loopback HTTP server, authenticated task creation → one reminder → completion → zero reminders.
- `regression.txt`, `typecheck.txt`, `ios-export.txt`: test and compile artifacts. No emulator/device notification was sent as part of these checks.
- Device acceptance still required: allow/deny permission, near-term delivery, tapping while signed out or another account is active, old-time cancellation after edit, terminated/background behavior, narrow screen and enlarged fonts. MV08 remains partially unverified.

## Dependency evidence

Official Expo documentation recommends `~57.0.21` for SDK 57: https://docs.expo.dev/versions/latest/sdk/notifications/ . The project locks exactly 57.0.21. Endor Dependency Reviewer was routed with the `package-risk` profile; no callable Endor MCP or `endorctl` was available. Risk posture: **UNKNOWN**, gaps: Endor package risk, vulnerability, license and policy evidence unavailable. No Endor approval is claimed.

The current npm audit still reports issues in the existing Expo CLI/node-forge and Vitest dependency chains. This work does not remediate them or certify production readiness. Raw audit evidence is local at `.local/notifications-audit.json`.

Apple's legacy notification documentation describes a 64-request queue; this implementation uses it as a conservative budget, not a verified promise for every current OS version: https://developer.apple.com/documentation/uikit/uilocalnotification . Current scheduling/cancellation API behavior is described at https://developer.apple.com/documentation/usernotifications/scheduling-a-notification-locally-from-your-app .
