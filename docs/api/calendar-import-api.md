# Implemented calendar import API — local development

Bearer authentication and local-only envelope follow `implemented-mvp-api.md`. These endpoints are implemented. Imported occurrences are now included in `/me/calendar` and displayed in the native day/week cards. Native file selection and conflict-review screens are next; do not claim a complete ICS workflow.

- POST `/api/v1/calendar/imports/preview`: `{source_name,content,floating_timezone?}` for a new collection, or `{source_id,content,floating_timezone?}` for reimport. Exactly one source choice. Returns 201 with `id`, 30-minute `expires_at`, source, issues and entries. Entries contain preserved series definitions, expected version, new/unchanged/update action and previous title. No source or timetable mutation before confirmation. Max 256 KiB ICS and 20 outstanding previews per owner.
- POST `/api/v1/calendar/imports/:id/confirm`: `{uids:string[],acknowledge_fingerprints?:boolean}`. Explicit selected UIDs only; UID-less fingerprint entries require acknowledgement. Atomic version checks, partial imports preserve absent UIDs. Same preview + normalized same selection replays original result; changed selection returns 409. Preview ID itself is the idempotency scope. Returns `{source_id,imported}` where imported excludes unchanged entries.
- GET `/api/v1/calendar/sources`: owner sources with `id,name,version,created_at,series_count`.
- DELETE `/api/v1/calendar/sources/:id`: `{version}`. Removes source and series, never independent study notes. Replay of a previously confirmed deleted source returns 410, without resurrection.
- GET `/api/v1/me/export`: schema version 3 adds `calendars` with complete preserved series definitions. Private to owner. Account deletion cascades sources, series and previews.

Errors: 400 malformed input/calendar/invalid selection; 404 inaccessible resource; 409 stale preview/changed confirmation/unreviewed fingerprint; 410 expired preview/deleted confirmed source; 429 pending preview limit. Existing common auth errors apply. Unsupported individual calendar entries appear in preview issues and cannot be selected.

Pending: native file picker/import/conflict review, reset/cancelled-override management, human-readable changed-field details and preview retrieval. Confirmed previews currently retain private snapshot data until account deletion; source deletion does not purge confirmation history. Production retention policy and bounds must be completed before public operation.

## Calendar projection

GET `/api/v1/me/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD&timezone=...` combines owner manual records with expanded imported series. End date exclusive; maximum 42 days. All-day dates retain their dates; timed events group in the requested display timezone. Unknown end remains null. Recurrence rules are expanded on demand, including moved/cancelled exceptions. Stable occurrence `id` is `ics:<series UUID>:<original recurrence ID>`; never send it to `/study/items/:id`.

Imported events include `import_origin` (source/series identity, source name, original recurrence ID), `source_status` and `participation: unknown`. They have no fabricated created/updated timestamps. Native cards support a dedicated single-occurrence edit form. They are not course enrolment evidence.

`import_issues` reports series that cannot be expanded (for example traversal bounds). Successfully expanded/manual records remain available, but the client must show the partial-result warning. Maximum 5,000 candidate occurrences per response; oversized series are reported and skipped as a whole, never truncated silently.

## Private single-occurrence changes

PATCH `/api/v1/calendar/series/:id/occurrence`: `{version,recurrence_id,event}`. `event` is a complete ordinary event input (kind event, course_id null), with dates validated by the study event schema. This changes one original recurrence identity only. Series version is returned and incremented; stale writes return VERSION_CONFLICT 409. Another owner or a nonexistent/out-of-rule occurrence returns 404. Source and account deletion cascade these overrides.

The saved event is a full private snapshot. Its title/time/location and other fields take precedence over the source for that occurrence, including moves across query windows. Native edit inputs explicitly use Hong Kong wall time; source custom timezone rules remain stored separately. `locally_modified` and `source_occurrence_missing` distinguish a private retained appointment from current source data. Local cancellation removes it from active calendar projection; cancelled-override management UI remains pending.

Reimport preview returns action `conflict` and `local_changes` count when that series changed in the source and local snapshots exist. Confirm requires `resolutions:{[uid]:"keep_local"|"use_source"}` for each selected conflict. Resolution applies to all locally edited occurrences of that series: keep_local retains their full snapshots while updating untouched occurrences; use_source removes those private overrides. No resolution means LOCAL_CONFLICT 409 and no mutation. Local edits after preview invalidate it. Export includes override snapshots, including local cancellations. Source-removal with keep_local keeps the private occurrence and marks it absent from source; it does not pretend the source still confirms it.
