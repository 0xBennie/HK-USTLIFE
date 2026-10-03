# EAS native preparation evidence — 2026-10-03

Goal unit: prepare the user-selected cloud build and iPhone route without treating compilation/configuration as device acceptance. Previous goal turn was progress: installed the explicitly requested Expo plugin and implemented cloud-development configuration.

## Current external state

- Existing browser-login handle56797 responded as running and waiting; it was not restarted. EAS CLI identity still returns `Not logged in`.
- Xcode now exists at `/Applications/Xcode.app`, including iPhoneOS27.0 SDK. Apple tools report unaccepted license. Direct simulator inventory has no runtime and no available devices. No acceptance/install/system changes made.
- No confirmed Expo project linkage, Apple membership/team, registered iPhone, signing profile or phone-accessible test backend.

## Executed preparation

1. Used EAS CLI24.10.0's actual `makeShallowCopyAsync` implementation with repository-root `.easignore` to create an isolated local copy (255 files). Audited copied paths for local data, environment files, signing credentials and student export patterns; no matches or source symlinks. Required shared `src/design/icons.ts` and mobile/build inputs retained. This is a local copy, not an EAS-uploaded archive or a content-level secret clearance.
2. Linked the already installed dependencies into the copy after its audit; no package install or dependency change in this unit. These links are local preflight conveniences, not cloud artifacts.
3. Ran `expo prebuild --platform ios --no-install` in that copy with telemetry disabled. Exit0; created Campus.xcodeproj, native source, plist and Podfile. Primary worktree received no generated ios directory.
4. Parsed generated output: bundle ID `local.hkustcampus.development`; deployment target16.4; schemes include `exp+hkust-campus-local`; local-network purpose string and `_expo._tcp` present. Generated entitlements include `aps-environment=development`; valid Apple provisioning is still required. No remote push token registration/delivery was added or verified.

Logs and metadata: `.local/eas-native-preflight/{prebuild.txt,archive-result.json,native-config-result.json,simctl.json,simctl-stderr.txt,path.txt}`. Temporary copy path is recorded locally in path.txt; do not commit or upload its dependency symlinks.

## Limits and next action

No CocoaPods install, native compilation, signing, cloud upload, device installation or UI/motion/notification acceptance. The earlier EAS archive-inspect command required Expo login; the local copy does not claim that command passed. None of MV01–MV12 is newly marked complete by this preparation.

Next: complete existing official browser login, confirm intended account/team and actual Apple membership/device, link the project and inspect/sign/build through EAS. Full app operation on that iPhone additionally needs approved backend connectivity; keep local demo auth off the public network. SchoolSSO/SIS data access remains an independent approval dependency.

Fresh resumed blocked audit: first continuation after cloud-route implementation. No blocked/complete status update this turn; meaningful native-preparation evidence was produced and the external login handle remains live.
