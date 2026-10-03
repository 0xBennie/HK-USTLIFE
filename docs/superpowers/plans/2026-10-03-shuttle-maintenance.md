# Persistent shuttle and holiday maintenance

Continue V04/V10/MV05 from the accepted place-maintenance unit. Keep all reviewed route IDs and public API compatibility. Seed a versioned SQLite catalog once; all public departure queries read that catalog. Each edited route owns its source evidence and 7-day review deadline; editing one route must not refresh other routes. Holiday coverage owns separate evidence/deadline (30 days). No live tracking or automatic HTML publication.

Admin can capture fixed CSO timetable / 1823 holiday sources, edit an existing route's names, boarding locations, fares, eligibility, dates, weekdays, holiday exclusion, notes and ordered departure times, and replace explicitly reviewed holiday coverage. Require source evidence within24h, catalog revision match, reason, bounded validated data and transactional audit. Invalid/old writes leave catalog unchanged. Preview edited departures before publish; UI shows source and a review confirmation, retains inputs after rejection and avoids double submit. No arbitrary source URL or route deletion.

Verify real API persistence, role/source/CSRF isolation, source capture nonmutation, conflicts, date/time validation, holiday coverage, independent route freshness and student readback. Walk the admin UI on desktop/narrow viewport. Preserve failure outputs. iOS compile/export only when shared type changes require it; simulator acceptance remains pending while Xcode is deferred. Update actual API and handoff evidence.

## Completed checkpoint

Migration9, persistent public queries, fixed-source evidence, versioned route/holiday saves and audit, restricted gateway and three-step admin editor implemented. Actual browser route and holiday saves reached revision3; separate public queries and raw-source comparison passed. Date input state defect found and repaired during browser acceptance.228tests/44files, Next build, native TypeScript and iOS1671-module export pass. Evidence `docs/progress/evidence/shuttle-maintenance/`; API `docs/api/shuttle-maintenance-api.md`. No iOS runtime completion claimed.

Next: audit remaining V01–V10/MV01–MV12 gaps against current code, particularly native runtime/weak network/accessibility, activity operations scope and release dependencies. Xcode remains deferred; no new install attempt. Goal stays active.
