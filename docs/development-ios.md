# Run the iOS development MVP

**2026-10-03 route update:** the user selected EAS cloud builds plus a physical iPhone. Follow [cloud development setup](development-ios-cloud.md). Local Xcode is not required for that route. The simulator commands below remain an alternative. The cloud app still needs Expo project linkage, Apple signing/device registration and a phone-accessible backend; no successful cloud build or device execution is recorded yet.

Implemented code: local accounts, private courses/day-week schedules/tasks/notes/material links and ICS import; reviewed campus shuttle/directory and public KMB/GMB queries; activities/study groups and wall/help/replies; private inbox and report/block/moderation APIs. Native screens connect to these real stores. Device reminder code, restricted admin place/source/correction maintenance and public website/share are implemented. Existing-route timetable and holiday maintenance are implemented; actual iOS runtime acceptance remains incomplete.

## Requirements

- Node 22.23+ and npm. Built-in `node:sqlite` currently emits an experimental warning; local use is tested on 22.23.1.
- For local compilation/simulator only: full Xcode and an installed iOS Simulator runtime. Cloud compilation plus a physical iPhone is an alternative.
- This local backend binds only to loopback; an iOS simulator on the same Mac can access it. A physical iPhone requires an independently configured secure backend, not opening the development authentication service to the LAN.

## Start

From the repository root:

```sh
npm ci --ignore-scripts --cache .local/npm-cache
npm run api:seed
npm run api
```

In a second terminal:

```sh
npm run mobile
```

Once Xcode and the runtime are available, use the Expo terminal's `i` command to open an iOS simulator. For a local development build:

```sh
npm run ios --workspace @campus/mobile
```

Do not run deploy/publish commands. No Apple developer account or TestFlight submission has been configured.

## Local sign-in

Choose `student-a@example.test`, `student-b@example.test`, or `admin@example.test`, then request a code. The App shows its challenge ID. Open `.local/campus/mail/<challenge-id>.json` locally to read the development code; it is not sent to an email address. Never commit this directory. Only the backend process/OS account needs filesystem access.

Codes last ten minutes. Wait 60 seconds before requesting another. School membership remains unknown, including for `@connect.ust.hk` addresses. All accounts are visibly test accounts.

Backend data is in `.local/campus/campus.sqlite`; the normal startup and seed commands preserve it. The schema migration runs automatically at startup. Do not remove this directory as a routine reset if it contains data you want to keep.

## Verification commands

```sh
npm test
node scripts/smoke-product-account.mjs
npm run typecheck --workspace @campus/mobile
npm exec --workspace @campus/mobile -- expo install --check
npm run bundle:ios --workspace @campus/mobile
```

The process smoke uses temporary data and local port 14318, cleans up only its own temporary folder/process, and never prints codes or tokens. `npm test` builds backend output needed by the smoke. The iOS bundle export writes ignored `apps/mobile/dist`; it is not an installed/running iOS application.

## Configuration

`CAMPUS_PORT` defaults to 4318, `CAMPUS_DATA_DIR` to `.local/campus`. Host stays `127.0.0.1`. For another local port, set `EXPO_PUBLIC_API_URL=http://127.0.0.1:<port>/api/v1` when launching Expo; this value is public configuration, never a secret.

SecureStore stores only the opaque session token with device-only keychain accessibility. Private response data is not cached to localStorage. API errors invalidate revoked sessions, preserve credentials for a network retry, and discard old account responses after switching.

## Current limitations

- No simulator/device runtime evidence yet. The latest 2026-10-03 check finds Xcode installed/selected but blocked on license acceptance; earlier absence records are historical. The selected cloud route avoids that local dependency.
- Keychain persistence, keyboard/safe-area/font-size behavior and HeroUI rendering remain to be checked on actual iOS.
- Local web login/admin, public share pages and native reminder code are implemented. Place/source/correction maintenance passed local browser edit → resolution → student API readback acceptance; see `api/campus-maintenance-api.md` and `progress/evidence/campus-maintenance/browser-acceptance.md`. Existing-route timetable and holiday maintenance now passed browser save and public-query readback; see `api/shuttle-maintenance-api.md`. New route creation and independent suspension workflows remain outside this editor. Native tab retention and input guards are implemented; keyboard, gestures, accessibility and visual quality still require iOS runtime acceptance.
- The prototype contains no real external email, private school connection, remote push or public hosting.
- Current dependency audit findings are tracked in `progress/e1-dependency-review.md`; development dependency resolution does not imply a clean security audit or public-release readiness.

Public transport live smoke (explicit network use, unlike ordinary tests):

```sh
npm run build:core
node scripts/smoke-public-transit.mjs /tmp/hkust-public-transit-smoke.json
```

This starts a temporary local HTTP server/database, discovers live KMB/GMB route variants and checks selected HKUST stops/ETA envelopes, then closes/removes only its temporary resources. A valid empty prediction list is expected outside service hours; it does not establish suspension. Operator failures cause this live acceptance probe to fail with a report, while the native UI displays an unavailable state. See `docs/api/campus-api.md` for coverage and freshness policy.

Activity lifecycle smoke (local HTTP and persisted SQLite; no external network or mail):

```sh
npm run build:core
node scripts/smoke-social.mjs /tmp/hkust-social-smoke.json
```

