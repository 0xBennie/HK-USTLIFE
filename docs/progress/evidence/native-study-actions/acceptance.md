# Native learning action unit — 2026-10-03

Previous goal turn was progress: administrator activity maintenance implemented and browser/API verified. This unit works on the primary student learning flow.

Changed:
- Direct44pttask checkbox with checked semantics, textual status and completed-title treatment. Add task/schedule visible before expanding settings. Existing edit/delete detail disclosure retained.
- StudyActionController snapshots version/body, synchronous mutation lock, validates returned contract, no implicit write retry, separate accepted-but-unrefreshed state, GET-only recovery from conflict/uncertainty.
- Same controller used for course/item deletion and imported occurrence cancellation. Course deletion clears obsolete filter after successful refresh but preserves detached records. External links have a separate open-failure message.
- Unmount/current-load generation guards, scene navigation protection, conflicting controls disabled while busy/unconfirmed, explicit stale retained-record message. Unknown-date tasks rendered only for the currently requested calendar range.

Evidence:
- `tests.txt`:248tests/47files pass. Seven new real-backend tests in native-study-actions.test.ts.
- `typecheck.txt`: native TypeScript passes.
- `ios-export.txt`: iOS Hermes export passes,1673modules. No native runtime was launched.
- Two occurrence-test failures retained. Both erroneously asserted UID fields not exposed by the detail contract; inspected server serializer then compared actual source summaries and IDs before/after, alongside the cancelled private override. No contract or assertion was weakened to claim success.
- git diff --check passes.

Environment: xcode-select remains /Library/Developer/CommandLineTools; xcrun --find simctl returns unavailable. User's Xcode deferral honored. Real iOS tap feedback, font enlargement, keyboard, VoiceOver and native motion remain unverified. This evidence does not satisfy MV01/MV09or complete the Goal. No new browser/Pen mock, dependency installation, deployment, external messages, subagents or new chat.
