# X04 private mutual-choice notifications

- Worktree `/Users/bennie/.codex/worktrees/campus-school-sync/All in one HKUST`, branch `codex/campus-school-sync`, PMO base `b036e577a9d2769dcd0dbe4bd20e27a3e8c6881c`; prior HEAD `f59d526`.
- Backend: migration 15; only non-mutual → mutual transition creates two owner-private notices. Withdrawal/block removes notices. Current eligibility checked before inbox, read mark and export; periodic sweep also removes obsolete notices. No one-sided intent, contact body or rejection reason is sent.
- Native: Inbox has neutral wording, peer identity and direct entry to corresponding reconnection screen; fresh consent read on opening and refreshed Inbox on return. Page validator checks presence/shape of reconnection payload. No remote push.
- Pen: saved/exported `ubX08`; screenshot and clipping checked. Browser mock unchanged. No actual iOS UI verification.
- Validation: core/mobile TypeScript passed; full 57 files / 345 tests passed. Added unilateral/no-notice, mutual recipients, withdrawal/block/unblock/expiry lifecycle and inbox/unread/export ownership tests. Log `.local/school-sync/reconnection-notifications-regression.log`.
- Native environment changed: original simulator download session 57095 completed exit 0. `xcrun simctl list runtimes` confirms iOS 27.0 (24A434), com.apple.CoreSimulator.SimRuntime.iOS-27-0. Do not restart download. CocoaPods/system Ruby native-extension issue remains; no app compile/runtime acceptance.
- Next: private saved-choice list for unilateral intent and native toolchain completion. X01–X03/X05, actual school authorization and remaining R1/R1.1 acceptance remain incomplete. Goal active.
