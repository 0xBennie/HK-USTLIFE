# Campus personal-action continuity — 2026-10-03

Observed: correction input could disappear on Back and on every shuttle refresh/focus change; failed writes allowed editing and replacing the key; a successful write followed by failed refresh appeared as an unsaved operation.

Implemented account/target-scoped `CampusActionsController`, atomic personal-data refresh, validated acknowledgements, frozen explicit retry, original bookmark save/remove decision, synchronous write serialization, late-callback invalidation and distinct saved/read-failed feedback. Correction keys have row lifetime in this backend; no unrelated social receipt expiry was added. Read-only refresh permits drafting and leaving. Busy writes/drafts/uncertain results register with scene/account protection. Parent Back consults child guards. Shuttle personal actions stay mounted independently of departure rendering; missing directory detail remains a stale snapshot rather than dropping the editor.

## Evidence

- Nine new tests in `tests/native-campus-actions.test.ts` use real Fastify routes and isolated SQLite through `app.inject`, not public network or simulated persistence. They cover commit/lost acknowledgement/restart/same key; draft/busy/uncertain risks and double taps; saved write/failed refresh; original bookmark decision after read recovery; malformed acknowledgements; validation correction; atomic failed reads; account/unmount late callbacks; typing while a read is pending.
- Initial targeted run:8tests passed (`targeted-tests.txt`); a ninth read-only interaction case was added and included in the final full run.
- `npm test`: **289 tests / 50 files**, core build included, passed (`tests.txt`).
- Native TypeScript: passed (`typecheck.txt`). Initial guard-narrowing compiler failure retained in `typecheck-initial.txt` and fixed by preserving the validated record's index signature.
- iOS export: passed,1677modules (`ios-export.txt`). Export output is not native runtime evidence.
- `git diff --check`: passed.

## Outstanding device verification

No actual iOS runtime was used. Native parent Alert, keyboard, dynamic type, tab switching and timer-triggered component retention have source/typecheck/export evidence only. Required manual checks: type a shuttle correction, wait over one polling interval, leave/re-enter bottom tab, cancel Back, fail POST after commit and retry, fail follow-up GET after confirmed save, then switch account and confirm no old text/history. Directory case must also be checked after public refresh.

No backend contract/schema change, shared server restart, external email, deployment, dependency installation, global tool change or subagent. Drafts are memory-only, Xcode remains deferred, overall iOS MVP Goal remains incomplete.
