# iOS first actual runtime handoff

## Objective and ownership
- Active R1 + R1.1 goal remains incomplete; this unit unblocks actual iOS acceptance.
- Worktree: `/Users/bennie/.codex/worktrees/campus-school-sync/All in one HKUST`; branch `codex/campus-school-sync`; PMO base `b036e577a9d2769dcd0dbe4bd20e27a3e8c6881c`.
- No shared source/dependency edits, deployments, real emails, school credentials or external account changes.

## Changes
- `apps/mobile/plugins/with-ios-scene.cjs` and app.json: persist Expo SDK 57 scene migration. Existing Expo 57.0.26 supplies `EXExpoAppSceneDelegate`; AppDelegate provides factory and no longer creates a legacy window. Refuses unknown templates/versions/manifests; no new package installed.
- `scripts/fix-ios-script-paths.rb`: exact-match repairs for generated EXConstants and React Native bundle shell scripts when checkout contains spaces. Repeat invocation verified idempotent.
- `docs/development-ios-local-toolchain.md`: regeneration, Pods, signing, build and loopback network guidance.
- `tests/native-ios-scene.test.ts`: preserves factory/linking, prevents duplicate old startup and rejects changed template.

## Actual evidence
- Xcode 27.0 / iOS 27.0 / iPhone 18 Pro simulator `79EDA71B-E32F-421A-986B-7FA991BB1B0A`.
- Pods reinstalled successfully following prebuild recreation of ios; 105 Pods (log `.local/school-sync/scene-pods.log`).
- Scene build and subsequent signed simulator build succeeded. Logs `.local/school-sync/xcode-scene-build.log`, `xcode-signed-simulator-build.log`.
- Signing disabled initially caused keychain entitlement errors. Rebuilt with `CODE_SIGNING_ALLOWED=YES CODE_SIGN_IDENTITY=-`; startup error absent and local login plus restart session restoration succeeded. No physical-device signing or APNs claim.
- Metro runs on IPv6 localhost but manifest advertises IPv4: task-local TCP bridge `127.0.0.1:8087 -> [::1]:8087` resolves bundle loading, without exposing LAN listeners.
- CUA/Device Hub observed Campus business UI, all five tabs, campus route detail with source/runtime data, local test login (`native.acceptance@example.test`), profile save, process termination/relaunch restoring session.
- Created private task `验证 iOS 跨页任务状态` through native form, saved, checked completed, navigated to 全部记录 and saw checked completed state. Keyboard dismissed via touch drag before saving; do not confuse native wheel events with touch scroll.
- Screenshot and full AX state: `docs/evidence/ios-2026-10-04/completed-task.png`, `completed-task-ax.txt`.
- Focused tests: 1 file / 2 tests passed (`.local/school-sync/scene-tests.log`). Generated manifest/provider and idempotence also inspected. Prior 57/345 product suite not rerun for this build-only change.

## Active processes and data
- API existing exec17914 / port4328, `CAMPUS_DATA_DIR=.local/native-acceptance`; real isolated SQLite, local-only OTP mail spool. No real email delivered.
- Metro existing exec76296 / port8087. Bridge exec59699. Recheck handles before restarting; preserve running services.
- Simulator application ID `local.hkustcampus.development`. Business API `http://127.0.0.1:4328/api/v1`.
- Raw build/server logs under ignored `.local/school-sync`; do not commit OTPs, auth secrets, SQLite or logs with tokens.

## Remaining / next
- Full native acceptance is not complete: two accounts, social concurrency/governance, school-source failure/revocation, reminders, weak networks/unknown writes, deep links, accessibility, typography, dark/reduced-motion and motion still need actual runtime exercises.
- Real approved HKUST identity/SIS/Canvas transport remains unavailable. Local email login is explicitly not school identity or enrolment.
- R1.1 X01–X03/X05 and own saved reconnection-choice entry still need implementation/acceptance as previously tracked.
- The screenshot demonstrates an actual simulator business flow; it does not establish final visual quality, Pen parity, physical-device or full PRD acceptance.

Additional cold-start evidence: after task completion, terminated and relaunched the App again, navigated to 全部记录 and confirmed the same task remained checked/completed. See `task-after-relaunch.png` and `task-after-relaunch-ax.txt`. Reproducible loopback bridge helper saved as `scripts/metro-loopback-bridge.cjs`; the currently running bridge remains the identical inline implementation under exec59699.
