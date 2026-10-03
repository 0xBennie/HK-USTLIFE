# Native inbox continuity

Observed: InboxScreen marks a notification read and then reloads only the first50items; older loaded messages disappear. Every read failure clears the list. Async read callbacks can outlive the account-keyed screen. This affects V08/MV03/MV09 and the message→activity/post→return flow.

Implement:
1. Add authoritative read acknowledgement `{id, read:true, read_at, unread}` to the existing owned/idempotent mark-read API; existing `read` field retained.
2. Extract inbox state controller with synchronous operation lock, paginated state retention, atomic multi-page refresh, stale/error distinction, authoritative in-place read update and explicit same-id retry on lost acknowledgement. No optimistic unread decrement or duplicate writes.
3. Integrate with native scene lifecycle; keep loaded page depth when returning; retain old list during loading/failure and label it. Disable stale-content navigation until latest read succeeds. Dispose account-bound pending callbacks on unmount.
4. Real Fastify/SQLite tests for pagination, duplicate taps, lost acknowledgement/restart/retry, refresh failures, owner boundaries, malformed acknowledgements and late callbacks. Native TS/iOS export. Record iOS touch/VoiceOver/scroll acceptance as unverified while Xcode is deferred.

Completed: server receipt, controller/screen,10regression cases and reusable actual HTTP smoke.262tests/48files, native TS and iOS export pass. See acceptance evidence for initial failures, exact scope and remaining iOS runtime limitations. Overall Goal remains incomplete.
