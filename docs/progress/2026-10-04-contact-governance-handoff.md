# X04 version-bound contact-card governance

- Worktree `/Users/bennie/.codex/worktrees/campus-school-sync/All in one HKUST`, branch `codex/campus-school-sync`, PMO base `b036e577a9d2769dcd0dbe4bd20e27a3e8c6881c`; prior HEAD `c3f8469`.
- Added `contact_card` report target, stable opaque card IDs and version-bound peer report identifier. Only the currently authorized recipient may file a report. Reuses existing rate limits, idempotency, owner-private report tracking, admin authentication and audit.
- Moderation inspects only the exact reported current version. Clearing increments card version; changed/expired/removed content cannot be acted on through old reports. No additional copy of private contact text is retained. This intentionally means removed content is unavailable for review; UI must explain that limit, not claim retrospective evidence.
- Migration 14 preserves existing content reports/moderation audit, adds card IDs. Upgrade fixture verifies rows and foreign keys after migration; it reconstructs pre-v14 card shape/ledger, not a full historical production database.
- Validation: core TypeScript and mobile typecheck passed; full 56 files / 339 tests passed. New API tests cover recipient/third-party isolation, restricted admin queue, retry, hiding, changed-card protection, withdrawal, and migration preservation. Log `.local/school-sync/contact-governance-regression.log`.
- No UI changes this unit. Contact-card native report/block entry and associated Pen state, X04 notifications and discovery remain next steps. Actual iOS runtime and school authorization remain incomplete.
- Simulator session 57095 confirmed live at 57.8%, 4.65/8.05 GB. Reuse this handle; local CocoaPods/Ruby prerequisite unresolved.
