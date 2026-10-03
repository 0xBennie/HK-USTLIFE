# Native social recovery checkpoint — 2026-10-03

Identified from current native/server source: study save already bounds POST replay, while activity/post forms, comments/replies and join retained keys without checking the server's24-hour receipt expiry. Replaying an expired key could create new content or repeat an old action. Fixed shared receipt capture/age/rejection classification and integrated it into those native paths.

Changed implementation:

- `apps/mobile/src/write-receipt.ts`: deep-frozen-by-copy request body, key, creation time;23h cutoff plus backward-clock guard; definitive4xx excludes review-required.
- Social ActivityForm/WallForm: age checks, preserve uncertain input, review-only exit after cutoff, malformed record response rejected; ActivityForm ignores post-unmount completion.
- ActivityDetail/WallDetail: same receipt protection for comments/replies and actions; no pending-receipt replacement; saved-write/failed-refresh copy distinguished. ActivityDetail ignores post-unmount mutation completion.
- `activity-join.ts`, JoinActivitySheet: cutoff then read-only current-state recovery. A missing/unknown participation is not interpreted as no signup. Fresh review is possible only after an authoritative null participation, and still requires explicit confirmation.
- Shared Chinese/English errors explain the next action without promising unbounded idempotency.

Verification:

- `regression.txt`:235tests /45files passed; seven new tests beyond the preceding228-test checkpoint.
- `native-social-receipts.test.ts`: persisted activity/post/comment/reply replay after restart, original-body retention, server receipt purge after25h without duplicate post, validation-versus-uncertainty classification, backward-clock cutoff.
- `native-activity-join.test.ts`: expired signup followed by withdrawal reads current withdrawn state without rejoining; failed GET recovery remains read-only; absent/malformed participation never becomes a fabricated success or no-signup state.
- Tests use real Fastify routes/SQLite and simulate transport loss at response delivery; they do not interrupt native device networking.
- `typecheck.txt` passed. Initial extraction removed TypeScript error narrowing; corrected the helper to a type predicate. Initial diagnostic retained in `initial-typecheck-failure.txt`.
- `ios-export.txt`:iOS Hermes bundle1672modules exported successfully. This is a package build, not execution on an iPhone.

No simulator/device, native screenshots, keyboard, safe-area, large-text or VoiceOver acceptance in this unit. Existing Xcode deferral remains respected. No school-private data, external email, public deployment, subagents or dependency changes.
