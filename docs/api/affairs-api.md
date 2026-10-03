# Important affairs API — implemented foundation

2026-10-04; X05 / partial AC19. Local persistent backend only. No official result adapter, approved school write access, native affair screen, personal date/reminder projection or reviewed live template seeds are delivered by this unit. Empty public catalogue is intentional until content is reviewed and published. Tests use labelled fixtures in temporary databases.

## Routes

Base `/api/v1`; standard `data/meta` and structured errors. Private routes derive owner from bearer session, never request input. Other owners' IDs return404, including administrators; no elevated private-access route exists.

| Method | Path | Contract |
|---|---|---|
| GET | /affairs/templates | Public active templates. limit1–50(default20), cursor template ID, ascending ID. q/school/type filters not implemented; unknown fields400. |
| GET | /affairs/templates/:id | Public current template;404 missing,410 retired. |
| GET | /me/affairs | Private list. limit1–50(default20), state active(default)/archived, opaque base64url cursor for (created_at,id). Invalid cursor400. |
| POST | /me/affairs | template_id,revision,label(optional). Required Idempotency-Key,8–128 ASCII alphanumeric/underscore/hyphen.201. |
| GET | /me/affairs/:id | Private fields, accepted/current revision, both source snapshots, change_summary, requires_review and official_status. |
| PATCH | /me/affairs/:id | Required version plus editable fields below. Unknown fields400; stale version409. |
| POST | /me/affairs/:id/accept-revision | instance_version,from_revision,to_revision,changed_step_choices (step ID→retain/reset); required Idempotency-Key. |
| DELETE | /me/affairs/:id | Body {version}; deletes instance and acceptance history. Does not withdraw anything at school. |
| GET | /me/export | Existing v5 additive `affairs` array: private instances, acceptance history and full accepted_templates snapshots; other owners excluded. |

Editable fields: label(max120), note(max2000), step_checks(known step IDs→boolean), submission(not_reported/self_reported), self_reported_outcome(unknown/received/approved/rejected/completed), archived(boolean). Step updates merge with existing checks. Empty patch and unknown step rejected. Read-only `reported_at` records the server time when submission changes to self_reported; `outcome_recorded_at` records when a nonunknown personal outcome changes. Unrelated edits or repeated same-state patches preserve these times. Clearing submission/outcome clears its respective timestamp. These are App recording times, never official submission/approval times. Migration17 leaves legacy timestamps null rather than inventing them. Client timestamp overrides are rejected. personal_due and reminder fields remain unimplemented.

`official_status` is always `{status:"unknown",reason:"not_connected"}`. There is no member-writable official field. A self_reported_outcome of approved/completed remains personal input, not evidence of approval. It never changes official_status.

Create rejects old revisions409 TEMPLATE_CHANGED, retired410 TEMPLATE_RETIRED, nonverified/expired sources409 SOURCE_REVIEW_REQUIRED. Maximum100 active instances per person applies on create and unarchive. Multiple instances of the same template are allowed.

## Revision acceptance and retry

Published revisions are immutable, strictly sequential and retain sources. Private checks stay attached to accepted_revision until explicit acceptance. Response diffs cover title, summary, conditions, materials, deadline, sources and steps.

Changed existing steps require exactly one explicit retain/reset choice each. New steps are unchecked; removed checks remain in acknowledgement history. Personal notes and submission/outcome are preserved. Retired or unreviewed latest versions cannot be accepted.

Version swap, checks, acknowledgement and retry receipt are one SQLite transaction. Stale instance/version or superseded target409 requires a new preview. A database failure rolls all of them back.

Receipts are owner/scope/key bound, with canonical input hash. Same key and content returns the original resource's **current** representation; it does not replay an old snapshot. Different content409 WRITE_KEY_REUSED. Deleted original410 RECORD_REMOVED. Receipts remain as owner-scoped tombstones until account deletion, preventing a late retry from recreating a deleted item; they contain hashes and IDs, not private text. PATCH uses optimistic version protection; after an uncertain result read the object before retrying.

## Maintenance boundary and remaining work

Store-level `publish`/`retire` functions are trusted internal functions, not member HTTP endpoints or generic administrator routes. Publication validates bilingual text, source references, source HTTPS HKUST domain, review dates, unique step/source IDs and sequential revisions. No external fetch occurs. Separate reviewer UI/CLI and source-change detection remain to be implemented before live content operations.

Migration17 adds nullable recording timestamps. Migration16 creates public immutable revisions, private owner-cascaded instances, acceptance history and receipts. Account deletion removes private data while retaining public templates. No school credentials, card numbers or receipt uploads are supported.

Next: source filters, personal dates/reminders, reviewed templates, maintenance audit controls, native UI and iOS acceptance. Current foundation is not full X05 completion.
