# E1 dependency evidence

Selected Endor profile: `package-risk`. Exact requested additions: fastify 5.12.5, expo 57.0.26, heroui-native 1.0.10, uniwind 1.12.1 and their pinned SDK peers.

Endor risk posture: UNKNOWN. Data gaps: no Endor MCP tool exposed, no `endorctl` executable. The dependency-reviewer workflow was read inline; no subagent, account setup, scan or global plugin change performed. This is not an Endor approval and does not prove these packages unsafe.

Independent evidence: current npm registry metadata and Expo 57.0.26 `bundledNativeModules.json`; HeroUI official quick-start and declared peers. Expo's React 19.2.3 and native 0.86.3 selected. HeroUI's Reanimated ^4.1.1, Gesture Handler ^2.28.0 and safe-area ^5.6.0 accept SDK versions 4.5.1 / 2.32.0 / 5.7.0. Bundle/runtime tests still required.

Initial npm audit after Fastify install reported existing Next/Vitest and transitive issues. Newly used fast-uri must move to >=3.1.8; other existing advisory findings are tracked for dependency remediation before website exposure. No audit-fix --force applied. Installation initially retried several cache tarballs and then succeeded; lockfile integrity retained.

Update 2026-10-03: fast-uri resolved to patched 3.1.8 and 4.2.1. Mobile TypeScript aligned to 6.0.3; Expo dependency check and iOS export passed. Global npm cache later failed; installation succeeded using project-local cache with lifecycle scripts disabled. Final audit retained as `evidence/e1/dependency-audit.json`. Expo currently depends on node-forge 1.4.0 (latest registry version in this check), with an RSA signature-verification advisory; no certificate verification/remote signing used by this local flow. UUID/Xcode toolchain advisories remain; no downgrade/override guessed. Track for native build and release assessment.

Sources: https://heroui.com/en/docs/native/getting-started/quick-start and npm registry exact package metadata. No public release implied.
