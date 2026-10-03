# Mutual-only voluntary contact card backend

Worktree campus-school-sync; branch codex/campus-school-sync; base7ae6119. Prior turn delivered native consent flow. Current turn implements a server-enforced contact channel contract; native card editor and release gate remain incomplete. Full goal active.

Migration13 adds reconnection_cards and a consent-change trigger. Owner-supplied text only; no school profile extraction. Each read rechecks current mutual consent, eligibility and both consent versions. Consent update/block clears old card text and increments versions; clearing remains allowed when no longer mutual. Expiry/cancellation removes peer access. Account/activity cascade; export own cards only. No actual messages sent, no production data. See docs/api/reconnections-api.md.

Evidence in .local/school-sync/contact-card-red.log and contact-card-tests.log. New tests initially failed because card methods absent, then passed against SQLite. Authenticated API test covers real sharing, target-only read, outsider denial, own-only export and withdraw cleanup. Final full suite recorded in log; no mobile runtime evidence added.

Next: Pen + native preview and explicit contact-sharing confirmation; warn that seen/copied details cannot be retracted. Implement reporting/governance for card text before release. Add mutual notifications and saved-choice access from My/Inbox. Do not claim full chat exists. No public list of incoming intent.

Environment: runtime download remains session57095, last observed25.2%/2.03GB of8.05GB. Poll exact live handle before acting. CocoaPods install terminal failed in prior turn; local Ruby toolchain still unresolved; dependency-reviewer package-risk UNKNOWN due absent Endor tools. Do not restart the failed system Ruby command. Continue R1/R1.1 independently.
