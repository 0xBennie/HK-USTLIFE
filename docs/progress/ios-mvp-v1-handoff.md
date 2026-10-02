# iOS MVP v1 — implementation handoff

## Goal and confirmed choices

Native iOS local development MVP per `docs/superpowers/specs/2026-10-02-ios-mvp-v1-product.md`; all MV01–MV12 required. Expo/React Native/TypeScript, HeroUI Native candidate, persistent backend, voluntary social use. No public deployment or external email. No subagents.

## Status — updated 2026-10-03

- Product scope, long-term roadmap, proposed API and Goal prompt committed before implementation.
- E1 account backend and native account shell implemented and independently checked; native runtime/visual acceptance remains blocked. Plan: `docs/superpowers/plans/2026-10-02-e1-account-native-foundation.md`.
- E2 learning/ICS, E3 campus, E4 social, E5 governance/web, E6 native acceptance pending.
- Implemented code: `src/product/`, `apps/mobile/`; tests: `tests/product-auth.test.ts`, `tests/mobile-session.test.ts`; process smoke: `scripts/smoke-product-account.mjs`.
- Start guide: `docs/development-ios.md`; actual API: `docs/api/implemented-mvp-api.md`; evidence: `docs/progress/2026-10-03-e1-verification.md`.
- Full Goal remains active and incomplete. No MV case fully closed, no iOS screenshots yet.

## Environment / dependencies

2026-10-02: Node 22.23.1/npm 10.9.8. Active developer directory is CommandLineTools; no Xcode found through Spotlight or standard Applications inventory. Full Xcode + iOS simulator runtime needed for native acceptance; do not mark Goal complete without real iOS evidence.

## Execution record

- Baseline HEAD `ba2b0b0`, branch `feat/hkust-life-mcp`, clean.
- Ruling: execute directly in existing feature checkout and self-review; user disallows subagents and authorizes reversible work.
- Ruling: local SQLite + loopback-only development mail are initial backend adapters; production mode refuses startup until approved production adapters exist.
- Verification: 65/65 tests (49 existing + 11 account + 5 mobile session), real HTTP process restart passed, mobile typecheck and dependency compatibility passed, iOS Hermes bundle exported (1554 modules). Full native launch not possible: `xcrun simctl` unavailable.
- Ruling: native bearer sessions are implemented now; cookie/CSRF browser auth in the earlier proposed API remains future work, documented separately. No browser cookies accepted by current backend.
- Ruling: mobile SDK 57 requires TypeScript 6.0.3; only mobile compiler upgraded. React 19.2.3 selected for native bundling independently of website React 19.2.8.
- Ruling: npm global cache was damaged; use ignored project-local cache, no global cleanup. Endor risk lookup unavailable; npm audit evidence captured, not an approval.
- Self-review fixed delayed private-export response after account switching, covered RED→GREEN. No subagent used.
- Next: write E2 implementation plan, implement private courses/schedules/tasks/notes/links and ICS preview/import. Continue independently of Xcode. Later native acceptance must still be completed.
