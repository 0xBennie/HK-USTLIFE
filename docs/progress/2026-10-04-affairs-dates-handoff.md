# X05 private schedule preferences

Goal active. Worktree /Users/bennie/.codex/worktrees/campus-school-sync/All in one HKUST; branch codex/campus-school-sync; PMO base b036e577a9d2769dcd0dbe4bd20e27a3e8c6881c.

Implemented validated private date/time, independent calendar consent and reminder offset in existing JSON payload; legacy rows default null/false/null on read. Invalid dates, date-only reminders and save-without-date rejected. Clearing date or consent clears reminder. Updating an accepted template cannot replace personal date. Owner-scoped schedule projection keeps stable IDs and excludes archived/deleted/unsaved records.

No shared calendar/reminder feed or native scheduler hookup yet: doing that before a proper affair detail destination would misroute notifications to study-task editing. Next unit must implement affair-origin routing and UI before enabling projection in those endpoints.

Pen added iMNQk date, LGsfG uncertain save, rfBsw version conflict in own canvas, exported under design/affairs, visually checked and saved (Edited marker cleared). These are static design states, not interaction acceptance. Existing PUA prototype/evidence methods applied; no telemetry.

Validation: first date tests failed due missing projection/unsupported fields; after implementation,19 store/API tests and core TypeScript build passed. Current live API and simulator fixtures not restarted or mutated. Need actual native date/reminder tests after UI hookup.
