# Native learning actions and recovery

Bring task completion to the task card, retain edit/delete in disclosure, and expose Add task/Add schedule without first opening settings. Preserve Apple components, typography, five tabs and private study data. Already-read PUA prototype/evidence discipline applies; native motion/keyboard acceptance still requires iOS.

Replace StudyScreen's unprotected mutation closure with a synchronous-lock controller. Distinguish accepted write + failed refresh from unknown write and known rejection. Unknown/conflicting operations require read-only current-state recovery; never repeat a toggle/delete automatically or silently swap its version. Disable conflicting page controls while submitting/reconciling; preserve bottom-tab scene state. After successful read, let user inspect current records and explicitly decide the next action. External links are not writes and should report open failure accurately. Stale retained records receive an explicit label.

Validate using the real Fastify/SQLite backend: double invocation; lost response after committed toggle and deletion; failed refresh after saved write;409version conflict; failed recovery stays locked; no POST/PATCH/DELETE during read-only recovery. Native typecheck and iOS bundle checks are implementation evidence only. Update API/progress evidence.

Completed implementation and controller/API validation:248tests/47files, native TS and1673moduleiOS export. Added validation of response identity/version/status and exact source-summary preservation for imported cancellation. Runtime interaction acceptance still open due unavailable iOS runtime. See evidence/native-study-actions and main handoff.
