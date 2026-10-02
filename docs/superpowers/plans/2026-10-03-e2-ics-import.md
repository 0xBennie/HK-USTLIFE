# E2 — persistent ICS import

Continue parser into owner-scoped sources and expiring previews. Preserve raw series rules and never delete absent UIDs during partial reimport. Confirmation must atomically check every selected entry against the preview snapshot, reject stale writes, require explicit review of UID-less entries, and replay identical confirmations without duplicates. Unselected/unsupported entries stay unimported. Source deletion cascades imported data, not independent notes.

Sequence: persistence store and tests → authenticated API/export integration → recurrence expansion into calendar → per-occurrence local overrides with explicit source-update conflicts → native file selection/preview/confirmation. This stage does not claim the full ICS feature until those integrations pass. No new dependencies.

Verification: actual temporary SQLite, reopen persistence, owner isolation, expiry, stale snapshot, partial import, idempotent confirmation and account/source cascade. Then API integration and native typecheck/bundle; actual iOS acceptance remains required separately.

## Occurrence overrides

Persist a full private event snapshot per original recurrence ID, with series-version optimistic concurrency. Moving one occurrence must remove its old projection and insert its new projection even outside the original query window. Source refresh with any local overrides requires explicit per-series keep_local/use_source; keeping a removed source occurrence remains a clearly marked private retained event. Reject unsupported/out-of-rule recurrence IDs. Source/account deletion cascades overrides; exported private data includes them. Dedicated endpoint, never manual study-item IDs.
