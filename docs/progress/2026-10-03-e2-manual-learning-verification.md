# E2 manual learning progress — 2026-10-03

## Implemented scope

Database migration 2 persists owned courses and event/task/note/material records with foreign keys, versions and transactional creation retry keys. The separate learning route/store/schema modules expose private CRUD, paginated lists, bounded local-date calendar query and complete own export. Account deletion cascades learning data; course deletion preserves independent content by detaching it.

Native Today now connects to day/week/course/all-record views and real create/edit/delete forms. Tasks can be completed/reopened; events cancelled/restored; materials opened by user action. Failed writes retain the active draft and key; changed drafts receive a new key. Versions prevent lost updates. Display timezone choices include HK/UTC/London/New York; manual timestamp inputs explicitly use HK time. All copy is zh/en. No fake school enrolment/sync.

## Evidence

- Full suite: **26 files, 92 tests passed** (`evidence/e2-manual/tests.txt`), including 23 new server learning cases, one native HTTP retry-key case and 3 date helper cases.
- Real process smoke: create course/event/task/note → stop/restart process → same session sees persisted calendar/profile → complete task with new version → export private content → revoke logout (`process-smoke.txt`).
- Mobile TypeScript passed. iOS export passed: 1558 modules, ~3.8 MB (`ios-bundle.txt`).
- Initial red suite received 404 because learning routes did not exist. Client retry test first failed without header propagation. Date conversion tests first failed before helpers existed.
- Self-review regression: malformed resource URL and impossible ISO offset initially returned 500; after guarded parsing, both return 400. Midnight-exclusive and alternative timezone tests pass. Unchanged seconds/milliseconds survive title-only form edits; DST display tested independently.
- `git diff --check` passed. No dependency change, no deployment, no email or external account action.

## Not yet proven / remaining

- **ICS is not implemented**: preview/import UI, recurrence/exception parser, source identity, dedup, source-vs-local edit conflicts and partial-source preservation are the next E2 task. Existing MCP parser is untouched and must not be substituted for this requirement.
- Native simulator/device execution remains unavailable from the E1 environment check; no actual iOS screenshots, keychain, font/keyboard or rendered-flow claims. User has already been asked for full Xcode/runtime; continue other work meanwhile.
- Local notification scheduling remains E5. Backend reminder metadata does not claim delivery. Native subtasks editing is also pending if retained in final task UX; main Goal's basic tasks work at API level.
- Weak-network rendering and interactive form usability are code paths, not native-verified behavior. A failed date/timezone fetch never displays another range as if it were the requested one; existing records retain an error banner.
- Calendar querying currently reads the user's stored items in memory before grouping; acceptable for current local development data, but large import volumes need bounded recurrence expansion/query review in Task 3.
- All full MVP MV01–MV12 gates remain open pending their whole-flow evidence. E3 campus, E4 social, E5 governance/web/notifications, E6 native acceptance unchanged.

## Next action

Implement E2 Task 3 with a dedicated recurrence-aware parser after exact upstream/package verification, fixture tests first, then owner-bound persistent preview/confirmation and native document selection. Use the new version/transaction ownership rules rather than bypassing them. No subagents.
