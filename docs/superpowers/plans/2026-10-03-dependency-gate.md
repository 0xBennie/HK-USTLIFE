# Scoped dependency and release check repair

Current full audit:6findings, including Vitest critical/mocker moderate and node-forge/Expo high chain. Upgrade pinned Vitest3.1.2→4.1.11(the first maintained fixed4.xversion for GHSA-82fw-gwwq-j7x9), validate current Node22and test APIs; no npm audit fix --force or Expo downgrade. Retain node-forge advisory as unresolved: registry latest1.4.0and advisory reports no patched published version. Endor tool unavailable; result UNKNOWN.

Release guard currently lists only tracked files, missing untracked feature code from this worktree. Include nonignored untracked files, deduplicate, tolerate tracked files removed in working tree, and test isolated Git fixtures for untracked sensitive file/assignment detection, ignored exclusion and no value leakage. Do not suppress dependency failure or weaken credential matching to obtain green status. Read-only reachability inventory for node-forge; document what remains blocked and what local workflows invoke it.

Back up existing package/lockfiles before narrow install. Verify actual resolved versions, full suite, core/Next/native builds as impacted, Expo compatibility/export, before/after audits and release guard. No deployment or native runtime claim.

Completed scoped upgrade and release scanner repair. npm10peer resolver required one-off npm12.2.0; retained Vite6.4.3pin.250tests/47files and builds pass.4high node-forge/Expo findings remain, release check fails honestly; no patched registry version available. Endor risk UNKNOWN. Evidence in dependency-gate/acceptance.md; no native runtime claim.
