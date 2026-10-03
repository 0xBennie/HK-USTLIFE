# Native account exit and retained input — 2026-10-03

Observed defects: ProfileScreen invoked session sign-out/deletion without inspecting retained forms in other tabs. Profile edits did not register a navigation guard; account buttons used React state without a synchronous duplicate-action lock. StudyForm could publish callbacks after account-driven unmount.

Implemented: aggregate scene guards; account-bound exit proposals with commit-time risk checks, cancellation, replacement, identity-reset and serialization; profile draft/busy registration and guarded governance navigation; account action lock and unmount checks; StudyForm unmount checks. Only protection levels, not private draft content, enter the central registry.

## Verification

- `npx vitest run tests/native-account-exit.test.ts tests/native-navigation.test.ts`: 11 tests passed. Eight new tests start a real local HTTP Fastify server with isolated SQLite and local mailbox files. Each temporary fixture is removed after its test.
- Coverage: hidden draft cancel/confirmed exit and token revocation; delayed real study write blocks exit without invalidating its acknowledgement; changed protection invalidates a dialog; old-account confirmation cannot delete the new account; replaced dialogs cannot consume the current proposal; mandatory delete confirmation and delayed-request serialization; network-failed logout retains session and allows explicit retry; account lifecycle reset invalidates prior confirmation.
- `npm test`: 270 tests / 49 files passed, including core TypeScript build. Output `tests.txt`.
- `npm --workspace @campus/mobile run typecheck`: passed. Initial discriminated-union narrowing error retained in `typecheck-initial.txt`; corrected output `typecheck.txt`.
- `npm --workspace @campus/mobile run bundle:ios`: passed, 1675 modules. Output `ios-export.txt`; ignored bundle output in `apps/mobile/dist`.
- `git diff --check`: passed.

## Limits and next acceptance

No iOS runtime was available in this unit: active developer directory is CommandLineTools, simctl is unavailable, and standard Xcode installation is absent. The user's Xcode deferral remains in force. A question about an available iPhone remains unanswered.

Tests exercise controllers, real HTTP and persistence. They do not execute React Native Alert, native touch/keyboard, VoiceOver, large text, scroll restoration or motion. Account-screen button/field integration and unmount changes have source/typecheck/bundle evidence only. Manual native acceptance still needs: type a draft in Today, switch to My, cancel exit and verify exact text; repeat with pending/uncertain saves; profile edit → governance cancel/discard; rapid account taps; logout/login privacy; delete confirmation; interrupted network and reduced-motion/keyboard checks.

Drafts remain memory-only. No production accounts, external email, deployment or global tools were touched. Existing four release dependency findings were not re-audited or resolved here. Overall iOS MVP Goal remains incomplete.
