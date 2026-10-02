# iOS MVP v1 — implementation handoff

## Goal and confirmed choices

Native iOS local development MVP per `docs/superpowers/specs/2026-10-02-ios-mvp-v1-product.md`; all MV01–MV12 required. Expo/React Native/TypeScript, HeroUI Native candidate, persistent backend, voluntary social use. No public deployment or external email. No subagents.

## Status — updated 2026-10-03

- Product scope, long-term roadmap, proposed API and Goal prompt committed before implementation.
- E1 account backend and native account shell implemented and independently checked; native runtime/visual acceptance remains blocked. Plan: `docs/superpowers/plans/2026-10-02-e1-account-native-foundation.md`.
- E2 manual learning implemented (courses, events/tasks/notes/links, day/week query and connected native forms); **ICS remains next**. E3 campus, E4 social, E5 governance/web, E6 native acceptance pending.
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
- E2 evidence: `docs/progress/2026-10-03-e2-manual-learning-verification.md`; plan: `docs/superpowers/plans/2026-10-03-e2-learning.md`; actual API: `docs/api/learning-api.md`.
- E2 implementation paths: `src/product/learning/`, migration 2 in `src/product/database.ts`, `apps/mobile/src/study/`, Today routing; tests `tests/product-learning.test.ts`, `tests/study-dates.test.ts`, extended mobile-session/process smoke.
- Current verification: **92/92 tests**, real process restart with course/event/task/note persistence, completion/version/export, native typecheck and iOS export (1558 modules). No new dependencies. No actual iOS runtime evidence yet.
- Self-review fixed malformed URL/offset 500 → 400, protected unchanged timestamp precision, tested midnight boundaries/DST, and prevented mismatched old calendar ranges from appearing under a new query header.
- Previous Goal turn classified progress; this turn adds verified learning implementation. No blocking audit threshold: meaningful work remains and is progressing.
- E2 ICS parser boundary now implemented in `src/product/calendar/ics.ts` with `ical.js@2.2.1` and 14 tests in `tests/product-ics.test.ts`. Exact coverage/limits/dependency evidence: `docs/progress/2026-10-03-e2-ics-parser-verification.md`; detailed plan `docs/superpowers/plans/2026-10-03-e2-ics-parser.md`.
- Latest full suite: **106/106 tests**, backend and mobile TypeScript passed. No new native runtime or screenshot evidence. Same 18 dependency audit findings; no ical.js advisory reported by npm, Endor signal unavailable.
- Current Goal turn classified progress: actual recurrence parser, DST/custom-zone validation and tests added. Full import feature is still incomplete: no preview/confirm API or native file picker yet.
- Next: characterize UNTIL and exception membership/EXDATE precedence, then source/preview persistence, transactional idempotent confirm and local-edit conflicts, integrate expanded candidates with calendar day grouping, native file selection and preview. Preserve rules rather than materializing a fixed semester. Then E3 → E4 → E5 → E6 unchanged. Continue independently of Xcode; native acceptance remains mandatory.

## E2 persistent ICS import — 2026-10-03

- Previous turn supplied the requested Goal prompt but made no implementation progress; this continuation resumed safe implementation rather than declaring a blocker.
- Added migration 3, source/series/preview persistence, owner-scoped preview/confirm/source delete APIs and version 3 private export. Partial reimports preserve unseen UIDs; identical confirmation retries replay; stale snapshots reject atomically; UID-less entries require explicit acknowledgement. Parser now verifies UNTIL boundaries, exception membership and EXDATE precedence.
- Paths: `src/product/calendar/store.ts`, `routes.ts`, `ics.ts`; `tests/calendar-store.test.ts`, `product-learning.test.ts`, `product-ics.test.ts`; `docs/api/calendar-import-api.md`; plan `docs/superpowers/plans/2026-10-03-e2-ics-import.md`.
- Verification: root build + **115/115 tests** passed; mobile TypeScript passed. Six real-SQLite store tests and HTTP integration cover reopen persistence, isolation, expiry, replay, stale version, partial reimport, export and deletion. No new dependency. No native launch evidence.
- Remaining E2: calendar occurrence integration, local occurrence overrides and explicit source-update conflict handling, native file selection/preview/confirm; preview presentation/retrieval and retention bounds. Imported series currently persist/export but do not appear in calendar views. Continue these next, then unchanged E3–E6. Full Goal remains active; Xcode runtime acceptance still unproven.

## E2 imported calendar projection — 2026-10-03

- Previous Goal turn classified progress (committed persistent preview/confirm). This continuation connects imported recurrence rules to `/me/calendar`, existing timezone/day grouping and native day/week cards.
- Imported identity remains source/series/original recurrence ID across moved occurrences and overlapping query windows. Date-only stays date-only; unknown ends remain null; cancelled and excluded occurrences are absent. Private imported data remains owner scoped. Native cards display source/tentative/unknown participation and do not route imported IDs into manual-item edit/delete APIs.
- Expansion failures now return `import_issues`, displayed as a partial-result warning, alongside valid records. Candidate output capped at 5,000, retaining whole series or reporting an issue. No fabricated imported record creation/update timestamps.
- Verification: **117/117 tests**, root build, mobile TypeScript, iOS Hermes bundle export (1,558 modules) passed. New HTTP scenario covers weekly recurrence, EXDATE, move/cancellation, multi-day all-day, timezone boundary, stable IDs, source deletion and other-owner isolation. SQLite test verifies bounded-expansion failure remains explicit while valid series render.
- No actual iOS execution or screenshots; bundle remains compile evidence only. Import cards are temporarily read-only; native file picker and dedicated occurrence edits/source-update conflict handling still required. Next implement those flows plus preview retrieval/diff/retention limits; then E3–E6. Full scope unchanged, Goal active.

## E2 private occurrence edits and source conflicts — 2026-10-03

- Previous turn classified progress (calendar projection commit). Added migration 4 for owner-scoped full private occurrence snapshots, dedicated versioned PATCH, export/cascade, on-demand original recurrence lookup, and explicit per-series keep_local/use_source reimport decisions. Local edits invalidate outstanding previews. Source rule retained independently.
- Native day/week cards now offer edit-this-occurrence and reuse the validated event form with a dedicated endpoint. Source-missing private appointments show an explicit warning. Course association is not offered on imported occurrence editing; the edit form uses its documented Hong Kong time input.
- Tests cover moved occurrence outside original query, unchanged siblings, stale version, invalid ID/other owner, reopening persistence, source deletion cascade, required conflict decision, keep vs replace, and source-removed occurrence retention. HTTP integration verifies end-to-end edit/projection/conflict resolution.
- **121/121 tests**, backend build, mobile TypeScript and iOS bundle passed. No actual iOS runtime evidence. Full Goal remains incomplete.
- Remaining E2: native ICS file picker/preview/selection/conflict review; human-readable preview differences and retrieval; reset/private cancellation management; bounded preview history/source limits; reminders later in E5. Current conflict resolution deliberately applies per series to full private occurrence snapshots and must be explained by the review UI. Then E3–E6 unchanged. Next directly implement import screen and backing preview improvements; no need to repeat product research.
