# Implemented calendar import API — local development

Bearer authentication and local-only envelope follow `implemented-mvp-api.md`. These endpoints are implemented. Imported occurrences are now included in `/me/calendar` and displayed in the native day/week cards. Native file selection, conflict review and source/override management are implemented. Actual iOS runtime acceptance remains outstanding.

- POST `/api/v1/calendar/imports/preview`: `{source_name,content,floating_timezone?}` for a new collection, or `{source_id,content,floating_timezone?}` for reimport. Exactly one source choice. Returns 201 with `id`, 30-minute `expires_at`, source, issues and entries. Entries contain preserved series definitions, expected version, new/unchanged/update action and previous title. No source or timetable mutation before confirmation. Max 256 KiB ICS and 20 outstanding previews per owner.
- POST `/api/v1/calendar/imports/:id/confirm`: `{uids:string[],acknowledge_fingerprints?:boolean}`. Explicit selected UIDs only; UID-less fingerprint entries require acknowledgement. Atomic version checks, partial imports preserve absent UIDs. Same preview + normalized same selection replays original result; changed selection returns 409. Preview ID itself is the idempotency scope. Returns `{source_id,imported}` where imported excludes unchanged entries.
- GET `/api/v1/calendar/sources`: owner sources with `id,name,version,created_at,series_count`.
- DELETE `/api/v1/calendar/sources/:id`: `{version}`. Removes source and series, never independent study notes. Replay of a previously confirmed deleted source returns 410, without resurrection.
- GET `/api/v1/me/export`: schema version 3 adds `calendars` with complete preserved series definitions. Private to owner. Account deletion cascades sources, series and previews.

Errors: 400 malformed input/calendar/invalid selection; 404 inaccessible resource; 409 stale preview/changed confirmation/unreviewed fingerprint; 410 expired preview/deleted confirmed source; 429 pending preview limit. Existing common auth errors apply. Unsupported individual calendar entries appear in preview issues and cannot be selected.

Runtime acceptance pending: native file picker, rendered UI, keyboard/accessibility and weak-network interactions. Backend preview details and source/override management endpoints are implemented.

## Calendar projection

GET `/api/v1/me/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD&timezone=...` combines owner manual records with expanded imported series. End date exclusive; maximum 42 days. All-day dates retain their dates; timed events group in the requested display timezone. Unknown end remains null. Recurrence rules are expanded on demand, including moved/cancelled exceptions. Stable occurrence `id` is `ics:<series UUID>:<original recurrence ID>`; never send it to `/study/items/:id`.

Imported events include `import_origin` (source/series identity, source name, original recurrence ID), `source_status` and `participation: unknown`. They have no fabricated created/updated timestamps. Native cards support a dedicated single-occurrence edit form. They are not course enrolment evidence.

`import_issues` reports series that cannot be expanded (for example traversal bounds). Successfully expanded/manual records remain available, but the client must show the partial-result warning. Maximum 5,000 candidate occurrences per response; oversized series are reported and skipped as a whole, never truncated silently.

## Private single-occurrence changes

PATCH `/api/v1/calendar/series/:id/occurrence`: `{version,recurrence_id,event}`. `event` is a complete ordinary event input (kind event, course_id null), with dates validated by the study event schema. This changes one original recurrence identity only. Series version is returned and incremented; stale writes return VERSION_CONFLICT 409. Another owner or a nonexistent/out-of-rule occurrence returns 404. Source and account deletion cascade these overrides.

The saved event is a full private snapshot. Its title/time/location and other fields take precedence over the source for that occurrence, including moves across query windows. Native edit inputs explicitly use Hong Kong wall time; source custom timezone rules remain stored separately. `locally_modified` and `source_occurrence_missing` distinguish a private retained appointment from current source data. Local cancellation removes it from active calendar projection; cancelled overrides remain visible in the native source-management screen for restore/reset.

Reimport preview returns action `conflict` and `local_changes` count when that series changed in the source and local snapshots exist. Confirm requires `resolutions:{[uid]:"keep_local"|"use_source"}` for each selected conflict. Resolution applies to all locally edited occurrences of that series: keep_local retains their full snapshots while updating untouched occurrences; use_source removes those private overrides. No resolution means LOCAL_CONFLICT 409 and no mutation. Local edits after preview invalidate it. Export includes override snapshots, including local cancellations. Source-removal with keep_local keeps the private occurrence and marks it absent from source; it does not pretend the source still confirms it.

## Native import client and readable preview

`apps/mobile/src/study/ImportScreen.tsx` selects an `.ics` file using the system picker, reads its app-cache copy, removes that cache copy and keeps the draft text only in screen memory. File selection is user initiated. Source documents are not modified. Before confirming, choose a new named collection or an existing collection for reimport. Entries start unselected; conflicts and fingerprint identity need explicit choices. A failed/uncertain confirmation retries the same frozen payload.

Preview entries now include `summary` and `previous_summary` with title, start/end/duration, timezone, rule, exclusions, exception summary, location, description and source status. The native client shows before/after changed values. No imported source content is executed or fetched. UI has compiled/bundled but still requires actual iOS picker, keyboard, accessibility and weak-network acceptance.

## Management and retention

- GET `/api/v1/calendar/sources/:id`: owner source summary, per-series version and readable summary, private override snapshots (including cancelled). No raw ICS returned here.
- PATCH `/api/v1/calendar/series/:id/occurrence/status`: `{version,recurrence_id,status: active|cancelled}`; preserves the current private fields, or creates a private snapshot from that source occurrence. It does not alter other recurrences. Source-defined cancelled/nonexistent occurrences cannot be fabricated through this endpoint.
- DELETE `/api/v1/calendar/series/:id/occurrence`: `{version,recurrence_id}`; removes the private override, increments series/source versions. Current source projection applies again, possibly absent if source cancelled it. Independent notes unaffected.
- GET `/api/v1/calendar/imports/:id`: owner-only pending preview or confirmed receipt `{id,state:confirmed,result}`. Expired accesses reject; inaccessible IDs return 404.

Confirmation removes raw ICS and full preview content from the preview row immediately, retaining only source identity and replay receipt for 24 hours. Pending previews expire after 30 minutes. Expiry is enforced on access; physical cleanup is opportunistic on server startup, new preview creation or expired preview access (not a background deletion SLA). Removing a source purges its pending snapshots; minimal confirmed receipts may remain until expiry, returning 410 on replay after source deletion. Account removal cascades all data.

Per owner: 20 outstanding previews, 20 sources, 2,000 imported series and 200 private occurrence overrides. Limits fail explicitly before partial writes. Native `SourceScreen.tsx` lists sources, shows private cancellations, supports restore/reset, and confirms deletion of an entire source with its private overrides.
