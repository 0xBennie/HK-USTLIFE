# School sync bounded requests and cancellation

Worktree: /Users/bennie/.codex/worktrees/campus-school-sync/All in one HKUST
Branch codex/campus-school-sync; base 75e0366. Previous goal turn made progress (calendar projection committed); this turn implements bounded/cancellable source fetches. Goal stays active.

Problem: generation/lease checks protected writes, but a never-resolving adapter kept the caller pending even after revoke.

Change: second adapter argument `{signal}`; 30 second page timeout, 240 second total budget; 250 ms lease-obsolescence check; clean timers on settle. Promise race returns even for adapters ignoring abort, while late results cannot reach commit. Transport must honor signal to actually stop HTTP. Existing failure codes preserve snapshots, and a retry can acquire the released lease. No automatic retries or upstream calls added.

Evidence: timeout-red.log shows two behavioral failures before fix. Final full regression in .local/school-sync/timeout-tests.log. Tests cover hung fetch timeout, retained prior snapshot, late result ignored, immediate retry, revoke abort and timer cleanup, total pagination budget/partial result. Real SQLite is used; adapters remain synthetic.

Environment: xcrun simctl list runtimes currently returns an empty runtime list. No iOS runtime acceptance claimed. No real school authorization, transport or token setup.

Next: school source-management/private notes/reminder UI and actual approved transports; continue remaining R1/R1.1. No deployment or shared project modifications.
