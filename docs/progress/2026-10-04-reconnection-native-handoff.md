# Private reconnection native entry

Worktree campus-school-sync, branch codex/campus-school-sync, base cbc1451. Prior goal turn implemented backend; current turn persists Pen and native consent flow. Goal active; X04 still incomplete without contact channel/notifications/runtime acceptance.

ActivityDetail entry uses only already-visible organizer/comment identities, shown to ended-activity organizer/confirmed registrants. Backend remains final eligibility authority. Explicit native confirmation asks for participation self-report and voluntary interest. ReconnectionScreen displays own choice/mutual/expired states, neutral errors, refresh and withdrawal; labels seven-day window and unavailable chat. No roster expansion or contact disclosure.

ReconnectionController validates target/activity/version and desired choice. Lost/malformed writes lock mutation until read-only recovery; failed recovery retains uncertain state. Busy/back protections wired. Pen D3Jdk/PSjRA/oKBe2 saved and exported, all three rendered/structurally checked.

Verification: .local/school-sync/reconnection-native-tests.log 55 files/325 passed; reconnection-native-typecheck.log passed; diff clean. Initial red was missing module, not a behavioral red. Tests cover no write before read, private false mutual value, lost-response recovery without replay, malformed target and failed recovery. Real backend tests from prior unit remain in the full suite. Actual native gestures, Alert, focus, font/accessibility and notification behavior NOT verified.

Known incomplete: no private messaging/contact exchange, no mutual notifications, no My/inbox discovery of these saved choices yet, no full Pen failure variants. Screen refresh is explicit; mutual status is a snapshot, not push. Before a future contact read/write, re-check current mutual consent on server, including block/revoke/expiry.

Environment: runtime download exec57095 still live at latest21.5%/1.73GB of8.05GB; poll same handle. CocoaPods session40264 terminal failure, missing Ruby2.6 headers; Endor risk evidence unavailable. Do not restart old gem command. Next implement mutual-only contact path and notifications without exposing unilateral intent; continue local native toolchain resolution.
