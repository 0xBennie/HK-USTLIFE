# School records into personal planning

Execution: inline, no subagents. Spec: PRD A03/L01/L02/D03 and AC14. Baseline 338de95 on codex/campus-school-sync; same isolated worktree.

Goal: one school source record feeds day/week and reminder calculation with source provenance, personal completion and revocation semantics. No upstream school credentials or transport is added.

1. Read existing calendar/reminder/native write paths and inspect runnable/Pen. Add Pen examples for source facts, personal completion and partial freshness before mobile UI changes.
2. Test and implement source projection: stable local ID, source/personal versions separate; cancelled/removed/revoked/unapproved records excluded; partial/reauth caches visible with status; only healthy source scopes contribute reminder preferences. No default reminders.
3. Add the projection to real calendar/reminder APIs. Empty default contract registry remains blocked; server-only approved registry injection enables normalized fixture integration tests and future approved transports. No public approval route.
4. Test native completion command/ack and reminder target routing; render school provenance and private notes, route only personal completion to school endpoint, remove source edit/delete affordances. Preserve existing manual/ICS/activity behavior and unknown-write recovery.
5. Verify full tests + mobile TypeScript, inspect Pen layout/render. Native runtime evidence remains pending. Save API/trace/handoff with actual evidence and unresolved dependencies.

Review focus: cancelled tasks must not remain due; authorization revoked during refresh; stale source dates must not schedule trustworthy-looking reminders; personal version must validate acknowledgement rather than source version; unavailable timetable cannot be labelled no classes. School source notes remain independent. Completing a personal checkbox never marks official submission.
