# Admin input/session protection

Scope: the known parent reconnect/logout/session-expiry gap across report, campus, shuttle and activity editors. Preserve existing visual design and local-only backend. No new integrations.

- Register unsaved/busy state from all mounted sections. Warn on document unload, guard explicit sign-out and report record/filter changes. Switching sections retains drafts.
- Reconnect refreshes credentials without resetting same-user editors. Network failure keeps input; authentication loss locks/hides mounted editors until the same administrator returns. A different account cannot adopt old drafts.
- Keep authority at the server. No password collection, persisted browser drafts, automatic write retry or new permission grants.
- Verify in Chrome: section switching, reconnect, keep/discard sign-out, failure/reauthentication, keyboard dialog behavior, narrow viewport. Production build and relevant regression tests. Record actual limits separately from iOS runtime acceptance.

Completed: shared guards/session locking, identity-bound gateway, expired-cookie logout, real browser flows and keyboard repair.252tests/47files and final production build pass. See `docs/progress/evidence/admin-input-protection/acceptance.md` for failures, exact evidence and limits. Full iOS Goal remains incomplete.
