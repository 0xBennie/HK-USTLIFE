# Native runtime prerequisite — 2026-10-03

Previous goal turn: progress (campus actions/controller/navigation fixes,289tests/50files, native TypeScript and export passed). Current turn checked the remaining required runtime rather than adding unrelated work or repeating green checks.

## Live evidence

`environment.json` was collected at2026-10-03T00:53:49Z:

- Active developer directory `/Library/Developer/CommandLineTools`.
- `xcrun --find simctl` exit72: unavailable. `xcodebuild -version` exit1: requires Xcode.
- Spotlight Xcode bundle search returned no result; standard, user Applications and shallow mounted-volume candidate searches found no Xcode app.
- USB inventory completed successfully and contained no iPhone/iPad/iPod names. This does not rule out a disconnected or wireless device owned by the user.
- No `idevice_id` tool present; none installed.

`runtime-inventory.json` follows up the existing CoreSimulator directory:

- Ten old device records refer to iOS16.4, but no runtime bundles exist in the inspected installed/mounted runtime locations.
- No Xcode-named item in system/user Applications or Downloads; no matching Xcode/Simulator/installation-helper process observed.
- Device plist records are not evidence of an executable or booted simulator. There is no confirmed live installation job to wait for.

## Why this stops the current goal

MV01 explicitly requires running iOS. MV08/MV09 and the three acceptance journeys require actual system notification, keyboard, safe-area, font and touch behavior. Pen/browser prototypes, API controllers and bundle export do not prove these. The acceptance matrix keeps those requirements incomplete.

The same missing runtime has been recorded in consecutive account-exit, study-save/audit, campus-action and current goal turns. Independent confirmed implementation gaps were repaired in those turns. Current next required action is real iOS execution; there is no established runnable environment or authorized device path. Further speculative controller changes would not resolve it. This meets the repeated blocker threshold; the goal must be marked blocked, not complete or paused.

The user subsequently deferred Xcode in favor of Pen. A new concise choice is pending: restore Xcode installation/configuration, provide an existing environment/device, or retain the deferral. Installation cannot be inferred from silence. No system changes were made.

## Resume

If the user restores installation authorization, first verify compatible macOS/Xcode/runtime requirements, available space and distribution/account requirements; perform only the authorized setup. If an existing installation is provided, inspect it and prefer a per-process developer directory before changing global configuration. A physical device additionally needs an approved run/network path; the local development authentication server is currently loopback-only and must not simply be exposed to the LAN.

Then run the three journeys in `docs/progress/2026-10-03-mvp-acceptance-matrix.md`, collect actual screenshots/versions/results, fix demonstrated failures and rerun affected checks. Preserve every existing worktree change. No automatic deployment, App Store/TestFlight submission, external messages, new chats or subagents.
