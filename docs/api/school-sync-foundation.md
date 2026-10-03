# School sync foundation — implemented backend contract

Updated 2026-10-03. Implements a persistent normalized-source engine and authenticated cache/personal-data endpoints. **No school OIDC, SIS or Canvas transport is configured, no real approval has been obtained, and no student data was fetched.** All adapter tests use explicitly synthetic normalized fixtures, not claimed HKUST response formats. AC13/AC14 real integration remains incomplete.

Related requirements: PRD A01, L01, L02, D01–D03. This unit does not yet project source records into native Today/Week, course details or device reminders. A saved `remind_minutes` preference is not a delivered notification.

## HTTP endpoints

Base and authentication follow [implemented MVP API](implemented-mvp-api.md): local-development only, bearer session, no-store, existing error envelope. Every record query is bound to the authenticated owner. Administrators receive no read/approval bypass. Public endpoints do not expose this data.

| Method/path | Inputs | Result |
|---|---|---|
| GET `/school/connections` | None | Separate SIS/Canvas states, availability, connection version, consent version, last attempt, last successful scope refresh, scope coverage/errors |
| GET `/school/records` | `limit=1..100` (default 20), UUID `cursor`, optional `provider=sis\|canvas` | `{items,next_cursor,connections}`; includes retained/tombstoned records with explicit source state |
| GET `/school/records/:id` | UUID | Owner's normalized source record and separate personal layer; another owner receives 404 |
| PATCH `/school/records/:id/personal` | `{version,notes?,completed?,remind_minutes?}` | Updated record; source payload cannot be edited here |
| DELETE `/school/connections/:provider` | `{version,delete_cached_data:boolean}` | `{connection,cache,upstream_revocation:"not_attempted"}` |
| GET `/me/export` | Existing endpoint | Adds `school:{connections,records}`; additive export version 5 remains compatible |
| DELETE `/me` | Existing recent-auth/confirmation requirements | Cascades connections, source records and personal annotations |

There is **no HTTP grant, ingest or refresh endpoint**. A client cannot mark itself approved, submit a subject as authorization, or supply an upstream URL. The actual local app constructs an empty contract registry and reports `availability:"approval_required"`.

## Record shape and private semantics

A source record contains `id` (stable local UUID), `provider`, `scope`, `remote_key`, `payload`, `source_state`, `source_updated_at`, `source_seen_at`, `version`, and `personal`.

- Source identity is `(owner,provider,scope,remote_key)`. Identical course titles or remote keys in different sources/scopes are never merged.
- Collections: SIS `timetable` normalizes timed/all-day events; Canvas `courses`, `assignments`, `events` normalize course, task and event payloads using existing validation. This is an internal contract, **not a list of upstream endpoints**.
- `source_state` is `active`, `cancelled` or `removed`. Missing rows become tombstones only under the configured complete-scope semantics; personal annotations survive source updates/removal. Readers must not treat tombstones as active tasks.
- `source_updated_at` can be null. `source_seen_at` is when this application accepted the snapshot. Neither is substituted for the other.
- Personal values default to `{notes:"",completed:false,remind_minutes:null,version:0}`. Notes allow 10,000 characters. Reminder offsets are null or 0–10,080 minutes and require a timed record. Completion means a personal check, not Canvas submission or official completion.
- Annotation versions are independent of source versions; stale annotation writes return `VERSION_CONFLICT`. Timetable/course/assignment official facts cannot be changed through the personal endpoint.
- Cross-source course associations, recurrence expansion, course enrolment/submission state and native presentation are separate next units. Remote adapters must provide stable identities and fully normalized occurrences; no title-based associations are inferred here.

## Connection and sync state

`state` covers approval_required, not_connected, syncing, connected, partial, reauth_required, revoked and error. `availability` independently indicates `configured` or `approval_required`; a recorded revocation remains visible even when a deployment lacks approved configuration.

Each approved scope has independent latest-attempt/success timestamps and error state. The connection's timestamp is the latest timestamp among its scopes, **not proof that every scope succeeded**. `connected` requires every configured scope to have completed. An incomplete/failed second page retains the previous successful snapshot and success time.

