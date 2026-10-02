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

## E2 native import workflow — 2026-10-03

- Previous turn classified progress (private occurrence editing). Added native `ImportScreen.tsx`, Today entry, source selection/reimport, .ics system file picker, 256 KiB guard, explicit floating timezone choice, preview selection, before/after summaries, unsupported-entry display, UID-less acknowledgement and explicit conflict choices before confirmation. Shared preview types separated from backend Node dependencies after mobile compiler caught an inappropriate type import; fixed without adding Node shims to native.
- Expo SDK 57 metadata and official docs verified: expo-document-picker 57.0.3 and expo-file-system 57.0.7 pinned; MIT/Expo repository metadata reviewed. Cache copy permits reading; only app-cache copy is deleted after reading, source document unchanged. Endor package-risk tool remains unavailable; risk signal UNKNOWN, not approval. Current root npm audit still 18 findings (12 moderate/4 high/2 critical), none attributed to the added packages; installation's workspace audit reported 12 and is not equivalent to root audit.
- Draft content stays in mounted screen memory. Confirmation retry freezes the chosen payload during an uncertain response; successful save returns to refreshed calendar. Pending source fields disabled. Imported files are explicitly private and not enrolment evidence. Preview has 30-minute expiry and underlying server version checks.
- Verification: **122/122 tests**, root build, mobile TypeScript, Expo dependency compatibility, iOS Hermes export (1,580 modules) passed. Added real-store test for readable before/after start/rule summaries without mutation. Native picker and rendered UI have NOT been executed on iOS; no screenshots. Full Xcode/runtime still required.
- Next E2: source/override management (reset, cancel/restore, source removal), preview retrieval/history bounds, native interaction test coverage and real runtime acceptance. File import UI now exists but must not be described as iOS-tested. E3 campus, E4 social, E5 reminders/governance/web, E6 acceptance remain unchanged and incomplete. Goal active.

## E2 source management and retention — 2026-10-03

- Previous turn classified progress (native import flow). Added owner-only source detail, occurrence status and reset APIs, preview retrieval, and native `SourceScreen.tsx`. Day/week cards cancel one imported occurrence; management shows cancelled overrides for restore/reset. Whole-source delete explains cascade while preserving manual records/notes. Version guards prevent stale status/reset/deletion.
- Confirmation now discards full preview snapshot immediately and retains a 24-hour replay receipt. Pending preview expiry remains 30 minutes; physical cleanup occurs on startup/preview creation/expired access, not via background SLA. Source deletion purges pending source snapshots. Added bounds: 20 sources/2,000 series/200 overrides per owner in addition to pending-preview cap.
- Verification: **125/125 tests**, root build, mobile TypeScript and iOS bundle passed. Actual DB and HTTP tests verify cancellation disappears from calendar but stays manageable, restoration, reset, owner/stale checks, confirmed raw-snapshot removal, replay expiry and atomic source cap. Native runtime/screenshots remain absent.
- E2 core native/backend learning and import paths now implemented; actual device validation and local reminder integration remain open. Next move to **E3 campus transport and directory**, starting with existing adapters/data provenance and a scoped implementation plan. Keep E2 bugs and native acceptance in overall E6 audit rather than declaring the learning feature fully accepted. E4–E6 unchanged; Goal active.

## E3 reviewed school-shuttle catalog and native browsing — 2026-10-03

- Previous Goal turn classified progress (source management). Repository inspection found only specification fixtures/source registry, not a product transit service. Fresh public CSO timetable HTML and 1823 holiday JSON retrieved HTTP 200 with timestamp/SHA-256 under `docs/progress/evidence/e3/`; new E3 plan written. No school-private GPS access.
- Added 24 reviewed direction/boarding entries covering listed commuter/lunch services and 51 dated holidays (2025–2027). North Point morning explicitly same Causeway Bay vehicle; lunch fare unknown. Source data separate from old 3-route test fixture. Eligibility, school verification and unknown disruption status explicit; seven-day review deadline is a product freshness policy.
- Public routes/departures API and native CampusScreen now replace the campus placeholder for visitors. HK date conversion, holidays/Sunday/weekends, service period, exact departure/last trip and stale suppression implemented. No GPS, live ETA, arrival time or seats invented. Reconnect/foreground refresh; errors hide departure details.
- Verification: **130/130 tests**, root build, mobile TypeScript and iOS bundle passed (see command output). Five new domain/visitor-HTTP tests cover date boundaries, official-source catalog facts, unknown routes and malformed time. No real iOS runtime evidence.
- Paths: `src/product/campus/`, `apps/mobile/src/campus/`, `tests/product-shuttle.test.ts`, `docs/api/campus-api.md`; plan `docs/superpowers/plans/2026-10-03-e3-campus.md`.
- Next: E3 verified place/service directory + persistent private bookmarks/corrections, then KMB/GMB route/stop mapping and live-failure handling. Source refresh/admin maintenance in E5; iOS runtime/visual acceptance in E6. Current campus screen is a real timetable subset, not full E3 acceptance. Full Goal active/incomplete.

