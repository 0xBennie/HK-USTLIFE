# Campus maintenance: directory and correction review

Implement administrator-only correction queues, bounded official-source capture, bilingual place editing, version conflicts and append-only audit. Reuse existing session/CSRF web gateway; ordinary members cannot read the admin queue or change public content. Student correction history must show the saved resolution. Pending feedback never edits content automatically.

Store source checks with target, source URL, fetch timestamp, digest and bounded raw evidence. Fetch only the current catalog's fixed official URL, with redirects disabled and response size/time limits. Checking a page does not automatically renew public freshness. Saving a reviewed place requires a recent matching source check, current record version and explanation; only the explicitly editable fields change. Keep live opening/availability unknown.

Resolve/reject a correction with version and visible explanation; resolving requires a matching recent source check. Record actor and before/after states. Preserve audit after reviewer deletion without retaining a dangling identity. Expose source checks and history through bounded admin routes and UI.

This unit completes place maintenance and correction handling for existing place/shuttle targets. Full shuttle timetable/holiday catalog editing remains a subsequent unit; don't claim source checking alone changes bus schedules. Tests: role/owner isolation, conflicts, source-fetch failure/redirect/size, transactional edits, resolution retry and restart persistence. Browser: local admin login → check source → review/edit test content → resolution → canonical readback. No deployment or production data changes.

## Completed checkpoint — 2026-10-03

Backend, restricted web editor and API documentation implemented. Real local Chrome official-source capture, bilingual postal location edit, correction resolution and audit read completed; submitter API readback confirms saved state. Responsive record-switch dialog cancel/discard verified at390px, no horizontal overflow; source of earlier native-confirm tooling timeout removed. Full regression222 tests/43 files and latest Next build pass. Evidence: `docs/progress/evidence/campus-maintenance/`; contract: `docs/api/campus-maintenance-api.md`.

Guard covers record selection/filter/refresh, not parent admin unmount. Timetable/holiday editing and native runtime acceptance remain open. Full MVP Goal stays active/incomplete.
