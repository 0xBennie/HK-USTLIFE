# Run the local iOS development MVP

Current unit: accounts and native shell. Learning/campus/social modules still require implementation. The current development shell labels them accordingly.

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
- Cookie-based web login/admin UI, learning/ICS, campus data, activities/community and notifications are subsequent units.
- The prototype contains no real external email, private school connection, remote push or public hosting.
- Current dependency audit findings are tracked in `progress/e1-dependency-review.md`; development dependency resolution does not imply a clean security audit or public-release readiness.
