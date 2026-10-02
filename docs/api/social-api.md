# Activities, participation and inbox — implemented local MVP API

Base `/api/v1`. Real SQLite migration 6. Native Discover, activity editor/detail, calendar link and Inbox are connected. Every activity is `is_demo:true` under the same enforced local-development boundary as accounts. This is not a real public event supply or school-certified community. Campus wall/help and report/block/admin APIs are now implemented in [wall and governance API](wall-governance-api.md). Restricted web administration, website share pages and device notification scheduling remain E5 work.

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
| PATCH `/me/notifications/:nid/read` | `{}` → `{read:true}`; repeat does not alter original read time | Recipient only |

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

Withdrawal clears the user's calendar save/reminder preference; cancellation clears all such preferences. Deletion removes projection by cascade. Bookmarks can remain after cancellation. Reminder preference storage is not native scheduling or notification delivery; E5 still must reconcile/cancel local OS notifications after synchronization. Offline devices cannot be claimed to have learned remote changes immediately.

Inbox kinds: joined, waitlisted, promoted, withdrawn, activity_updated, activity_cancelled, activity_removed, comment. Post reply/resolved kinds and a nullable post preview are now also available (see wall/governance API). Only generic kinds and content references persist; titles are visibility-checked at read time. Deleted/hidden/inaccessible activity produces `activity:null`, without stale title/body snapshots. Read status persists per recipient. Notifications currently refresh on entry/foreground/manual request; no APNs or remote push.

Account deletion invokes social cleanup in the same deletion transaction: remove owned content with generic notices, withdraw other participations and promote eligible waitlists, then cascade the account's private rows/comments/receipts. Other recipients' generic notices retain a null reference for deleted activities. Export version 5 includes the owner's activities, participation/preferences, comments and notification records; it does not include others' roster, email or private calendar.

## Evidence

`tests/product-social.test.ts` exercises real HTTP injection/file-backed SQLite, ownership/visibility, last-seat competition including independent SQLite workers, duplicate keys, date/version/capacity boundaries, saved-calendar changes, cancellation/account cascades, comments, inbox isolation and moderation read suppression.

`node scripts/smoke-social.mjs <optional-report-path>` (after `npm run build:core`) runs actual local HTTP with three local test accounts, parallel join, restart, withdraw/promote, reschedule/calendar, comment/read and cancel. It uses and removes its own temporary database/mail only, never sends email or logs credentials. Evidence: `docs/progress/evidence/e4/activity-http-smoke.json`.

Native components compile/export, but actual simulator/device flows, accessibility, keyboard and screenshots remain unverified pending a usable Xcode/iOS runtime. These tests do not complete MV01–MV12.
