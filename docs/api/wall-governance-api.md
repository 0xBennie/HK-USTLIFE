# Campus wall, reports and blocks — implemented local MVP API

Updated 2026-10-03. Base `/api/v1`, real SQLite migration 7. These are implemented endpoints, not the proposed future OpenAPI surface. They share the local-only host/origin checks, bearer authentication, demo-account boundary and response/error envelopes in `implemented-mvp-api.md`. Native campus wall/detail/editor, report/block controls, My reports/blocked users and message-to-post navigation are connected. Restricted **web** moderation UI remains E5. No upload/storage or image button is offered.

## Posts and replies

Create body `{kind:"wall"|"help",title,body,visibility:"public"|"members"}`. Title is trimmed 1–160 characters; body 1–5,000. `members` means a valid app session, not school enrollment. Public posts/replies can be read without login. Visibility and kind cannot be changed after creation; the app defaults to members. No private schedule is attached. All posts return `is_demo:true`.

| Method / path | Input / result | Access |
|---|---|---|
| GET `/posts` | `q` max 120, optional `kind`, `status`, `mine=true`, UUID `cursor`; `{items,next_cursor}`, 20/page | Public for visitors; mine requires session |
| POST `/posts` | Create body + `Idempotency-Key`; 201 Post | Session |
| GET `/posts/:id` | Post content, author `{id,display_name}`, version/timestamps, status, visibility, `is_mine` | Visibility checked |
| PATCH `/posts/:id` | `{version,title?,body?,status?}`, at least one editable value | Author only |
| DELETE `/posts/:id` | `{version}` → `{deleted:true}`, cascades replies, clears notification post references | Author only |
| GET `/posts/:id/replies` | Optional positive integer `cursor`; `{items,next_cursor}`, 50/page newest first | Same visibility as post |
| POST `/posts/:id/replies` | `{body}` trimmed 1–2,000 + `Idempotency-Key`; 201 Reply | Session; parent must be open |
| DELETE `/posts/:id/replies/:cid` | `{version}` → `{deleted:true}` | Reply author only |

Post states: help uses open/resolved; wall discussions use open/closed. Authors can reopen either. Existing replies remain readable when a discussion closes. A resolve transition notifies distinct reply authors (except the resolver and blocked pairs). A nonauthor reply notifies the post author. Users cannot edit another author's content, inject an author ID or widen existing visibility.

Writes use synchronous SQLite transactions. Create/reply retry receipts last 24 hours and bind owner, action, parent and parsed content; same key/content returns current resource, a changed payload returns 409, and a removed original resource returns 410. PATCH/DELETE use optimistic versions; after an uncertain edit/delete refresh to learn the actual state. Current abuse bounds count retained rows: 10 posts and 40 replies per author per rolling day. These are local limits, not a complete production anti-abuse system.

Post feed ordering is creation timestamp descending then UUID descending. Reply ordering is integer ID descending. Hidden posts, banned authors and bilateral signed-in blocks are filtered before pagination. A deleted/inaccessible cursor requires refreshing the feed. Post edits do not move the original creation order.

## Blocks and participation consequences

| Method / path | Input / result | Access |
|---|---|---|
| GET `/me/blocks` | Up to 500 `{id,display_name,created_at}` outgoing blocked users | Owner only |
| PUT `/me/blocks/:userId` | `{}` → `{blocked:true}`, repeat-safe | Session; existing other user |
| DELETE `/me/blocks/:userId` | `{}` → `{blocked:false}`, repeat-safe | Own outgoing block only |

A signed-in block is bilateral for posts, activities and replies/comments. Detail reads and new interactions return 404; feeds filter before limiting. New activity-comment notifications between the pair are suppressed. Existing generic notifications remain but unavailable post/activity previews become null. Public publication stays readable as a visitor: blocking is not a confidentiality boundary.

The insert and social consequences are atomic. When one party organizes an activity and the other participates, active confirmed/waitlisted participation becomes withdrawn, their preference row (bookmark/calendar/reminder choice) is removed, and an eligible waiting member can be promoted. This happens in either organizer/participant direction. Saved-only preferences for the other party's activities are removed too. Repeated PUT does not repeat side effects; unblocking never restores participation or saves. An outgoing unblock does not remove the other person's block.

Blocking another attendee does not remove either party from a third person's activity, rewrite organizer-only historical rosters, or promise they cannot meet physically. The native confirmation explains this. Actual OS reminder cancellation depends on the later reminder synchronization unit; current effects are server-side calendar/preferences only.

## Reporting and restricted review

