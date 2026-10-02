# E2 — persistent ICS import

Continue parser into owner-scoped sources and expiring previews. Preserve raw series rules and never delete absent UIDs during partial reimport. Confirmation must atomically check every selected entry against the preview snapshot, reject stale writes, require explicit review of UID-less entries, and replay identical confirmations without duplicates. Unselected/unsupported entries stay unimported. Source deletion cascades imported data, not independent notes.

Sequence: persistence store and tests → authenticated API/export integration → recurrence expansion into calendar → per-occurrence local overrides with explicit source-update conflicts → native file selection/preview/confirmation. This stage does not claim the full ICS feature until those integrations pass. No new dependencies.

Verification: actual temporary SQLite, reopen persistence, owner isolation, expiry, stale snapshot, partial import, idempotent confirmation and account/source cascade. Then API integration and native typecheck/bundle; actual iOS acceptance remains required separately.