The internal `createSchoolStore(db,now,contracts)` registry requires approval reference, consent version and bounded unique scope definitions. SIS cannot be configured as a Canvas collection, and Canvas cannot claim formal timetable coverage. The validated registry is copied at construction so callers cannot mutate a running worker's policy.

The future approved identity adapter calls `grant(owner,provider,{subject,consent_version})` only after verifying the school identity and user consent. The store does not verify an OIDC token; it is not a replacement for OIDC validation. A different subject on the same connection is rejected; email suffix or developer login never proves school identity. Approval/policy changes require a new version/reference and a fresh grant.

`syncSchoolScope(store,owner,provider,scope,fetchPage)` is a server-side normalized adapter runner:

1. Acquire one persisted 5-minute lease per owner/provider/scope. A concurrent worker receives `SYNC_BUSY`.
2. Fetch up to 100 pages and 10,000 records, checking lease/consent generation before and after each await. Reject repeated cursors, invalid envelopes, invalid records and duplicate remote keys.
3. Buffer the complete scope, then commit it in one SQLite transaction. Failed pages never partly overwrite current records. Scopes configured with `missing:"retain"` preserve absent rows; `missing:"remove"` permits tombstones only inside that complete scope.
4. Repeated unchanged snapshots preserve IDs and source versions. Private overlays remain separate.
5. A safe failure code replaces provider exception text. `SchoolAuthorizationExpired` marks reauth_required and blocks further scope reads until a new grant. No provider exception, subject or credentials are returned through status/export.
6. Revoking/reconnecting or replacing an expired worker invalidates old leases. Old workers cannot commit records or overwrite current status. Process restart preserves accepted data; an expired interrupted lease displays an error and can be retried by the future scheduler.

No upstream token vault, refresh token rotation, HTTP cancellation/timeout adapter or periodic scheduler is shipped in this unit. A real adapter must enforce bounded request timeouts and approved rate limits; the lease prevents late writes but is not a network abort. There are no school credentials stored by this module.

## Revocation and deletion

Revocation increments the connection generation and clears active leases atomically. `delete_cached_data:false` retains source cache and personal annotations, clearly alongside revoked state. `true` deletes **both** cached source rows and their personal annotations. Native confirmation must explain that consequence before requesting it.

Response `upstream_revocation:"not_attempted"` is literal: this unit has no token/remote revocation adapter. Local invalidation does not claim the school's authorization has been revoked. A retry with an old version returns 409; read the current connection before deciding whether to repeat with a new version. No silent retry may turn “keep data” into “delete data”.

Account deletion uses existing recent authentication and deletes all owned school rows through foreign keys. No logs contain private source payloads. Approved production retention, encrypted token custody and backup policy remain external-integration requirements.

## Errors and verification

Existing 400/401/404/409 envelopes apply. Relevant codes: `SCHOOL_APPROVAL_REQUIRED`, `SCHOOL_AUTH_REQUIRED`, `SCHOOL_REAUTH_REQUIRED`, `SCHOOL_SCOPE_UNAPPROVED`, `SCHOOL_IDENTITY_MISMATCH`, `SYNC_BUSY`, `SYNC_OBSOLETE`, `INVALID_SCHOOL_SNAPSHOT`, `VERSION_CONFLICT`. Internal sync failure codes are safe enums, not provider messages. A 409 requires inspecting current state; existing generic envelope does not mark every conflict automatically retryable.

Behavior evidence: `tests/school-sync.test.ts` uses temporary real SQLite plus normalized fake provider pages for partial fetch, source/personal isolation, complete-scope deletion, identity isolation, lease/revoke/reconnect races, auth expiry, invalid contracts, invalid dates, restart and account cascade. `tests/product-school.test.ts` uses the real Fastify routes and auth system for access, strict inputs, no public approval path, personal writes, restart/export/revocation/deletion. These tests are backend evidence only; fixtures are not real school or iOS acceptance.