Report target is `{kind:"post"|"reply"|"activity"|"activity_comment",id:string}`. Posts/activities require UUID; reply/comment IDs are positive integer strings. Reporting validates the current viewer's target and parent visibility. Reasons: spam, harassment, privacy, misinformation, other. Optional `details` defaults to empty, max 2,000 characters.

| Method / path | Input / result | Access |
|---|---|---|
| POST `/reports` | `{target,reason,details?}` + `Idempotency-Key`; 201 Report | Session with visible target |
| GET `/me/reports` | Optional UUID `cursor`, `status:pending|dismissed|action_taken`; 50/page | Report owner only |
| GET `/admin/reports` | Same filters/pagination; includes reporter ID and current `content` or null | Server-verified admin only |
| POST `/admin/reports/:id/resolve` | `{version,action:"dismiss"|"hide_content"|"ban_author",reason}`; nonempty review reason max 1,000 | Server-verified admin only |

Reports expose ID/target, reason/details, status/version, created/reviewed dates and resolution note. The owner's list/export does not expose other reporters, reviewer identity or other users' private data. Admin target preview reads current title/body/author/moderation/parent reference, including hidden content for review. It is **not** a submission-time snapshot. If content is deleted, the preview becomes null and only dismiss is allowed; hide/ban returns 410. Report text is the reporter's own input, not an automatic copied content snapshot.

Retry keys persist with the report. Reusing the same key/content returns the current report without duplication; changed content returns 409. Limit: 20 reports per reporter per rolling day. Submitting a report alone never hides content or informs its author.

Resolve requires pending state and matching report version. It increments version, saves reason/reviewer/time and writes a moderation audit row atomically. A repeat/stale review returns 409; refresh the queue. Actions:

- Dismiss: retain content and mark dismissed.
- Hide content: hide the exact post/reply/activity/comment and increment its version. Hiding a parent hides descendants through parent access checks. Hiding an activity also cancels active participation, clears saved calendar/reminder choices and inserts cancellation notices.
- Ban author: set restricted state and revoke all sessions. Authored public content disappears, their organized activities are cancelled, and active participation elsewhere is withdrawn with eligible waitlist promotion. Their saved calendar/reminder choices are cleared. Administrator accounts are protected from report-based bans (409 with no partial mutation).

No unban/restoration or bulk moderation endpoint exists in this unit. Admin provisioning remains local seed/CLI only. No automatic moderator, external service, production message or deployment occurs.

## Inbox, export and deletion

`GET /me/notifications` now adds `post:{id,title}|null` and kinds `post_reply`, `post_resolved`, alongside existing activity notifications. Both post/activity previews are resolved against the current user's visibility at read time; deleted/hidden/banned/blocked content has a null preview, with no stored title/body snapshot. Mark-read remains recipient-only and repeat-safe.

Account export version **5** adds `wall:{posts,replies}` and `governance:{blocks,reports}` and includes post references in own notification records. It includes only the caller's writes/private state. Deleting an account cascades its posts/replies/reports/blocks, clears other users' deleted-post notification references and nulls related audit foreign keys. An audit action/reason can remain without a user/report reference. Application deletion does not claim filesystem backup erasure.

## Validation and remaining acceptance

`tests/product-wall.test.ts` (7) and `tests/product-governance.test.ts` (8) exercise actual HTTP handlers/file-backed SQLite with independent accounts, restart, version/author/visibility checks, reply retry semantics, status transitions, tied-timestamp pagination, block/calendar/waitlist consequences, report privacy, admin denial, hide/ban/audit effects, protected admins and account deletion. Full suite: **175 tests passed** for this unit.

`node scripts/smoke-wall-governance.mjs <optional-json-path>` after `npm run build:core` starts real loopback HTTP, uses temporary local demo accounts/mail/SQLite, restarts the server/database, and verifies wall/replies/inbox, report review, blocking/promotion and deletion. It removes only its own temp directory and does not output credentials or send email. Evidence: `docs/progress/evidence/e4/wall-governance/`.

Native TypeScript and iOS Hermes export passed. No actual simulator/device launch, screenshot, visual/keyboard/accessibility/motion verification is claimed. Remaining overall work includes restricted web administration/source maintenance, device reminders, website/share pages and full MV01–MV12 iOS acceptance. Native top-level tab navigation can still abandon an in-memory draft/pending request; complete navigation/draft recovery handling remains part of E6, not covered by HTTP tests.

The full staged release gate failed on the unchanged dependency graph: `npm audit --omit=dev` reports 16 vulnerabilities (11 moderate, 4 high, 1 critical); tracked credential/path scan has no findings. See the saved audit in the evidence folder. Compatible dependency fixes and revalidation are still required; no release-readiness claim follows from the 175 passing tests.
