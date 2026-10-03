# Native affairs save/recovery controller

Goal active/incomplete. Worktree /Users/bennie/.codex/worktrees/campus-school-sync/All in one HKUST; branch codex/campus-school-sync; PMO base b036e577a9d2769dcd0dbe4bd20e27a3e8c6881c.

Added apps/mobile/src/affairs/controller.ts. One instance/owner lifecycle, memory-only draft, serialized PATCH, identity/version/effect validation, server-read recovery, explicit keep-draft/use-server choice, navigation protection, permanent dispose clearing private data and ignoring late responses. Uses backend detail type via erased type-only import; no backend runtime import or new dependency.

Lost writes never auto-replay. Conflict recovery reads current value but does not automatically rebase and overwrite; user must choose. Only draft fields are resubmitted, preserving other server changes. Invalid responses (including false official success) keep uncertain state. Read failure does not unlock retries. Equivalent timezone timestamps are compared as instants, avoiding false-negative saves after UTC normalization.

TDD: missing-controller suite failed first; initial5 tests passed after implementation. Added timezone-equivalence test exposed a failure; fixed field-aware comparison. Final native/store/API/release guard33 tests passed; mobile TypeScript passed. No new iOS screen or runtime flow is claimed: this controller is not yet mounted.

Next: strengthen full detail response validation and input normalization, then mount controller with account-keyed disposal in native affairs detail. Bind Pen G9UWx8/CxUV5/iMNQk/LGsfG/rfBsw, navigation protections and bilingual forms; implement create and revision-accept controllers separately with retained idempotency keys. Finally connect affair-origin calendar/reminder targets and perform real iOS acceptance. Existing simulator remains on confirmed activity detail; no new auth requests or fixture mutation this unit.
