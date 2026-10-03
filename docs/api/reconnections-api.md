# Again together: private mutual consent foundation

PRD X04 / AC18, backend foundation only. No native entry, peer-discovery UI, direct messaging or notification delivery is implemented by this unit. Do not call X04 complete.

Authenticated local-development API, no-store, same envelope and account safeguards as implemented-mvp-api.md:

| Method | Path | Contract |
|---|---|---|
| GET | /me/reconnections | Own declarations only, maximum 500 (creation is also capped at 500); no incoming requests/count |
| GET | /activities/:id/reconnections/:target | Own willing/version/expiry plus mutual boolean; does not return the other's intent/version/time or refusal reason |
| PUT | /activities/:id/reconnections/:target | Strict `{version,willing,participated}`; version 0 for first declaration; newer own version returned |

Paths use UUIDs. Authenticated owner is never supplied in request body. Positive intent requires a finished, visible, noncancelled activity, nonbanned participants, no relevant blocks, and both parties being the organizer or confirmed registrants. Registration alone does not prove attendance: each person must explicitly declare `participated:true` when expressing willingness. This is self-report, not verified attendance.

Provisional consent window: seven days after activity end. Both declarations must be active and unexpired for `mutual:true`. This is a revocable permission state, not a permanent friendship. A subsequent messaging module must check it at access time. No contact details or unsolicited notification are released here. Product trial may revise the window; UI must state it before consent.

Withdrawal is permitted even when the activity is no longer eligible. Blocking atomically clears both parties' willingness through a DB trigger; removing the block cannot revive prior consent. Cancellation/moderation/bans suppress mutual state. Missing/opposite/unilateral intent is not exposed as a count, timestamp or distinct refusal status. A user's own declaration is still visible to them with expired flag when applicable.

Optimistic version conflicts return 409; do not automatically replay a stale mutation. A lost reply is resolved by reading one's own state. Error 404 RECONNECTION_UNAVAILABLE does not identify why a positive request is unavailable. There is no public participant roster or endpoint listing incoming intent. The future UI must use explicit, legitimate peer selection; this endpoint is not a peer directory.

Own declarations are included in /me/export. Foreign keys cascade on account/activity deletion. No separate analytics or notification contains unilateral intent. Raw DB access remains privileged infrastructure access, not user/admin API access.

Evidence: reconnections.test.ts exercises mutual consent, outsider eligibility, withdrawal, expiry, version conflicts, blocking/unblocking and account cascade with SQLite. product-social.test.ts exercises two authenticated users through actual API and checks third-user isolation/export. Native UI, notification behavior, peer discovery, broader privacy review and actual student participation remain outstanding.
