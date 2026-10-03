# Private learning API — manual records

Implemented 2026-10-03. Base `/api/v1`; requires the native bearer account from `implemented-mvp-api.md`. All data is private to the principal. ICS imports and private occurrence overrides are connected through the calendar API; official enrolments are not connected.

## Endpoints

| Method | Path | Behavior |
| --- | --- | --- |
| GET / POST | `/study/courses` | Paginated courses / create personally maintained course |
| GET / PATCH / DELETE | `/study/courses/:id` | Own course detail / versioned edit / detach records and remove course |
| GET / POST | `/study/items` | Paginated private records / create event, task, note or material |
| GET / PATCH / DELETE | `/study/items/:id` | Own item detail / versioned edit / remove |
| GET | `/me/calendar?from=2026-10-05&to=2026-10-12&timezone=Asia%2FHong_Kong` | Day/week query; `to` exclusive, 1–42 days |
| GET | `/me/export` | Version 2 export: profile plus all own courses and items |

List query: `limit` 1–100 (default 20), UUID `cursor`; items optionally `kind` or `course_id`. Response data `{items,next_cursor}`; clients must continue pagination. UUID keyset order is stable identity order, not an implied chronological course order. Native lists consume every page. Another account's course filter returns 404.

Creation requires `Idempotency-Key`: 8–128 ASCII letters/digits/underscore/hyphen. Scope is principal + collection + key, retained 24 hours. Same normalized payload returns the same current record; changed payload returns 409 `IDEMPOTENCY_CONFLICT`. If the original record was deleted, retry returns 410 `RECORD_REMOVED`, not a fabricated creation. Retry insertion and the business write share one transaction.

PATCH requires `version` plus at least one allowed field. DELETE requires `{version}`. Stale versions return 409 `VERSION_CONFLICT`. New records start at version 1, successful edits increment it. Clients cannot change a record's kind, owner, ID, source metadata or timestamps. Editing a task changes this platform only, never a school submission.

## Data shapes

Every returned record includes `id,version,created_at,updated_at`. Course input: `{title,code?,description?}`. Title 1–200 characters, course code up to 40, text up to 10,000. Whitespace-only title is rejected.

All items include `{kind,title,course_id?}`; null/unset course means independent. A referenced course must belong to the same user, enforced at the API and composite database foreign key.

- Event: `body,location,timezone,all_day,starts_at,ends_at,start_date,end_date,status,remind_minutes`. Timed events require offset-bearing ISO `starts_at`; `ends_at` can be null and is not guessed. Stored instants normalized to UTC, source timezone retained separately. All-day events use dates only and an optional exclusive `end_date`. `status` is active/cancelled.
- Task: `body,status,due_at,due_date,remind_minutes,subtasks`. Status open/done. Exactly one or neither of due_at/due_date; date-only deadline stays a date. Subtasks accept unique UUID, title and done flag, max 50. Native subtask editor is not implemented in this unit; existing subtasks are preserved by basic form edits.
- Note: `body`. Private short text, not public course reviews.
- Material: `body,url`. Only HTTP(S), no URL credentials; server does not fetch the link. Native opening requires a user tap.

Reminder minutes may be null or 0–10080 and require a precise timestamp. Saving this field is configuration, **not proof of device delivery**. The native scheduler now consumes `/me/reminders`; see [reminders-api.md](reminders-api.md) for opt-in, reconciliation and remaining iOS acceptance. All-day/date-only records do not silently acquire a reminder time.

## Calendar semantics

Response: `{from,to,timezone,days:[{date,events,tasks}],undated_tasks}`. Events crossing midnight appear on each overlapping local day. Exact midnight end is exclusive; unknown end appears only on its known start date with missing-end labeling. All-day dates are calendar dates and never shift with display timezone. Cancelled events are excluded from day/week; they remain editable in all records. Dated completed tasks remain visible with their status; undated_tasks includes open tasks only.

