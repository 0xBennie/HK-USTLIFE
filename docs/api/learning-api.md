# Private learning API — manual records

Implemented 2026-10-03. Base `/api/v1`; requires the native bearer account from `implemented-mvp-api.md`. All data is private to the principal. Imported calendars and official enrolments are not yet connected.

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

Reminder minutes may be null or 0–10080 and require a precise timestamp. Saving this field is configuration, **not device scheduling/delivery**; local notification integration is E5. All-day/date-only records do not silently acquire a reminder time.

## Calendar semantics

Response: `{from,to,timezone,days:[{date,events,tasks}],undated_tasks}`. Events crossing midnight appear on each overlapping local day. Exact midnight end is exclusive; unknown end appears only on its known start date with missing-end labeling. All-day dates are calendar dates and never shift with display timezone. Cancelled events are excluded from day/week; they remain editable in all records. Dated completed tasks remain visible with their status; undated_tasks includes open tasks only.

Timezone must be recognized by Intl. Display date changes do not rewrite stored instants. Native display choices currently HK/UTC/London/New York; manual timed inputs are explicitly labeled Hong Kong time. Editing other fields preserves an unchanged timestamp's original seconds/milliseconds.

## Removal/export

Deleting a course sets its items' course_id to null and increments affected item versions, preserving their content. Deleting an account cascades courses, items and idempotency rows. Individual item deletion keeps the consumed retry key until expiration to prevent resurrection. Exports contain all own records across pages, including cancelled events/completed tasks. No other account's data is included.

## Still pending

ICS preview/confirmation, recurrence expansion/EXDATE/RECURRENCE-ID, source update conflicts and import batch lifecycle are E2 Task 3 and are not delivered by these manual endpoints. Native rendered acceptance remains pending Xcode; tests prove the HTTP/storage contract and client logic, not the iOS interface.
