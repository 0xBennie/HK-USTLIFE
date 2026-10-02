# E2 ICS parser and import implementation

> Execute inline with test-driven-development. No subagents. User already authorized this unit.

**Goal:** Preserve recurring source events and exceptions for bounded calendar queries, then add owner-bound preview/confirmation and native file selection.
**Spec:** MVP V03/MV04 plus day-and-identity design section 5. Existing manual learning stays intact.
**Decision:** ICAL.js 2.2.1 (MPL-2.0), official parser/Event/Recur APIs inspected. Endor package-risk UNKNOWN: no MCP/CLI available; no approval invented. Exact npm package metadata inspected; install authorized as necessary project dependency, lifecycle scripts disabled.

## Current task: parser boundary

Files `src/product/calendar/ics.ts`, `tests/product-ics.test.ts`. Interface `parseCalendar(content,floatingTimezone?)` returns serializable series definitions and per-series issues; `expandSeries(series,{from,to})` returns stable recurrence identities and normalized event occurrences. Persist the full series definition later, never freeze a semester into one event.

- [x] Tests first: weekly COUNT/BYDAY, EXDATE, single moved/cancelled exception, all-day exclusive ends, DURATION, missing end, UTC/IANA/embedded VTIMEZONE, floating timezone confirmation, unsupported rule, invalid date, duplicate UID and orphan exception, bounded hostile expansion.
- [x] Implement strict envelope, max 256 KiB/500 events, duplicate property checks, DAILY/WEEKLY allowlist (COUNT/UNTIL/INTERVAL/BYDAY/WKST), bounded iterations/results. Unsupported components/rules explicitly reported, never silently treated as one-off events. Missing UID uses marked fingerprint identity, requiring review at confirmation.
- [x] Resolve IANA timezone without a bundled VTIMEZONE using Intl offsets; honor embedded VTIMEZONE. Preserve unknown ends. Never execute alarms, follow attachments, infer enrolment/participation, or call source URLs.
- [x] Verify focused and full suites/typecheck. Save exact coverage and gaps; commit parser boundary before persistence integration.

## Following tasks (still mandatory)

1. Migration stores owner/source/UID series plus preview snapshots and local occurrence overrides. Preview includes source changes and current record versions. Confirm selection atomically with stable retry keys; reject stale previews/conflicts unless user explicitly chooses local/source resolution. Partial imports never delete unseen events.
2. Calendar queries expand stored rules over requested date windows; overrides affect one occurrence. Export/delete include source records, but deleting an import batch preserves independent notes.
3. Native document picker → preview issues/changes/selection → confirm → day/week. No unapproved file upload before user selection. Actual iOS acceptance remains open until full Xcode/runtime available.

Previous turn classified progress (39be0c3, 92 tests); current task continues original scope. No Goal completion claimed from parser tests.

Parser boundary verified with 106 full-suite tests and TypeScript. Following persistence/native tasks remain required, not checked complete. See parser verification for exact limitations and three characterization cases to resolve before import integration.