## E3 directory, private bookmarks and corrections — 2026-10-03

- Previous turn classified progress (shuttle catalog). Captured seven official CSO/library pages HTTP 200 with source hashes and reviewed nine physical place/service entries. Published hours separated from unknown live operating/availability status; official location/action links preserved. Thirty-day directory review deadline is app policy.
- Migration 5, searchable public directory/detail APIs, private bookmark save/remove, retry-safe correction submission/history, private export and account cascade implemented. New correction stays pending and cannot overwrite public data; max 20/day. Existing stored directory edits are not overwritten by seed on restart. Admin handling remains E5.
- Native DirectoryScreen and reusable TargetActions connected: bilingual search/category/detail/source/map links, saved-only place and shuttle lists, login entry for private actions, own correction history. Campus remounts on account switch. No new packages.
- Verification: full suite **135/135 tests**, backend build, mobile TypeScript and iOS export (1,584 modules) passed. Five new real-HTTP/SQLite tests cover visitor query/unknown status, bookmark restart/duplicate-save/isolation/remove, correction dedup/public immutability/private export, forged-owner rejection/account cascade, and stale facts. No iOS runtime screenshots.
- Paths: `src/product/campus/directory*.ts`, migration 5, native `DirectoryScreen.tsx`/`TargetActions.tsx`, `tests/product-directory.test.ts`, evidence directory and updated `docs/api/campus-api.md`.
- Next: E3 public KMB/GMB route-direction-stop discovery and prediction adapter with live-source failure/staleness behavior, then E4 social. E5 review/admin refresh and E6 device acceptance still required. Full Goal active and incomplete.

## E3 public KMB/GMB routes and predictions — 2026-10-03

- Previous turn classified progress (directory). Live official source discovery captured under `docs/progress/evidence/e3/public-transit/`. Added fixed-host KMB/GMB adapters and visitor HTTP routes; allowlisted campus-linked route codes, discovered direction/service variants and stop sequences. KMB predictions filter company/code/direction/service/sequence; GMB validates returned stop ID. No GPS/occupancy/fare or all-Hong-Kong coverage claims.
- Metadata freshness 24 hours, ETA max source age 180 seconds and 15-second cache, 60-second allowed clock skew; bounded responses/timeouts/cache, duplicate request coalescing, failure cooldown. Empty/null/past predictions, disabled service, stale and unavailable are separate; failure never reuses old success. Preserve scheduled-service remarks, no fabricated headway ETA. Missing operator catalog codes explicitly flagged.
- Native PublicTransitScreen: public catalog search → direction/variant → searchable boarding stops → absolute HKT predictions, source links and refresh. Local expiry hides old/past predictions while offline. Foreground/background safeguards; base campus requests stop while directory/public transit subviews are open. No new dependencies. Existing private saves remain place/shuttle scope.
- Verification: **148/148 tests** and backend build passed; mobile TypeScript and iOS Hermes export passed (1,586 modules). New 13 tests cover mappings, duplicates, remarks, empty/disabled/stale/future/offline/malformed/oversize/missing-code responses, local expiry and HTTP input contracts. A previous directory fixture's unspaced variable default triggered the credential scanner after becoming tracked; reformatted to normal variable assignment, with no scanner weakening or secret present.
- Actual live local-HTTP smoke passed: 23 catalog direction/variant entries, 29 stops for 91M outbound and 7 for 11M direction 2, correct HKUST South/North stop identities; both ETA responses were `no_predictions` at the observed nighttime query. Positive-ETA behavior tested with clearly synthetic fixtures, not claimed as observed live arrivals. Repeat script: `scripts/smoke-public-transit.mjs`. Evidence includes `live-http-smoke.json`; no live external messages/accounts.
- Paths: `src/product/campus/public-transit*.ts`, `apps/mobile/src/campus/PublicTransitScreen.tsx`/`transit-state.ts`, `tests/product-public-transit.test.ts`, updated campus API/development docs and E3 plan. Full Xcode/simulator runtime remains unavailable in recorded environment; no iOS launch/screenshots or MV01–MV12 completion claimed.
- Next: **E4 social** implementation plan and persistent activities/study recruitment, campus wall/help/replies, atomic sign-up/waitlist/withdraw, organizer reschedule/cancel and notification/calendar consequences. E5 admin/source refresh/moderation, local reminders and website, then E6 actual iOS acceptance remain incomplete. Goal stays active.
