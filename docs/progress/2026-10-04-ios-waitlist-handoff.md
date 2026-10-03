# Native waitlist and live HTTP concurrency

- Goal remains active; prior turn made verified runtime/code progress. This unit adds native waitlist and actual concurrent HTTP evidence. Full AC06 is not passed.
- Own worktree `/Users/bennie/.codex/worktrees/campus-school-sync/All in one HKUST`, branch `codex/campus-school-sync`, PMO base `b036e577a9d2769dcd0dbe4bd20e27a3e8c6881c`; current product code `a4041c9`.
- Same iOS27 simulator and local API4328/Metro8087/bridge. Existing processes preserved.

## Confirmed evidence
- Local API created `453be85b-4df7-4750-9ced-30b51006ec45`, title 原生验收 · 候补递补, Oct7 14:00–15:00 HKT, capacity1, members visibility. `native.waitlist@example.test` took the first place through HTTP setup.
- Actual iOS `native.peer@example.test` opened full activity, saw 1/1 and “确认加入候补”, voluntarily enabled calendar save, submitted and saw “候补中”, “第1位；尚未获得名额”, and saved-calendar feedback.
- Screenshots + AX: `docs/evidence/ios-2026-10-04/waitlisted-native.*`.
- Separate activity received two simultaneous real HTTP joins against running SQLite backend; exactly confirmed+waitlisted, counts1+1. `concurrent-last-seat.json` identifies this as HTTP acceptance, not two-device simultaneous taps.

## Incomplete step / cause
- Promotion was NOT executed. The script logged in the seat-holder, then attempted another new peer login and hit per-IP 10 challenges/hour limit. It failed before withdrawal. Do not rerun setup/create or count promotion as passed.
- Earliest logged request expires 2026-10-03 18:16:40 UTC (Oct4 02:16:40 HKT), observed read-only from isolated auth_requests. Recheck actual time/state before trying; rate protection remains unchanged.
- Prior scripts discarded short-lived process tokens, causing needless repeated login. New local helper `.local/school-sync/runtime-auth.mjs` reuses unexpired sessions, validates identity via /me, persists newly issued tokens in owner-only local files and stops on 429. Syntax checked; real cache-hit path not yet exercised. Do not commit/export tokens or local mail.
- `.local/school-sync/runtime-promote.mjs` now imports that helper, uses saved activity ID and performs one seat-holder withdrawal, then checks peer confirmation and exactly one promotion notice. No domain writes happened in its failed run. Run only after rate window is available; do not weaken auth or edit database to bypass it.

## Next
- Reuse the current waitlist fixture for promotion, then inspect native inbox/deep-link/calendar. Existing iOS peer session remains usable; no need to log it out.
- While login rate window remains closed, continue independent native/private learning/accessibility or R1.1 implementation; this is not a goal-wide blocker.
- No product-code change or duplicate broad unit test this unit. Native screenshot evidence is limited to waiting state, not successful promotion.
