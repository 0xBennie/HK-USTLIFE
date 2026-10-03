# Activities, participation and inbox — implemented local MVP API

Base `/api/v1`. Real SQLite migration 6. Native Discover, activity editor/detail, calendar link and Inbox are connected. Every activity is `is_demo:true` under the same enforced local-development boundary as accounts. This is not a real public event supply or school-certified community. Campus wall/help and report/block/admin APIs are now implemented in [wall and governance API](wall-governance-api.md). Restricted web administration, website share pages and local device notification scheduling are implemented; native runtime and device delivery acceptance remain incomplete.

## Content and visibility

Create payload: `kind:activity|study`, `title` (1–120), `description` (0–5,000), `location` (1–300), `starts_at` / `ends_at` (offset-aware ISO instants), `timezone` (valid IANA, defaults Hong Kong), `capacity` (1–50 participants, organizer excluded), `languages` (unique nonempty subset of zh/en/yue), `interaction:quiet|casual|active`, `cost_minor` (0–100,000 HK cents, informational only), `requirements` (0–2,000), `visibility:public|members`. Start must be future; end is later, at most seven days after start. Times normalize to UTC. No payments or uploads are implemented.

`public` permits visitor read of activity, organizer display name and comments; `members` requires a valid app session. Members does **not** mean verified HKUST enrollment. Client-supplied organizer, membership or `visibility:campus` is rejected. Kind/visibility are fixed after publication so changing an event cannot expose previously restricted comments. No email, private timetable or participant roster is exposed publicly. Banned-organizer/hidden content is unavailable in reads, calendar projection and notification previews; governance mutations follow the wall/governance API.

## Endpoints

| Endpoint | Input / result | Access |
|---|---|---|
| GET `/activities` | Paginated `{items,next_cursor}`; `limit` 1–50 (default 20), UUID `cursor`, `q` title/place, `kind`, `interaction`, `language`, ISO `from`/`to`, optional `mine:organized|participating|saved` | Visitor gets public only; mine requires login |
| POST `/activities` | Create payload, Idempotency-Key → 201 Activity | Logged-in local test account |
| GET `/activities/:id` | Activity plus aggregate counts and viewer's private `mine` state | Visibility checked |
| PATCH `/activities/:id` | `{version,...editable_fields,status?:open|closed}` | Organizer only; future, noncancelled activity |
| POST `/activities/:id/cancel` | `{version}` → terminal cancelled Activity | Organizer only |
| DELETE `/activities/:id` | `{version}` → `{deleted:true}`; removes content, comments, preferences and participation, notifies remaining users generically | Organizer only |
| POST `/activities/:id/join` | `{activity_version,save_calendar?:boolean}`, Idempotency-Key → Activity with current participation | Logged-in nonorganizer; before start, open signups |
| POST `/activities/:id/withdraw` | `{participation_version}`, Idempotency-Key → Activity with current participation | Own participation only |
| PUT `/activities/:id/preferences` | `{bookmarked,calendar_saved,remind_minutes:number|null}`; reminder 0–10,080 minutes, only when saved | Own preference; cancelled activity cannot be saved to calendar |
| GET `/activities/:id/participants` | Participation state/order and display name, never email | Organizer only |
| GET `/activities/:id/comments` | Newest first, 50/page; positive integer `cursor` → `{items,next_cursor}` | Same visibility as activity |
| POST `/activities/:id/comments` | `{body}` (1–2,000), Idempotency-Key → 201 Comment | Logged-in; before event end, not cancelled |
| DELETE `/activities/:id/comments/:cid` | `{version}` | Comment author only |
| GET `/me/notifications` | 50/page, positive integer `cursor`; `{items,next_cursor,unread}` | Own inbox only |
| PATCH `/me/notifications/:nid/read` | `{}` → `{id,read:true,read_at,unread}`; repeat does not alter original read time | Recipient only |

Default discovery shows upcoming, noncancelled content. `mine=participating` retains withdrawn/cancelled history; `mine=saved` includes bookmarks or calendar saves. A selected time window requires an event to start on/after `from` and end on/before `to`; no private timetable is sent. Pagination order is start time then UUID; after rescheduling/deletion, refresh the list rather than treating the cursor as a frozen snapshot.

Activity response includes content, version/status, derived started/ended flags, demo flag, organizer `{id,display_name}`, counts `{confirmed,waitlisted,remaining}`, and `mine` (null for visitors). Mine contains organizer flag, own participation, bookmark/calendar flags and private reminder choice. Participation returns state, version, queue order/timestamps and current waitlist position. Capacity excludes organizer and does not reveal other participants. The roster is explicitly organizer-only.

