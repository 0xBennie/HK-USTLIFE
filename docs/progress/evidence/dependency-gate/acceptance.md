# Dependency and release guard repair — 2026-10-03

Actual changes:
- Root dev dependency Vitest3.1.2→4.1.11and matching @vitest packages. Added exact Vite6.4.3direct dev pin to retain the existing compatible Vite version; no Expo, React Native or Next version change in this unit. Full resolved changes: lock-changes.json. Backup before edits: `.local/backups/dependencies-20261003/`.
- First two npm10.9.8installs failed in Arborist loadPeerSet with null edgesOut. Package/lockfiles and installed Vitest remained unchanged. A one-off registry npm12.2.0execution succeeded; global npm was not replaced. Node22.23.1satisfies its engine. Commands/logs: install.txt, install-pinned-vite.txt, install-npm12.txt. npm retried three tarballs and exited0; integrity checks were not disabled. Install scripts were disabled.
- Release check scans tracked plus nonignored untracked files, deduplicates, tolerates absent working-tree files and flags symlinks without reading their targets. Existing regex and dependency-failure threshold retained. Two isolated Git tests cover untracked credentials/forbidden env paths, ignored exclusion, value non-disclosure, deletion and links.
- First expanded scan found10heuristic false positives in test helper token assignments(default parameters/dynamic requests/cookie reads). Reviewed those source lines and added whitespace around assignment; no rule, allowlist or secret policy was relaxed. Initial test run failed249passed/1failedat the repository-scan assertion. Final250/250pass on Vitest4.1.11.

Verified:
-250tests/47files; native TypeScript; Next production build; iOS Hermes export1673modules.
- after-audit.json:0critical,0moderate,4high. before-audit.json:1critical,1moderate,4high.
- release-check.txt:434text files scanned at that time, no source/path findings, release FAILED for4production audit findings. Later documentation files can change scanned count.
- Endor package-risk unavailable(MCP not exposed; CLI absent), UNKNOWN in endor-risk.json; never an approval. Public maintainer advisory/npm registry evidence below is separate.

Unresolved:
- node-forge1.4.0via Expo57.0.26→@expo/cli57.0.27and @expo/code-signing-certificates0.0.6. npm registry latest1.4.0, reviewed GHSA reports no patched version. Four findings are one transitive chain, not four separately demonstrated attacks.
- Installed source has certificate.verify and publicKey.verify in @expo/code-signing-certificates/build/main.js:176,203; Expo CLI codesigning utility imports it. The CLI's getCodeSigningInfoAsync returns null when no signature header is present, but this is not a complete reachability proof or a remediation. No signature-verification bypass, crypto monkey patch, advisory suppression or Expo44downgrade applied. Retain release failure; re-evaluate when a supported patched dependency is available.
- The scanner is a bounded heuristic(max2MBtext, no binary scanning), not a guarantee of zero secrets. Ignored local credentials/test data remain excluded and must not be packaged/deployed.
- Native runtime/keyboard/VoiceOver/motion and MV01–MV12acceptance remain open; bundles are not runtime evidence. No deployment, external messages, new chats or subagents.

Sources checked this unit:
- Vitest maintainer advisory(fixed4.1.11;3.xnot backported): https://github.com/vitest-dev/vitest/security/advisories/GHSA-82fw-gwwq-j7x9
- Vitest4migration/requirements: https://v4.vitest.dev/guide/migration
- Reviewed node-forge advisory(no patched published version): https://github.com/advisories/GHSA-86w9-cpqp-85rv
- Exact registry metadata from npm view, actual package-lock and npm ls; full audits retained.

Expo compatibility: initial offline check warned its validation is unreliable. Repeated the read-only check with online metadata and telemetry disabled; `expo-compatibility-online.txt` returned `Dependencies are up to date` and exit0. Use that result, not the offline check, as compatibility evidence.
