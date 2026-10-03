# Native inbox continuity — 2026-10-03

## Confirmed defect and repair

Existing `InboxScreen.read()` marked a notification read then called a first-page reload, dropping all older loaded pages. Read errors cleared the list. Re-entry also loaded only page1. This is an actual source-level V08/MV03/MV09 continuity defect, not a claim that it was reproduced on an iPhone.

- `src/product/social/{store,types}.ts`: mark-read acknowledgement now atomically returns `{id,read:true,read_at,unread}` under the same owner check. Repetition keeps the original read time; no arbitrary unread toggle or receipt expiry.
- `apps/mobile/src/social/inbox-controller.ts`: serialized actions; validated acknowledgements/pages; in-place read updates; retained page depth on refresh; atomic refresh publication; failed reads retain records/cursor/count; explicit same-ID retry after uncertain delivery; late callback invalidation.
- `InboxScreen.tsx`: connected controller, stale/error/loading/uncertain states, contextual retry and result text. Previously loaded cards remain during a refresh. Stale destinations are disabled until refresh succeeds. Account-keyed screen still provides a new controller per identity.

## Verification

- Targeted10tests pass (`targeted.txt`): pagination/in-place update; atomic failed refresh and depth; failed older-page retry; duplicate taps; lost response/restart/idempotent timestamp; GET-only reconciliation; malformed ack/page; recipient isolation; account unmount; deleted post destination.
- Full **262 tests /48 files passed** (`regression.txt`), including real Fastify/file-backed SQLite. Pagination tests seed explicit local notification rows in temporary test databases; the deleted-post scenario uses real post/reply APIs.
- Native TypeScript passed (`typecheck.txt`); iOS Hermes export passed,1674modules (`ios-export.txt`). No simulator/device execution.
- `npx tsx scripts/smoke-inbox.ts`: **5 actual local HTTP checks passed**, post→reply notification→uncertain read→restart→explicit retry→deleted post refresh (`http-smoke.json`, `http-smoke.txt`). API client/controller talks to a real loopback HTTP service. Response-loss is deliberately injected after receiving the server acknowledgement. Other-owner mark is404. First read timestamp persists across restart. Only the script's temporary DB/mailbox is removed.
- Smoke script also passed strict standalone TypeScript (`smoke-typecheck.txt`). Initial Node module-format import failure and missing contextual parameter annotations are preserved in `initial-smoke-failure.txt` / `initial-smoke-typecheck.txt`; fixed with CommonJS workspace interop and explicit types, without changing the Expo package format.

## Limits and environment

The retained depth is a live notification window, not a snapshot of exact IDs under an arbitrary influx of new messages. Refresh still rechecks content visibility. Existing loaded views are in-memory and account-scoped, not durable offline storage. Browser mock/Pen boards were not used as native acceptance.

No actual iOS screenshot, finger interaction, scroll offset, dynamic type, VoiceOver or animation evidence. Xcode remains deferred by the user; MV01–MV12overall remains incomplete. Existing four Expo/node-forge release findings unchanged; no dependency installation or advisory bypass in this unit.

Shared demo API was gracefully restarted after the compiled contract update:14328 PID17332/session86631, `.local/e5-web-demo` retained. Existing Next14330/14331 retained. No external email, deployment, source-data mutation, global tool changes, subagents or commits.
