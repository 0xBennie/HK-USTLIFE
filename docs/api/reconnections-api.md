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

## Contact text retention (2026-10-04)

Contact text is cleared when either consent expires, is absent/inactive, or no longer matches the consent version saved with the card. Clearing increments the card version and retains the empty row so stale edits conflict. Consent changes and blocking also retain their existing immediate clearing behavior.

The store sweeps on startup and before card reads, writes and export. The local API additionally attempts a sweep every five minutes while running; the timer is released on shutdown and failures emit a warning for retry. Peer visibility still checks current eligibility on each read, independently of cleanup. An unavailable/stopped process cannot guarantee a wall-clock cleanup deadline; the next startup sweeps persisted records.

This clears application-visible SQLite text, not copies previously viewed by recipients, SQLite free pages/WAL remnants or external backups. No secure-erasure claim is made. Native contact-card UI and runtime acceptance remain outstanding.

## Version-bound contact-card reports (2026-10-04)

A visible `peer` card now includes `report_id`, an opaque card identifier plus version (`32 lowercase hex characters.version`). It is only returned with contact text after current mutual-consent/eligibility checks. Do not infer permissions from possession of this identifier.

Use the existing authenticated `POST /api/v1/reports` with an idempotency key and `target: {kind: "contact_card", id: peer.report_id}`, existing reason enum and optional details. The server requires the requesting user to be the card's recipient and still eligible to view that exact nonempty version. Other users/authors get neutral 404. Existing daily limits, same-key retries, private report lists and administrator-only moderation apply.

Admin review reads the exact reported version, not a later edit. `hide_content` clears that card's text and increments its version; it does not cancel the activity. If the card changed, expired or was removed, content is null and destructive resolution returns 410; dismissal remains available. Existing author restriction and audit apply. No private contact snapshot is separately retained: after removal/version change this workflow cannot review its former body. Reports may themselves contain user-written details, governed by existing report/export/deletion rules.

Migration 14 adds stable opaque card IDs and extends report targets while preserving existing report/audit rows. Native report/block controls for contact cards are not yet wired in this unit; no rendered administrator or iOS acceptance is claimed.

## In-app mutual-choice notifications

Migration 15 adds a private reconnection target to existing notifications and one current notice per owner/activity/peer. A transition from non-mutual to mutual consent creates one notice for each participant, atomically with the consent update. Unilateral intent creates none. No email, push or external message is sent.

`GET /me/notifications` includes kind `reconnection_mutual` with `reconnection: {activity_id,target_id,display_name}` only after current mutual eligibility is checked. Native Inbox opens the corresponding choice and reloads consent; returning refreshes Inbox. Notification text asks to check current choice, not to assume a standing invitation. No contact text is included.

Withdrawal/block clears matching notices; inbox read, read-marking, export and the existing periodic sweep remove notices failing current eligibility, including expiry/cancellation. Unread counts are computed after filtering. An old notice can return 404 when marked read. Previously downloaded client content is not remotely erased; stale/deep-linked actions must re-read authorization. This is in-app delivery only. Saved-choice entry for a unilateral choice is still separate outstanding work.
