# Again together: private mutual consent foundation

PRD X04 / AC18, backend foundation only. Native ActivityDetail now opens ReconnectionScreen for existing visible organizer/comment authors; no new roster. Direct messaging and notification delivery remain unimplemented. Do not call X04 complete.

Authenticated local-development API, no-store, same envelope and account safeguards as implemented-mvp-api.md:

| Method | Path | Contract |
|---|---|---|
| GET | /me/reconnections | Own declarations only, maximum 500 (creation is also capped at 500); no incoming requests/count |
| GET | /activities/:id/reconnections/:target | Own willing/version/expiry plus mutual boolean; does not return the other's intent/version/time or refusal reason |
| PUT | /activities/:id/reconnections/:target | Strict `{version,willing,participated}`; version 0 for first declaration; newer own version returned |

Paths use UUIDs. Authenticated owner is never supplied in request body. Positive intent requires a finished, visible, noncancelled activity, nonbanned participants, no relevant blocks, and both parties being the organizer or confirmed registrants. Registration alone does not prove attendance: each person must explicitly declare `participated:true` when expressing willingness. This is self-report, not verified attendance.

Provisional consent window: seven days after activity end. Both declarations must be active and unexpired for `mutual:true`. This is a revocable permission state, not a permanent friendship. A subsequent messaging module must check it at access time. No contact details or unsolicited notification are released here. Product trial may revise the window; UI must state it before consent.

Withdrawal is permitted even when the activity is no longer eligible. Blocking atomically clears both parties' willingness through a DB trigger; removing the block cannot revive prior consent. Cancellation/moderation/bans suppress mutual state. Missing/opposite/unilateral intent is not exposed as a count, timestamp or distinct refusal status. A user's own declaration is still visible to them with expired flag when applicable.

Optimistic version conflicts return 409; do not automatically replay a stale mutation. A lost reply is resolved by reading one's own state. Error 404 RECONNECTION_UNAVAILABLE does not identify why a positive request is unavailable. There is no public participant roster or endpoint listing incoming intent. The native UI selects existing visible organizer/comment authors, with separate explicit participation/consent confirmation. Being a comment author alone does not grant eligibility; unavailable responses remain neutral. This endpoint is not a peer directory.

Own declarations are included in /me/export. Foreign keys cascade on account/activity deletion. No separate analytics or notification contains unilateral intent. Raw DB access remains privileged infrastructure access, not user/admin API access.

Evidence: reconnections.test.ts exercises mutual consent, outsider eligibility, withdrawal, expiry, version conflicts, blocking/unblocking and account cascade with SQLite. product-social.test.ts exercises two authenticated users through actual API and checks third-user isolation/export. Native touch/navigation/accessibility acceptance, notification behavior, broader peer discovery/privacy review and actual student participation remain outstanding.

## Voluntary contact cards (backend implemented; native editor pending)

GET/PUT `/activities/:id/reconnections/:target/contact-card` use the same authentication and UUID validation. PUT takes strict `{version:integer>=0,text:string<=300}`; text is trimmed, and an empty string clears the owner's card. This is deliberately user-entered text, never an automatic school email/profile release. No link execution, outbound message or chat transport occurs.

Response: `{activity_id,target_id,mine:{text,version},peer:{text}|null}`. `peer` exists only while mutual consent and activity/identity/block eligibility are currently valid and both stored consent versions match. Single-sided state, another person's card version, email/profile fields and hidden refusal reasons are not exposed. Any consent update clears both cards and increments their versions; blocking triggers the same cleanup, so unblocking/reconsenting cannot resurrect old contact data. A stale write returns409, and lost responses require read-only review.

Cards may be cleared by their owner after the relationship is unavailable. Counterpart access stops at consent expiry or activity cancellation. Own export includes only the user's cards (including empty cleared rows), not the counterpart's shared details. Account/activity deletion cascades both directions. Existing snapshots or information already seen/copied cannot be remotely retracted; the future sharing confirmation must say this plainly.

Acceptance so far: real SQLite tests and authenticated API tests cover no unilateral sharing, voluntary value only, correct recipient, outsider isolation, own-only export, withdraw/reconsent suppression, explicit clearing, stale version, block/unblock, expiry and cancelled activity. Native editor, sharing preview/confirmation, moderation/report handling for contact-card text, mutual notification and runtime acceptance remain required before product-level release. Contact cards are an initial contact channel; full in-app chat stays separately scoped.
