# School sync persistence and recovery implementation plan

> Execution: inline in this session, no subagents. The active Goal authorizes implementation of R1/R1.1; this is the first independently verifiable backend unit, not completion of AC13/AC14.

**Goal:** Persist approved-provider connection state and scope-bound school snapshots without destructive partial refreshes, private-note loss or writes after revocation.

**Architecture:** A server-only contract registry controls providers and scopes. A SQLite store owns grants, per-scope sync leases, immutable source identities and separate personal annotations. An adapter runner gathers validated pages, then atomically commits one scope; the shipped app has no approved contracts or school adapters, so it remains approval-gated.

**Tech stack:** Existing Node 22, TypeScript, SQLite, Fastify, Zod, Vitest. No new dependencies.

**Spec:** `docs/PRD.md` A01/L01/L02/D01/D02/D03 and AC13–AC14; `docs/superpowers/specs/2026-10-03-school-learning-sync.md`; `docs/api/hkust-sis-integration.md`.

## Global constraints

- Worktree: `/Users/bennie/.codex/worktrees/campus-school-sync/All in one HKUST`.
- Branch `codex/campus-school-sync`; PMO snapshot baseline `b036e577a9d2769dcd0dbe4bd20e27a3e8c6881c` verified against PMO metadata.
- Only school backend, its tests/docs, auth profile and shared app integration files. Browser, Pen, mobile UI, PMO and shared-directory code are outside this unit.
- No real credentials, invented SIS endpoint, password collection, network calls, deployed services or claim of live school connection.
- Internal grants require an explicit approved contract reference and current consent version. No HTTP grant/ingestion endpoint; ordinary members and administrators cannot mark a connection approved.
- Partial pagination never removes previous records. Missing rows are removed only inside a complete authoritative scope whose approved contract explicitly defines absence as removal.
- Private annotations are independent of source payload. Revocation stops writes; cache deletion is explicit. Account deletion cascades all owned records.

## Review focus

1. Late completion after revoke/reconnect or another sync must not resurrect data.
2. Empty/partial scope results must not erase unrelated semesters or sources.
3. Same remote ID in SIS and Canvas or in different scopes must stay distinct.
4. Restart, stale personal edits and cross-account lookups must preserve isolation.
5. Upstream invalid data, repeated cursors and auth failures must keep old data and honest freshness.

## Task 1: Persistent school store and adapter runner

Files: add `src/product/school/{schemas,store,sync}.ts`; modify `src/product/database.ts`; add `tests/school-sync.test.ts`.

Interfaces: `createSchoolStore(db, now, contracts = {})`; internal `grant(owner, provider, {subject, consent_version})`; `begin(owner, provider, scope)` returns a lease; `commit(lease, records)` atomically replaces/updates the approved scope; `fail(lease, code)` records safe state; `revoke(owner, provider, version, deleteCachedData)`; `list/status/annotate/exportAll`; `syncSchoolScope(store, owner, provider, scope, fetchPage)` wraps pagination. Credentials belong to the later approved adapter, never this store.

- [x] Add behavior tests with real temporary SQLite, fixture approval metadata explicitly not school approval: new source defaults blocked; partial second page preserves snapshot; authoritative missing row removal only in same scope; source change preserves personal notes; revoke during fetch; replay/overlapping run; stable IDs and ownership; restart/delete.
- [x] Run `node_modules/.bin/vitest run tests/school-sync.test.ts`. Expected: missing school sync behavior fails before implementation.
- [x] Implement migration and runtime validation. Use `BEGIN IMMEDIATE` for grant/lease/commit/revoke/annotation; reject stale versions and expired/replaced leases with `SYNC_OBSOLETE`.
- [x] Gather pages with bounded count/record count and cursor-loop detection. A failed attempt preserves the previous successful timestamp and snapshot. No school network transport is introduced.
- [x] Run focused tests and `npm run build:core`. Expected: all new cases pass and TypeScript exits 0.

## Task 2: Read/annotation/revoke API and account lifecycle

Files: add `src/product/school/routes.ts`, `tests/product-school.test.ts`; modify `src/product/{app,auth}.ts`; add `docs/api/school-sync-foundation.md`; update `docs/api/implemented-mvp-api.md`.

Interfaces: authenticated `GET /school/connections`, `GET /school/records`, `PATCH /school/records/:id/personal`, `DELETE /school/connections/:provider`. Read APIs expose source state/freshness and pagination; grants and ingestion remain server-only. Account export gains `school` as an additive field while preserving export version 5 compatibility.

- [x] Write HTTP tests: unauthorized read; no client approval/grant path; own records only; strict payloads; revoked status after retry; export and deletion; private source data stays out of public endpoints.
- [x] Run focused HTTP tests expecting failures from absent routes.
- [x] Register routes with existing authentication/no-store/error envelope. Keep `/me.connections` compatible and add SIS. Never merge email ownership into school membership.
- [x] Run focused HTTP/store tests, then full `npm test`. Expected: zero failed tests; record any baseline or environment failures separately.
- [x] Document exact implemented vs pending contracts. Review diff, record acceptance/limitations and commit only owned paths, never dependency symlink or shared-directory files.

## Next units beyond this plan

Real OIDC/Canvas/SIS adapters and token custody need approved external contracts; native learning/source details and reminders need their own Pen/UI acceptance unit; actual iOS runtime remains required. This backend contract suite cannot satisfy real school or iPhone acceptance.

## Execution result

2026-10-03: this backend unit implemented and reviewed inline, no subagents. Full suite: 52 files / 306 tests passed. Initial store check stopped at the not-yet-created module; it was not an executed behavioral failure. HTTP routes, expired authorization, revoked-state reporting, invalid contract policy and newly added scope coverage were separately observed failing before their fixes. Native, school-network and student acceptance remain outside this completed backend unit. Evidence: `docs/progress/2026-10-03-school-sync-verification.json`.
