# iOS cloud development build

Selected by the user on 2026-10-03. Uses the existing Expo57/React Native app; no migration and no local Xcode requirement. This is internal development distribution, not TestFlight or App Store release.

## Prepared locally

- `apps/mobile/eas.json`: a physical-device development client, internal distribution, explicit development environment and Node22.23.1. No production/submission profile or auto-submit.
- SDK-compatible `expo-dev-client` and its config plugin. Existing native application identity is preserved: `local.hkustcampus.development`. Its availability in the user's Apple team is not yet verified.
- Root `.easignore`: exclude local databases, login-code files, environment files, key material, student calendar exports and design/evidence files. This replaces `.gitignore` for EAS archive filtering, retaining the existing ignore rules.
- Workspace commands pin EAS CLI24.10.0 through npm exec/npx; no global CLI installation.
- `device:check` reports missing project linkage or device API configuration. Passing it is only config validation, not network/signing verification.

## Account and build steps

Run from the repository root unless stated otherwise:

```sh
npm --workspace @campus/mobile run eas:login
npm --workspace @campus/mobile run eas:whoami
npm --workspace @campus/mobile run eas:init
npm --workspace @campus/mobile run eas:device
npm --workspace @campus/mobile run build:ios:cloud
```

The user completes official browser login themselves; do not share passwords, 2FA codes or session tokens in chat. `eas:init` must link/create the project in the intended personal/team account; never invent its UUID. Device registration requires the actual iPhone. Cloud internal iOS distribution requires an active Apple Developer Program membership and valid signing/provisioning. Creating these external resources depends on verified account ownership and user access, not local config alone.

Install the resulting build on the registered iPhone and enable Developer Mode as required. A development client opens Metro; it is not an offline demo with fabricated school data. JavaScript changes normally use Metro, while native dependency/plugin changes require another cloud build.

## Backend and Metro connectivity

The current backend is explicitly local-only: `src/product/config.ts` requires127.0.0.1 and uses file-based demo login codes. Keep that constraint. A phone's127.0.0.1 is the phone, not the development Mac. Metro connectivity and API connectivity are separate.

Before full device acceptance, provision an approved HTTPS test backend with appropriate authentication and test data, or design an explicitly approved restricted private test connection. Do not expose the current development login service to a public tunnel or simply change its bind address.

Set `EXPO_PUBLIC_API_URL` to the actual phone-accessible backend's `/api/v1` address in the mobile environment. This URL is public build configuration and must contain no credentials. No address has been provisioned by this setup. The Expo project UUID also must be real.

```sh
npm --workspace @campus/mobile run device:check
npm --workspace @campus/mobile run start:device
```

`start:device` runs the preflight and then starts the development-client Metro server on LAN. The phone must be able to reach that computer. An isolated network needs a separately chosen connection method. The preflight rejects loopback/default API configuration but does not test whether a configured server is trustworthy or reachable. If bypassed, the unchanged app still defaults to local loopback; never claim that is device-ready.

## Evidence and remaining work

Cloud configuration, JS export, native binary compilation, device installation and real interaction acceptance are separate results. Record cloud build ID/status and install evidence when they actually exist. Then run the learning, campus and social journeys on iPhone, including system permissions, keyboard, navigation, weak-network recovery, account isolation and motion. SSO/SIS remain separate unimplemented integrations.

The initial CLI account check returned `Not logged in`; browser login was initiated, with completion not yet confirmed. No cloud project ID, signing profile, cloud build ID or install link is currently recorded. Existing dependency findings must remain visible; configuration success is not release clearance. Package review via Endor is unavailable in this session, so its verdict remains UNKNOWN rather than approved.

Official references: [monorepo setup](https://docs.expo.dev/build-reference/build-with-monorepos/), [development builds](https://docs.expo.dev/develop/development-builds/introduction/), [iOS device setup](https://docs.expo.dev/get-started/set-up-your-environment/?device=physical&mode=development-build&platform=ios), [archive exclusions](https://docs.expo.dev/build-reference/easignore/).
