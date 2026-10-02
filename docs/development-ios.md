# Run the local iOS development MVP

Implemented code: local accounts, private courses/day-week schedules/tasks/notes/material links and ICS import; reviewed campus shuttle/directory and public KMB/GMB queries; activities/study groups and wall/help/replies; private inbox and report/block/moderation APIs. Native screens connect to these real stores. Device reminders, restricted admin website/source maintenance, public website/share and actual iOS runtime acceptance remain incomplete.

## Requirements

- Node 22.23+ and npm. Built-in `node:sqlite` currently emits an experimental warning; local use is tested on 22.23.1.
- Full Xcode with an installed iOS Simulator runtime for actual native execution. CommandLineTools alone is insufficient.
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

- No simulator/device runtime evidence yet: Xcode is absent from the inspected environment.
- Keychain persistence, keyboard/safe-area/font-size behavior and HeroUI rendering remain to be checked on actual iOS.
- Web login/admin UI, content/source maintenance, native reminders and public website/share remain subsequent units. Native visual polish, transitions, keyboard/accessibility and draft recovery across top-level tabs remain unverified or incomplete.
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

The native Discover tab now supports publishing/editing activities and study groups, condition filters, private participation/saves, comments and organizer management. Inbox displays persistent in-app notices/read state; Today links saved activity projections to their participation page. All activity content is explicitly local/demo. Campus wall/help/replies and report/block/moderation APIs are connected; native My account includes own reports and blocked users. Device reminders, restricted admin web UI and public share website are not yet delivered. See `docs/api/social-api.md` for precise state/visibility and retry rules.

Wall and governance smoke (real local HTTP, no external network/mail):

```sh
npm run build:core
node scripts/smoke-wall-governance.mjs /tmp/hkust-wall-smoke.json
```

This uses temporary demo accounts, including a test admin role, and checks restart persistence, wall/reply/resolve messages, admin report review, block-induced withdrawal/promotion and deletion. API details are in `docs/api/wall-governance-api.md`. Latest unit: 175 tests passed, mobile TypeScript and iOS export passed; these do not demonstrate an installed/running iOS app. Full Xcode and an iOS Simulator runtime are still needed to produce native execution evidence.
