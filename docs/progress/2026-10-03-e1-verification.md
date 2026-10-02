# E1 verification — 2026-10-03

## What exists

File-backed SQLite with transactional migrations; a separate Fastify product API; local email-code authentication, profile editing, export/delete, session revocation, restricted admin endpoint and repeatable local demo seed. Native Expo shell uses HeroUI Native with login/profile actions, five development navigation entries, basic zh/en text, system appearance, safe-area and keyboard-aware scroll containers.

The four non-account tabs are explicitly unfinished in this development unit. They are not accepted product functionality. No campus data or social feed is fabricated.

## Observed results

| Check | Result | Evidence |
| --- | --- | --- |
| Backend TypeScript + all repository tests | 24 files / 65 tests passed | `evidence/e1/tests.txt` |
| New product account tests | 11 passed, real file DB | Included above |
| Native session-controller tests | 5 passed against actual local HTTP, memory token-storage substitute | Included above |
| Fresh backend process / shutdown / restart | Profile and session persisted; logout token rejected | `evidence/e1/process-smoke.txt` |
| Mobile TypeScript | Passed with TypeScript 6.0.3 | Command output observed |
| `expo install --check` | Dependencies are up to date | Command output observed |
| iOS Hermes bundle export | Passed, 1554 modules, approximately 3.8 MB | `evidence/e1/ios-bundle.txt` |
| Simulator availability | Failed: `simctl` unavailable; developer path is CommandLineTools | `evidence/e1/environment.json` |
| Actual iOS launch / visual QA / Keychain | **Not run, blocked by missing native environment** | No screenshots fabricated |

Initial tests failed because account/session modules did not exist. After implementation they passed. A separate regression test for a delayed private export after switching accounts first failed (old account data returned), then passed after epoch validation rejected stale responses. This avoids cross-account export leakage in the client.

The initial mobile install encountered a missing global npm cache blob; retry used project-local `.local/npm-cache` and succeeded. SDK compatibility check requested TypeScript ~6.0.3; upgraded only the mobile workspace and added CSS module declarations required by TypeScript 6. Final typecheck and iOS bundle passed. Node SQLite experimental and terminal color-environment warnings remain; neither is a native runtime result.

## Review and scope

Self-review only, as requested; no subagents. Checked request schemas, SQL binding/transactions, token and code handling, public host/origin refusal, database close/reopen, asynchronous account switching, and bundle dependency selection. Existing website React patch differs; Metro pins React imports to the mobile workspace to prevent mixed native React copies.

No MV01–MV12 is claimed fully closed yet: all are full-product acceptance cases and require later units and real iOS execution. E1 supplies verified account foundations for MV02/MV03/MV10/MV11 and build evidence for MV01, not substitutes for the missing flows.

## Remaining dependencies and risks

- Install full Xcode + an iOS runtime or provide its actual existing path; then test native login, Keychain restore, accessibility text sizes, keyboard, light/dark and screenshots. An async question has been sent; work on E2 can continue independently.
- Endor package-risk signal is unavailable (no MCP/CLI), so no Endor approval claimed. npm's current findings remain in `evidence/e1/dependency-audit.json`. fast-uri updated to patched 3.1.8/4.2.1. Existing Next/Vitest issues and Expo toolchain dependencies must be assessed before public release; do not follow audit's suggested Expo 44 downgrade.
- Development authentication intentionally cannot be used from a LAN/physical phone or public deployment. Real email service, school claims, remote push, hosting and production administration are not configured.
- SecureStore, real rendered components and actual native behavior remain unverified until iOS runs.
- Next implementation: E2 courses, personal schedule/tasks/notes/material links, ICS preview/import and ownership tests; preserve all E3–E6 requirements.
