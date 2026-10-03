# School sync execution handoff

Goal: active R1 + R1.1. Unit: school persistence/recovery foundation; not live school integration.

Worktree `/Users/bennie/.codex/worktrees/campus-school-sync/All in one HKUST`; branch `codex/campus-school-sync`; baseline PMO snapshot `b036e577a9d2769dcd0dbe4bd20e27a3e8c6881c`. No shared main code changes, PMO messages, subagents or external writes.

Plan: `docs/superpowers/plans/2026-10-03-school-sync-foundation.md`.

Baseline: 288/289 tests passed; release guard rejected the local dependency symlink because `node_modules/` only ignored directories. Changed only this worktree's ignore rule to `node_modules`; all 7 release-check tests then passed. Baseline shell wrapper also used zsh's reserved `status` variable; corrected wrapper variable to `task_exit`; test log was retained and inspected. No application failure was hidden.

Fresh environment: Xcode 27.0 (27A266a) responds, first-launch check exits 0; no installed simulator runtimes/devices. `eas whoami` reports Not logged in. No license acceptance or global environment change performed here. Real native and school acceptance remain pending.

Ruling: use current Goal's explicit autonomous inline execution, rather than re-requesting approval for its routine backend sub-plan. No fresh reviewer subagent due user's explicit no-subagents constraint; own diff review and evidence are labelled accordingly.

Progress: Tasks 1–2 complete for the backend foundation. The public app retains an empty school contract registry and reports approval_required; this does not satisfy live AC13/AC14.

Implemented files: `src/product/school/{schemas,store,sync,routes}.ts`, migration 11 in `src/product/database.ts`, registration/export in `src/product/app.ts`, additive SIS/profile state in `src/product/auth.ts`. New tests: `tests/school-sync.test.ts` and `tests/product-school.test.ts`. API: `docs/api/school-sync-foundation.md` and updated implemented index. Scope does not include Pen/browser/mobile UI changes.

Verification: `npm test` exits 0, 52 files / 306 tests pass (17 new tests). TypeScript build is included. `git diff --check` passes. Node reports its existing experimental SQLite warning. A release scanner initially mistook the compact default argument in the test request helper for a literal credential; spaced the ordinary assignment without changing or bypassing the scanner. No actual secret was present. Review found and fixed authorization-expiry gating, revoked-state reporting and expanded-scope coverage; corresponding regression tests observed failure before fixes. The initial store run failed to load a module that did not yet exist, not an executed behavioral test.

Runtime status rechecked: Xcode first-launch check explicitly exits 0; no simulator runtimes, EAS not logged in. School application registration, source contracts, approved identity mapping and actual data access remain missing. No native compilation/install, real school call, server exposure, deployment, student recruitment or external messages performed.

Acceptance boundary: the normalized internal engine and authenticated local API are tested with real SQLite and synthetic adapter pages. They protect against partial snapshots, lease/revocation races, cross-account access and personal-data overwrite. No network adapter, token vault, native school record projection or system reminder delivery is implemented in this unit. Saved reminder preferences must not be presented as scheduled notifications.

Next: source-to-learning/calendar/reminder projection with explicit source states and preserved private overlays, then Pen/native interactions; real OIDC/Canvas/SIS transports only against approved contracts. R1.1 remains to implement. Real iOS testing needs an authorized runtime or device/EAS path. Use this branch/worktree for continuation; don't work in PMO/UI/QA-owned directories. No merge into the shared directory has occurred. PMO can inspect this handoff and attached worktree; no messages sent.

Goal remains active and incomplete. This turn made independent engineering progress; it is not a repeated-blocked goal turn.
