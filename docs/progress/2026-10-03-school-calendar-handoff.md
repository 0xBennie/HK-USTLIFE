# School calendar projection handoff

Goal remains active: R1 + R1.1 complete development acceptance and trial preparation. This unit is partial R1 progress, not completion. Previous prompt-delivery turn was documentation/status only; this turn persisted design artifacts and corrected implementation contracts.

## Ownership
Worktree: `/Users/bennie/.codex/worktrees/campus-school-sync/All in one HKUST`
Branch: `codex/campus-school-sync`; unit base `338de95`; PMO snapshot base `b036e577a9d2769dcd0dbe4bd20e27a3e8c6881c`. No deployment, school calls or external messages.

## Completed
- Stable normalized school records now feed existing day/week and reminder endpoints. Stale caches remain labelled; unhealthy scopes do not schedule candidates; revocation/tombstones disappear from current planning.
- Native school completion writes private versioned state, never source submission. Source facts bypass manual edit/delete. Private notes/provenance displayed; reminders route to correct date.
- Three supplemental Pen states saved in the verified isolated document; PNG exports and trace in design/school-sync. Shared main canvas was not saved.
- API contracts corrected to reflect projection rather than obsolete persistence-only scope.

## Evidence
- `.local/school-sync/calendar-full-tests.log`: 53 files, 312 tests passed (includes TypeScript build).
- `.local/school-sync/mobile-projection-typecheck.log`: mobile tsc passed.
- Red tests recorded missing API projection and wrong native acknowledgement/target before implementation.
- Pen traversal of f0DrVG/O2ngP/apf7H produced no clipping reports; rendered normal/completed reviewed and partial reviewed during creation. Native Save removed Edited marker; git recognizes own design modification.
- Latest ReminderControls edit changes warning wording only from imported series to calendar sources.

## Outstanding
No school OIDC, approved SIS/Canvas network transport, token custody, real student data or actual iOS interaction evidence. Default source registry is intentionally empty. No course association, school private-note/reminder editor, or full course view integration yet. R1.1 mechanisms remain outstanding. Screenshots do not prove touch/notification/accessibility acceptance.

## Next
Complete school connection/source management and personal reminder/notes UI with explicit revoke/cache semantics; then approved transport when credentials/contracts become available. Recheck actual iOS environment for runtime verification. Continue R1.1 according to PRD after inspecting existing implementation to avoid duplicate work.
