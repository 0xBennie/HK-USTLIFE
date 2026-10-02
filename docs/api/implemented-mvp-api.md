# MVP API — implemented endpoints

Updated 2026-10-03. This document describes running account code, separate from the broader proposed `super-app.openapi.json`. Manual learning endpoints are now implemented and documented in [learning API](learning-api.md). ICS, campus and social write endpoints are not implemented yet.

## Local transport and account state

Base: `http://127.0.0.1:4318/api/v1`. All responses use `Cache-Control: no-store`. Native requests use `Authorization: Bearer <opaque token>`; do not pass tokens in URLs. Cookie/CSRF browser sessions from the proposed document are not implemented. A later restricted web layer must use a same-origin server proxy or separately reviewed cookie session implementation.

Successful response: `{data,meta:{request_id,generated_at,mode:"local-development"}}`. Error: `{error:{code,message,retryable,request_id}}`. Input schemas reject unknown fields. Maximum request body 32 KiB. Local host header, remote IP and supplied browser Origin are checked. No HTTP access to mail files. Local HTTP is simulator-only; external connections require separate approved secure configuration.

Every account is `is_demo:true`; `membership:"unknown"` is immutable from the client. School email suffix does not grant student status. School SSO, Canvas and Outlook report `approval_required`; no external connection is attempted.

## Available routes

| Method / path | Request / result | Access |
| --- | --- | --- |
| GET `/auth/methods` | Local email state, school approval requirement, remote push unavailable | Guest |
| POST `/auth/email/challenges` | `{email}` → 202 `{challenge_id,expires_at,delivery,retry_after_seconds}` | Guest, rate limited |
| POST `/auth/email/verify` | `{challenge_id,code}` → `{access_token,token_type,expires_at,development_only}` | Guest, single use |
| POST `/auth/logout` | Revoke this bearer session → `{signed_out:true}` | Account |
| GET `/me` | Own profile and connection states | Account |
| PATCH `/me` | Non-empty subset of `{display_name,language:"zh"|"en"}` → updated profile | Account |
| GET `/me/export` | `{version:2,profile,learning:{courses,items},exported_at}` | Account |
| DELETE `/me` | `{confirmation:"DELETE"}` → `{deleted:true}` | Account; signed in within 10 minutes |
| GET `/admin/status` | Local admin database readiness | Seeded admin only |

No `/users/:id` private resource endpoints. Future private records must enforce the same principal ownership on the server. Admin provisioning is local CLI only, never a field in registration/profile.

## Authentication lifecycle

Emails are trimmed/lowercased. Codes are cryptographically random six-digit numbers, valid for ten minutes, at most five failed attempts, consumed atomically once. A replacement challenge invalidates older codes. Resend cooldown is 60 seconds; the local IP may request ten codes per hour. 429 returns `Retry-After`.

Only an HMAC of `challenge_id:code` is stored in SQLite; local secret file is mode 0600. Development mail contains the clear code intentionally, in an ignored mode-0700 directory with mode-0600 files. Used/expired mail is removed during authentication maintenance/startup. No SMTP/provider configured, no real mail sent, no code in the normal HTTP response or server log.

Tokens are random 256-bit opaque values; only SHA-256 token hashes are in SQLite. Sessions expire after 30 minutes idle or 12 hours absolute. Logout revokes the current session; deleting an account cascades all sessions and removes related challenges/mail. This is application-level deletion, not a guarantee about filesystem backups or forensic disk erasure.

## Development/prod boundary

`CAMPUS_MODE=local-development` required by launch/seed CLI. `NODE_ENV=production` and any configured bind host other than `127.0.0.1` fail startup. This adapter does not support public registration or direct physical iPhone network access. Missing official credentials are not simulated.

Development accounts: `student-a@example.test`, `student-b@example.test`, `admin@example.test`; invoke `npm run api:seed` to provision. They still use the real challenge/verification flow. Seed is repeatable and does not overwrite existing profiles/roles.

## Evidence and remaining work

`tests/product-auth.test.ts`: real file-backed SQLite, account separation, role escalation denial, code replay/expiry/guessing/resend/throttle, session expiry/logout, deletion and restart. `tests/mobile-session.test.ts`: real HTTP API with platform-independent native session controller; SecureStore adapter is replaced by in-memory storage because native runtime is unavailable. This is not an iOS UI test.

`scripts/smoke-product-account.mjs`: two actual server process launches against one temporary database, persistence and revoked-token check. See `../progress/2026-10-03-e1-verification.md` for results and limitations.
