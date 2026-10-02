# E1 Account and Native Foundation Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans inline; user explicitly disallows subagents and authorizes execution without another approval.

**Goal:** Persist platform accounts and sessions, expose guarded native APIs, and connect an iOS application shell to them.

**Architecture:** Extend the existing TypeScript core with a separate Fastify product API and SQLite migrations. Store credentials as hashes and development mail in an ignored local directory. Expo mobile is an independent workspace using the same HTTP contract; Next.js remains untouched in this unit.

**Tech Stack:** Node 22.23+, built-in SQLite, Fastify 5, Zod, Expo, TypeScript, HeroUI Native, SecureStore.

**Spec:** `docs/superpowers/specs/2026-10-02-ios-mvp-v1-product.md` (V01, foundation of V09; E1).

## Global constraints

- Five eventual entries: 今天、校园、发现、消息、我的. No simulated completed modules.
- iOS first; do not claim native acceptance from a bundle or web preview.
- Development mail only, no actual sending; refuse public/production configuration.
- Email ownership never grants school membership; all development accounts clearly marked.
- No external deployment, paid services, unrelated deletions, or subagents.

## Review focus

- Reused, expired or guessed codes must never create sessions (Task 1).
- Database reopen must retain valid sessions and edited profile, never raw tokens (Task 1).
- Changing profile IDs/roles in a request must not cross account boundaries (Task 1).
- Local mail must not be exposed through HTTP or a public host configuration (Task 1).
- Restoring/logging out/changing accounts must remove stale client data; network failure must not be treated as an empty success (Task 2).

## Task 1: Persistent account API

Files: `src/product/{database,config,auth,app,main}.ts`, `tests/product-auth.test.ts`, `docs/api/implemented-mvp-api.md`; root package scripts and ignore list.

Interfaces: `createProductApp({dataDir, now?})` returns a Fastify app (owns DB close). `loadLocalConfig(env)` validates explicit `local-development` mode and loopback binding. Prefix `/api/v1`. Envelope `{data,meta}`; errors `{error:{code,message,retryable,request_id}}`.

- [x] Write integration tests first: real file DB + real development inbox; challenge/verify/me/patch/export/delete/logout; no school membership; forbidden admin access; token and code expiry/replay/throttle; restart persistence; no raw credential in DB; rejected production/public origin/config. Representative expectation:
  ```ts
  const challenge = await app.inject({method:'POST', url:'/api/v1/auth/email/challenges', payload:{email:'student@example.test'}});
  expect(challenge.statusCode).toBe(202);
  expect(challenge.json().data.code).toBeUndefined();
  expect((await app.inject({url:'/api/v1/me'})).statusCode).toBe(401);
  ```
- [x] Run `npx vitest run tests/product-auth.test.ts`; record missing implementation failure.
- [x] Add transactional migrations for users, challenges, sessions and rate limits. Use random opaque tokens and HMAC code hashes; single-use challenges, 10-minute lifetime, five attempts, 60-second email resend cooldown and IP budget. Use 12-hour absolute/30-minute idle session expiry. Transactions consume challenges and create sessions atomically. SQLite foreign keys cascade deletes.
- [x] Implement strict Zod request bodies, `/auth/methods`, `/auth/email/challenges`, `/auth/email/verify`, `/auth/logout`, `/me` GET/PATCH/DELETE, `/me/export`, `/admin/status`. Bearer tokens for native; no cookie authentication yet. `me` endpoints never accept a target user ID. Delete requires confirmation and recent sign-in. Local admin provisioned explicitly, never client-selected.
- [x] Run focused tests, full `npm test`, real HTTP smoke with restart; save outputs. Document actual routes separately from proposed OpenAPI. Commit this independent deliverable.

## Task 2: Native account foundation

Files: `apps/mobile/{package.json,app.json,index.ts,App.tsx,metro.config.js,global.css}`, `apps/mobile/src/{api,session,theme,strings}.ts*`, account screens/components, mobile session tests.

Consumes Task 1's JSON API. SecureStore saves only the opaque bearer token; restored session always validated by `/me`. UI reflects unknown school membership and unavailable private connections. `ApiClient.request<T>(path, options)` normalizes errors; request auth failures clear session, network failures show retry.

- [x] Verify Expo's bundled versions against HeroUI peers; pin compatible versions and single React resolution per native bundle. Configure Uniwind using official instructions, then TypeScript/bundle validation.
- [x] Write session tests for restore, revoked token, network retry and account switch races; run red, implement client/controller, run green.
- [x] Build login/code/profile screens with HeroUI Button/Card/Input, theme tokens, scroll/keyboard/safe-area handling and zh/en strings. Backend readiness and development mode are explicit. Keep feature placeholders clearly within development shell; remove them as later units arrive.
- [x] Export an iOS bundle, check Expo dependencies, then run iOS if SDK/simulator available. Record native runtime as blocked if missing; never substitute browser evidence.
- [x] Update `docs/progress/ios-mvp-v1-handoff.md` and run focused/full verification; commit. Continue E2 on the next unit.

## Rulings and current environment

- Existing feature branch is clean and belongs to this task; keep this checkout as requested. Do not create another worktree/chat.
- The design skill contains unrelated trading-dashboard paths, vanilla-JS and three-tab rules. Apply only general spacing/state/accessibility guidance; this product explicitly requires React Native and five tabs.
- `xcode-select` points at CommandLineTools; Spotlight and `/Applications` found no Xcode. Native runtime remains unverified; continue independently verifiable work.
- MVP product scope is unchanged: this plan covers E1 only, E2–E6 still required by the active Goal.

## Execution result — 2026-10-03

Implementation/check steps above completed, including recording the missing native runtime. This does not close native acceptance: Xcode/simulator and iOS visual/Keychain testing remain pending. See `docs/progress/2026-10-03-e1-verification.md`; 65 tests, typecheck, Expo compatibility and iOS export passed. User-authorized existing checkout and canonical handoff were used; no duplicate agent workspace or subagents.