## Atomic rules

- Last-seat allocation, participation uniqueness, FIFO queue order, notifications and opt-in calendar preference commit in one `BEGIN IMMEDIATE` transaction. Verified with independent SQLite worker connections as well as parallel HTTP requests.
- A user has one participation row per event. Rejoining after withdrawal goes to the back of the queue with a newer participation version; duplicate active joins cannot consume another seat. Waitlist cap is 100; historical distinct participants cap is 500 per event.
- A freed place or capacity increase automatically promotes earliest eligible waitlist entries; no promotion after activity start or cancellation. Closing signups stops new joins but keeps existing participation/calendar and eligible waitlist promotion. Capacity cannot be lowered below confirmed participants. Organizer is not a participant place.
- Join requires the activity version the user reviewed. Organizer edits require optimistic version agreement and broadcast a generic change notice, including saved-calendar users. Reschedule retains participation and changes its calendar projection. Users can review and withdraw. Cancellation changes active participation to cancelled, clears saved calendar/reminder settings and is terminal.
- Create/join/withdraw/comment retry keys are scoped to user/action/target for 24 hours. Changed content on the same key is 409. Successful retry returns **current** record state; an old join retry after withdrawal does not rejoin. Removed original records return 410. Edit/delete rely on versions, not retry receipts.
- Limits: 10 new activities per organizer/day, 40 currently retained comments per author/day, at most 500 saved-preference rows per user. These local abuse bounds are not a complete production moderation policy. All unknown input fields rejected. Endpoint writes never send external email or push.

## Private calendar and messages

`GET /me/calendar` now merges explicitly saved activities with manual/ICS events. They have stable `id:"activity:<uuid>"`, current activity content, and `activity_origin:{id,participation}`. Participation is organizer/confirmed/waitlisted/not_joined (or withdrawn after an explicit resave). Waitlisted or saved-only items are shown as unconfirmed, never proof of a place. Projection reads current activity state rather than making an editable manual copy. Native calendar links to activity management instead of private-item edit/delete buttons.

Withdrawal clears the user's calendar save/reminder preference; cancellation clears all such preferences. Deletion removes projection by cascade. Bookmarks can remain after cancellation. Reminder preference storage is not proof of notification delivery. Native scheduling/reconciliation now consumes `/me/reminders`; see [reminders-api.md](reminders-api.md) for the implementation and pending device acceptance. Offline devices cannot be claimed to have learned remote changes immediately.

Inbox kinds: joined, waitlisted, promoted, withdrawn, activity_updated, activity_cancelled, activity_removed, comment. Post reply/resolved kinds and a nullable post preview are now also available (see wall/governance API). Only generic kinds and content references persist; titles are visibility-checked at read time. Deleted/hidden/inaccessible activity produces `activity:null`, without stale title/body snapshots. Read status persists per recipient. Notifications currently refresh on entry/foreground/manual request; no APNs or remote push.

Account deletion invokes social cleanup in the same deletion transaction: remove owned content with generic notices, withdraw other participations and promote eligible waitlists, then cascade the account's private rows/comments/receipts. Other recipients' generic notices retain a null reference for deleted activities. Export version 5 includes the owner's activities, participation/preferences, comments and notification records; it does not include others' roster, email or private calendar.

## Evidence

`tests/product-social.test.ts` exercises real HTTP injection/file-backed SQLite, ownership/visibility, last-seat competition including independent SQLite workers, duplicate keys, date/version/capacity boundaries, saved-calendar changes, cancellation/account cascades, comments, inbox isolation and moderation read suppression.

`node scripts/smoke-social.mjs <optional-report-path>` (after `npm run build:core`) runs actual local HTTP with three local test accounts, parallel join, restart, withdraw/promote, reschedule/calendar, comment/read and cancel. It uses and removes its own temporary database/mail only, never sends email or logs credentials. Evidence: `docs/progress/evidence/e4/activity-http-smoke.json`.

Native components compile/export, but actual simulator/device flows, accessibility, keyboard and screenshots remain unverified pending a usable Xcode/iOS runtime. These tests do not complete MV01–MV12.

## Native join confirmation client

The native detail screen reviews the current activity version and the optional calendar preference before submitting `POST /activities/:id/join`. It retains that payload and idempotency key for uncertain transport/5xx retries. A 4xx rejection requires a fresh activity review. No confirmed-place UI appears before a valid activity response carrying the current participation status.