Timezone must be recognized by Intl. Display date changes do not rewrite stored instants. Native display choices currently HK/UTC/London/New York; manual timed inputs are explicitly labeled Hong Kong time. Editing other fields preserves an unchanged timestamp's original seconds/milliseconds.

## Removal/export

Deleting a course sets its items' course_id to null and increments affected item versions, preserving their content. Deleting an account cascades courses, items and idempotency rows. Individual item deletion keeps the consumed retry key until expiration to prevent resurrection. Exports contain all own records across pages, including cancelled events/completed tasks. No other account's data is included.

## Still pending

ICS preview/confirmation, recurrence expansion/EXDATE/RECURRENCE-ID, source update conflicts and import batch lifecycle are E2 Task 3 and are not delivered by these manual endpoints. Native rendered acceptance remains pending Xcode; tests prove the HTTP/storage contract and client logic, not the iOS interface.


## Native save / navigation behavior

The native learning editor freezes the exact request and idempotency key after an uncertain network response. Inputs stay frozen for a retry, and synchronous repeated taps do not send additional requests. New records retry against the same server receipt even after server restart. After 23 hours of local elapsed wall-clock time, or if the elapsed clock is negative/nonfinite, the editor stops replaying a creation and offers a return-to-records action, ahead of the server's 24-hour receipt expiry.

Fulfilled HTTP requests alone do not confirm a save. The editor checks course/item record identity, positive version (exact next version for edits), resource kind and all submitted content after documented title/code trimming and timestamp normalization. Imported occurrence edits check series, recurrence ID, next version and submitted event fields. A malformed/mismatched response remains uncertain with the same frozen request. Creation replay may return an already-modified current record; differing content remains unconfirmed and requires review, not an invented success. Evidence: `tests/native-study-save.test.ts` and `../progress/evidence/native-study-save-confirmation/acceptance.md`.

PATCH operations retain the reviewed version. They are not creation-receipt replays: if a committed edit response was lost, a retry may return VERSION_CONFLICT. The editor reports that conflict and requires reviewing the latest record; it does not fabricate a successful edit.

Bottom-tab switching retains the in-memory editor. Back/deep-link replacement protects dirty or uncertain work; account changes clear it. These are implemented client behaviors, with controller/API tests. Actual iOS interaction acceptance is still pending.

## Native inline action recovery (2026-10-03)

The native StudyScreen exposes task completion directly on the task card, with checked state, textual status and an accessible44ptminimum target. Add task/schedule are first-level actions. This is native implementation; simulator/device visual acceptance remains pending.

Task/event status PATCH, imported single-occurrence cancellation and course/item DELETE use `StudyActionController`. It locks synchronously before sending, snapshots the exact version/body and validates returned record identity/version/status (or delete acknowledgement). A known non4094xxrejection is not saved.409or network/invalid responses require current-state review. **Recovery is read-only**: reload course/item/calendar collections and ask the user to review; never auto-replay a toggle/delete or substitute a fresh version.

A confirmed write followed by refresh failure remains “saved, refresh needed.” Further conflicting actions stay disabled until a successful read; successful read-only recovery of an uncertain write says current records were loaded, not that the original write necessarily succeeded. Failed reads retain the previous records with a stale-state label. Bottom-tab scene retention preserves the controller; navigation guards protect external targets from overwriting pending work. Account changes unmount this memory-only state; no durable cross-session receipt is claimed for these inline actions. External resource links are handled separately from writes.

Evidence: `tests/native-study-actions.test.ts` exercises real Fastify/SQLite toggle/reopen, double invocation, lost response/restart, failed post-save refresh,409recovery, lost course-delete response with detached task preservation, malformed responses/validation, and imported cancellation with unchanged source summary. See `docs/progress/evidence/native-study-actions/`; this does not certify iOS touch, VoiceOver, keyboard, dynamic font or notification delivery.
