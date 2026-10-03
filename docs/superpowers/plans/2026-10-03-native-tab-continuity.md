# Native tab continuity and input protection

Previous turn: progress (browser navigation/draft implementation and acceptance). This unit moves the continuity behavior into the actual native shell, not another mock expansion.

1. Preserve visited tab subtrees and independent ScrollViews, scoped to the current session identity. Hide inactive scenes from touch/accessibility. Dismiss keyboard on tab change. Account changes remount the scene host.
2. Propagate scene focus. Revalidate active data on re-entry; suspend inactive transport timers and feed/notification foreground listeners. Hide stale predictions while inactive/loading. Keep form state and pending receipts intact when switching tabs.
3. Guard destructive form back/deep-link replacement while input or pending work exists. No persistent storage of private drafts; logout clears them.
4. Run native TypeScript, meaningful state tests and iOS export. No simulator gesture/VoiceOver or keyboard claims while Xcode is deferred. Document missing runtime acceptance.

Implemented and compile/controller-tested. Expanded step 3 after observing an actual client risk: uncertain learning creation allowed editing the payload and generating a new key; now frozen with receipt-expiry handling. Eight new tests and full 221-test suite pass. See handoff/evidence. Runtime acceptance remains explicitly open.