Receipt replay resolves current activity state: a previously committed join may now return `waitlisted`, `cancelled` or `withdrawn`. Clients must render that state, not infer success from the original request or remaining-count snapshot. Existing calendar entries are retained; calendar removal is a separate preferences action. Native controller checks are covered in `tests/native-activity-join.test.ts`; they do not substitute for device UI acceptance.

### Bounded native retries — 2026-10-03

Native activity/post creation, comments/replies and detail POST actions now freeze a deep copy of the original body, request key and local creation time. `apps/mobile/src/write-receipt.ts` stops POST replay at23hours, before the server's24-hour receipt lifetime; backward/nonfinite elapsed device time also requires review. `RECEIPT_REVIEW_REQUIRED` is an uncertain result, not a server rejection: it must not clear the old receipt and permit another creation. Other authoritative4xx errors permit correction/fresh review; transport/5xx and malformed save responses preserve the pending request.

Expired activity/post/comment/reply writes expose a return-to-list review action and disable the old replay action. Drafts remain memory-only. A back/leave decision warns that the original operation may already exist; users must inspect current saved content before creating another. PATCH/DELETE still rely on version checks; a lost successful PATCH followed by409 is not called a successful retry.

Expired signup offers **Check current participation**, which sends only GET `/activities/:id`. A confirmed/waitlisted/withdrawn/cancelled record is displayed as returned. An explicit null participation resets to review of the latest version and requires another user confirmation before any POST. Failure or malformed participation data keeps the uncertain state and the next recovery action remains GET. No automatic rejoin after withdrawal, cancellation or receipt expiry.

When a write response was received successfully but the subsequent detail refresh fails, activity/post screens say the change was saved and that the view needs refreshing; they do not encourage publishing the same content again. Activity form/detail callbacks also ignore completion after unmount. This is source/controller behavior; visible controls, sheets, screen-reader announcements and keyboard interaction remain pending iOS runtime acceptance.

Evidence: `tests/native-social-receipts.test.ts`, expanded `tests/native-activity-join.test.ts` and `docs/progress/evidence/native-social-retry/`. These exercise persisted Fastify/SQLite with deliberately delayed/lost response delivery semantics, not an actual iOS network interruption.

Administrator maintenance now has an explicit authority boundary, shared activity domain mutations and metadata audit. See [activity-maintenance-api.md](activity-maintenance-api.md) for implemented endpoints, client recovery, and connected calendar/message/reminder behavior.


### Inbox acknowledgement and native continuity — 2026-10-03

`PATCH /me/notifications/:nid/read` now returns the target notification ID, original server read timestamp and recipient-wide unread count in the same transaction as the owned update. Example: `{ "id": 52, "read": true, "read_at": "2026-10-03T00:25:29.117Z", "unread": 3 }`. Existing clients may continue using `read`; the extra fields support authoritative in-place updates. Repeating this operation is idempotent without a receipt key or expiry window. It only marks read and never toggles unread. Another recipient's notification returns404.

The native inbox retains already loaded pages when marking a message read, and refreshes the same loaded page depth on tab re-entry/foreground/manual refresh. A multi-page refresh publishes atomically: a later-page failure leaves the old records/cursor/count intact and labels them stale. Stale linked-content buttons stay disabled until refresh succeeds. Pagination is a live feed, not a frozen snapshot; newly arriving/deleted notifications can change the contents of the loaded window.

A valid acknowledgement updates only the matching row plus the authoritative unread count. Lost/malformed acknowledgements do not invent read state; explicit retry repeats the same safe mark. A GET refresh can reconcile a pending mark when the notification is still in the loaded window. If it is outside that window, the explicit same-ID retry remains available. Duplicate taps and overlapping controller operations are suppressed synchronously. Unmount invalidates late responses; each account receives a fresh controller.

Evidence: `tests/native-inbox.test.ts` (10 real Fastify/SQLite cases), `npx tsx scripts/smoke-inbox.ts [report-path]` (actual local HTTP post/reply, owned read, deliberate response-delivery failure, backend restart/retry and deleted destination). The smoke script creates/removes only its temporary database/mailbox and sends no email. Its deliberate lost-response fault is not a real iOS network interruption. Reports: `../progress/evidence/native-inbox-continuity/`.

Native scroll position, VoiceOver announcements, dynamic fonts and actual touch behavior remain unverified. Compiling/exporting the native screen does not complete that acceptance.
