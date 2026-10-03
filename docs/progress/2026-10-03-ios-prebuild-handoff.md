# Native prebuild and retained school cache cleanup

Worktree campus-school-sync; branch codex/campus-school-sync; base 17d5064. Previous turn delivered source-management implementation; this turn generated native project and completed retained-cache cleanup path. Full goal remains active.

## Native environment
`npx --no-install expo prebuild --platform ios --no-install` completed in apps/mobile, generating ios/Campus.xcodeproj and Podfile. package.json unchanged. Generated ios directory is ignored and reproducible from app.json, not a hand-maintained source artifact. Pods are not installed, no xcworkspace/build/runtime evidence yet.

No CocoaPods command was installed. Started project-local `gem install cocoapods -v 1.16.2 --install-dir .local/ios-gems --no-document` using system Ruby2.6.10; no global install. LIVE exec session 40264, PID18584 last verified alive, ~2m50 elapsed, no output. RubyGems official specs URL independently returned HTTP200. This does not establish Ruby dependency compatibility or installation success. Poll exact session before deciding next step; if it fails, inspect failure before choosing a local compatible Ruby/dependency setup.

Simulator download remains exec session57095, Xcode process13422 last verified. iOS27.0 (24A434) arm64 8.05GB. Last observed before this unit ~11.6%; do not restart on a stale progress note, revalidate live handle. No runtime/boot yet.

## Product change
SchoolSourcesScreen now lets the owner delete previously retained cache after revocation. It keeps local connection revoked, uses latest version, states that private notes/preferences are deleted, and requires confirmation. Backend existing transaction cascades cached personal data. Added loading-state copy. Pen node jLkgF saved/exported and visually checked.

Evidence: retained-cache-tests.log 53 files/318 tests passed; retained-cache-typecheck.log passed; diff check passed. Extended real API + native controller test covers keep cache then delete, export empty and other-account isolation. Actual native touch/Alert/keyboard/VoiceOver still pending.

Next: poll both live installation handles, complete Pods and native build when prerequisites permit, then device interaction acceptance. Continue unmet school-auth and R1.1 work independently; no completion claim.
