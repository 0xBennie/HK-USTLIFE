# Administrator input/session acceptance — 2026-10-03

## Changed and verified

- Central draft/busy registration across campus, shuttle, activities and report review. Same-account reconnect no longer unmounts children or clears report selection. Campus read failures no longer delete the current draft.
- Explicit exit and destructive report queue/filter/record changes show a keep/discard dialog. Same-origin navigation links are guarded. Document-unload warning implemented; browser/OS termination is not durable recovery.
- Session expiry retains but hides/disables editors. Same-account local-mailbox reauthentication restored the existing campus/shuttle/activity drafts in actual Chrome. Final built-page expiry state verifies retained=true, hidden=true, disabled=true, editorsVisible=false (`expired-state.json`).
- Explicit acknowledged sign-out clears child editors and report state. Also verified after another tab revoked the session and `/session` cleared the cookie (`signed-out-state.json`: zero draft inputs, sign-out acknowledgement, login shown).
- Fixed build at127.0.0.1:14331,390×844: page width390; discard dialog left20/right370. Keep is initially focused; final forward Tab wraps to Keep, Shift+Tab wraps to Discard, Escape returns to Sign out (`keyboard.json`). Screenshot `keep-draft-390.png` from final keyboard repair.
- Report B→A discard changed the selected record and cleared only the discarded report draft; returning from other sections retained the second report note. Refresh/filter/record cancellation preserved it. Activity, campus and shuttle drafts also retained through reconnect in development browser acceptance.
- Actual local API outage: four draft values retained, reconnect error shown; backend restarted without resetting database. Original local API PID95099 replaced by9680/session33387.
- `X-Campus-Admin-Id` binds UI requests to the mounted administrator. Added real Fastify/SQLite gateway regression for mismatched identities (reads and writes denied before operation), same identity allowed, and expired-cookie logout retaining Origin/CSRF requirements.

## Commands/results

- `npm test`: **252 tests /47 files passed**; `tests.txt`. Two new gateway cases.
- `npm run build`: final core+Next production build passed; `build.txt` includes TypeScript verification. Earlier standalone web TypeScript also passed (`typecheck.txt`).
- No native code changed in this unit; no repeated native bundle export. No simulator/device acceptance claimed.

## Failures investigated

- Initial development Strict Mode replay left the first reconnect busy after a shared write lock suppressed the second read. Removed the inappropriate write lock from reconnect; generation guards retain latest-read semantics. Actual initial load then succeeded.
- Incremental development edits briefly produced a provider mismatch before the parent wrapper was saved. Reload after the completed change worked. Final acceptance used a fixed production build.
- Old local test credentials returned401SESSION_EXPIRED. Created fresh, clearly identified local fixture accounts through local-mailbox authentication. Two test posts/reports remain pending (`fixtures.json`); no moderation or public campus information was submitted.
- Old development tabs rotated the shared CSRF cookie, causing an explicit403 on logout. The UI retained drafts and requested reconnect; closing the old development tabs, reconnecting and retrying the explicit discard completed logout. No bypass or automatic destructive retry.
- A narrow-screen attempt observed the wrong effective viewport and lost development state; not counted. A fresh fixed-build tab reported390px and passed the measured flow.
- Native HTML dialog Tab behavior allowed focus to leave the dialog. Added explicit forward/reverse boundary handling; final keyboard evidence confirms the fix.

## Boundaries and environment

No persisted draft store, browser-back recovery guarantee, cross-device recovery or automatic write retry. Same-origin link guards and browser-managed unload prompts are not crash recovery. Cross-account rejection was exercised by backend integration tests, not by creating another privileged account in the shared demo database. Hidden UI remains in memory/DOM while locked; local developer tools are outside this UI privacy measure.

Final local API14328 PID9680; existing Next development14330 retained; fixed production preview14331 PID11643/session15580. Demo database `.local/e5-web-demo` retained. Final browser signed out with no test drafts; temporary viewport restored. No external email, deployment, global tools, Xcode install, commit or subagent.

Full iOS MV01–MV12runtime and existing four Expo/node-forge release findings remain unresolved. This is one bounded admin interaction repair, not full App design acceptance or Goal completion.