The native Discover tab now supports publishing/editing activities and study groups, condition filters, private participation/saves, comments and organizer management. Inbox displays persistent in-app notices/read state; Today links saved activity projections to their participation page. All activity content is explicitly local/demo. Campus wall/help/replies and report/block/moderation APIs are connected; native My account includes own reports and blocked users. Device reminder code, restricted local admin and public share pages now exist; actual device reminder delivery is unverified. See `docs/api/social-api.md` for precise state/visibility and retry rules.

Wall and governance smoke (real local HTTP, no external network/mail):

```sh
npm run build:core
node scripts/smoke-wall-governance.mjs /tmp/hkust-wall-smoke.json
```

This uses temporary demo accounts, including a test admin role, and checks restart persistence, wall/reply/resolve messages, admin report review, block-induced withdrawal/promotion and deletion. API details are in `docs/api/wall-governance-api.md`. The earlier E4 unit had 175 passing tests; current evidence is in `progress/ios-mvp-v1-handoff.md`. Mobile TypeScript and iOS export checks do not demonstrate an installed/running iOS app. Native evidence requires actual execution on an iPhone or simulator, including when the binary is built in the cloud.


## Native navigation and unsaved work

Visited bottom tabs retain their own mounted page, scroll position, selected content and form state in memory. Inactive scenes are excluded from touch/accessibility; their feed/transport focus effects stop, and active data reloads on re-entry. Session identity changes remount the scene host, clearing private input. Nothing here is a durable offline draft store.

Study, activity, wall and ICS forms protect Back/target replacement. Switching tabs retains input; leaving a changed form requires an explicit choice. Uncertain writes retain their request receipt. A notification aimed at a protected scene is queued behind an Open reminder action, not allowed to overwrite the editor. Joining sheets are hidden with their scene.

Account exit now checks retained input across every tab. Pending work blocks sign-out/deletion; drafts and unconfirmed results require a decision, and deletion always requires confirmation. An old confirmation is rechecked against account identity and the current protection level before it can execute. Profile edits participate in these guards, including navigation into reports/blocked users. Account actions suppress repeated taps and ignore UI callbacks after unmount; StudyForm also ignores completion after leaving its account. This protects in-memory input, not durable drafts or recovery after an app crash. See `progress/evidence/native-account-exit/acceptance.md` for the backend/controller evidence and remaining native runtime checks.

Study creation retries freeze the original payload and receipt, suppress simultaneous submits and stop automatic replay before the server's 24-hour receipt expires. Versioned edit replay can return VERSION_CONFLICT after a lost response; it requires checking saved data rather than claiming success. Test evidence: `progress/evidence/native-continuity/`. Native keyboard/VoiceOver/scroll preservation still needs simulator or device execution.

## Dependency gate update — 2026-10-03

The root test runner is now pinned to Vitest4.1.11with Vite6.4.3. Node22.23.1was used for validation. `npm test` executes250tests; root/Next build, native typecheck and iOS export pass. This does not replace simulator/device validation.

If updating dependencies with npm10.9.8fails in Arborist with `Cannot read properties of null (reading 'edgesOut')`, do not use `audit fix --force` or downgrade Expo. The scoped upgrade here succeeded with a one-off `npm exec --yes --package=npm@12.2.0 -- npm install --save-dev --save-exact vitest@4.1.11 vite@6.4.3 --ignore-scripts`. This is a recorded repair command, not a command to run on every startup; it did not replace global npm. Keep existing lockfile/backups and review dependency changes.

`npm run release:check` now scans tracked and nonignored untracked files. Its dependency gate still fails for the unresolved Expo→node-forge1.4.0signature-verification advisory(4related high audit entries; no critical entries). Do not suppress the gate or claim release readiness. Endor assessment remains UNKNOWN because the tools are unavailable. Detailed evidence: `docs/progress/evidence/dependency-gate/acceptance.md`.

## Administrator input continuity (2026-10-03)

The four web admin modules now register drafts and pending work with one parent guard. Same-account reconnect retains input; logout and destructive report selection/filter refresh require a discard decision; same-origin navigation links are guarded. Session expiry locks/hides editors until the original administrator returns. `X-Campus-Admin-Id` additionally prevents retained editors from issuing requests under a different administrator cookie. Missing-cookie logout remains protected by Origin/CSRF and can clear a locked editor.

Drafts are memory-only. Browser reload/termination/history handling is not durable recovery, and native iOS UI acceptance is unchanged. Actual Chrome390px, reconnect/failure/reauthentication, discard and keyboard evidence: `progress/evidence/admin-input-protection/acceptance.md`. Gateway contract: `api/admin-session-api.md`.


## Native inbox continuity (2026-10-03)

Marking a notification read now updates its row in place using the server timestamp/unread count. It does not reload only page1 and discard older loaded messages. Refresh keeps the loaded page depth; partial failure retains the previous list and labels it stale. Lost acknowledgements expose an explicit same-message retry or refresh check. Account unmount ignores late callbacks.

Run `npx tsx scripts/smoke-inbox.ts` for the real local HTTP read/restart/ownership/destination flow. It uses its own temporary database and local mailbox. Contract and limits are in `api/social-api.md`; evidence in `progress/evidence/native-inbox-continuity/acceptance.md`. This does not verify native scroll offset, keyboard, font scaling, VoiceOver or motion.
