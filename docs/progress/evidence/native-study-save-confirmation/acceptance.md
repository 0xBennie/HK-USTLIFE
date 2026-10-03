# Study save confirmation — 2026-10-03

Observed and fixed: a fulfilled request previously dismissed StudyForm without checking acknowledgement data. Expiring creation replay also failed to reject backwards/nonfinite wall-clock elapsed time.

`save-response.ts` checks submitted course/item/occurrence fields after server normalization, resource identity and expected edit version. `save-controller.ts` retains uncertain payload/key and shares the existing bounded replay policy. StudyForm offers return-to-records rather than an unusable retry once review is required; the saved state disables further Save actions.

- Targeted real Fastify/SQLite tests: 15 passed, including10new cases covering malformed course acknowledgement/restart/no duplicate, normalized event/task/note values, mismatched id/version/title/body, negative/nonfinite time, imported occurrence identity/content and unchanged source rule.
- `npm test`: **280 tests / 49 files passed**, including core TypeScript build. `tests.txt`.
- Native TypeScript: passed, `typecheck.txt`.
- iOS export: passed,1676modules, `ios-export.txt`. Export is not an installed App.
- `git diff --check`: passed.

No actual iOS interaction in this unit. Native save/error/back buttons, keyboard, dynamic font and motion remain unaccepted. Latest environment confirms CommandLineTools and no simctl. No new dependencies, deployed services, external messages, account access, Xcode installation or subagents.

Current scope-to-evidence audit: `../../2026-10-03-mvp-acceptance-matrix.md`. It also records the next confirmed gap: campus correction input/navigation and uncertain-save handling. Overall Goal remains incomplete.
