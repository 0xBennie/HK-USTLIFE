# App mock interaction checkpoint

## Current user direction

- Prioritize the App mock and connected frontend experience. Xcode and native runtime acceptance are deferred, not complete.
- User rejected static screens as an interaction deliverable. Before further UI work, use the explicitly requested `/Users/bennie/.agents/skills/pua/SKILL.md`; apply prototype-first, evidence-based verification, not self-assessed quality scores.
- Pen holds editable designs; the actual clickable prototype is shared React code, available inside Pen's integrated browser and the website. Do not claim .pen frames themselves have playable native transitions.

## Delivered in this checkpoint

- `design/campus-apple.pen`: saved through Pen Save As / Save; verified 325,296 bytes, 27 root nodes (22 screen/state boards, design direction, three components, one connection map). Original native .pen layers; not hand-authored JSON.
- `/preview`: 17 navigable screens plus join/withdraw/result/new-task dialogs. One in-memory state shared across Today, Campus, Discover, Inbox and Me. The homepage uses the same component instead of the old five static tab illustrations.
- Activities: details → review → simulated submitting → confirmed / waitlisted / offline-unconfirmed → retry. Join updates participation, optional calendar and notification. Withdrawal clears saved activity calendar and adds notification. Saved bookmarks remain independent.
- Learning: task completion/undo reflected in course view; new task entry/completion; fixed example ICS preview/import with duplicate skipped and Today status. These are deliberately mock interactions, not actual file parsing or reminder delivery.
- Campus: route/place detail → source/validity explanation → bookmark → Me. Timetables explicitly illustrative, never live estimates.
- Wall: searchable activity list/empty/reset, wall/post/reply, links to campus information. No real communication is sent.
- Web connections: header Try App; learning, campus and social sections link into the matching mock tab. Public activity/backend routes remain separate.
- Motion: local 250ms content entrance, 250ms dialog entrance/150ms exit, pressed feedback, result and toast feedback. OS reduced-motion disables movement. Escape closes and returns focus. Detail back restores the previous internal scroll position.
- `transitions-dev` installed from official author's GitHub at `684ebde0c7afff62ea8037e43947caf40e31afd2` into `/Users/bennie/.codex/skills/transitions-dev`. Installation used system skill-installer via git after Python HTTPS certificate failure. No TLS verification disabled; no Pro service/account or paid package used. Skill available next turn and relevant local references read now.

## Verification performed

- Next production build passes, including dynamic `/preview`; `evidence/apple-ui/mock-build.txt`.
- Four state-invariant tests pass: join idempotence, waitlist/withdrawal, independent save vs join, reply/reset/read state. `evidence/apple-ui/mock-state-tests.txt`.
- Actual Chrome UI clicks passed: task → course state; signup → inbox → Today; withdraw → removal from Today; waitlist result; offline result → change scenario → retry confirmed; place bookmark → Me; search no results/reset; wall reply visibly added; new task completion; import → Today.
- 360px Chinese: document width/scroll width 360; device 320; inner client/scroll width 310. English also document 360 and inner 310, dialog width 322; no horizontal overflow in checked views.
- Dark and Reduce Motion: dark class active, screen and dialog computed animation `none`; Escape restores focus to review button.
- Replaced page-wide View Transition approach after rapid-action test missed next click. Local content motion avoids this input interruption. Subsequent rapid navigation + waitlist/retry test passed.
- Fixed React missing-key warning for saved rows; production rebuild passed. Existing `Access to storage is not allowed from this context` remains un-attributed in Chrome logs; do not claim clean console.
- Pen integrated browser loaded `http://127.0.0.1:14330/preview`; a real native click on Discover changed its heading/content.
- `git diff --check` passed. No production deployment, new account, real signup, external message, or school access.

## Evidence and review boundaries

- `evidence/apple-ui/interactive-mock-desktop.png`
- `evidence/apple-ui/interactive-mock-mobile-dialog.png`
- `design/exports/` contains Pen exports. Actual image inspection completed for light detail and two live browser captures; not every .pen board has received final visual acceptance. The Pen layout diagnostic reported clipping on original frames although exported detail content was visible; do not label all board geometry validated.
- Demo state lasts only within the page and resets on refresh. Scenario timings are intentionally simulated, not API latency.
- No iOS runtime, school connections, all-future-feature completeness, full animation performance, or user aesthetic approval is claimed.

## Next

Review the clickable mock with the user. Iterate on the actual interaction and visual feedback; keep editable Pen frames aligned with accepted screens. Remaining native implementation/runtime and MV01–MV12 are part of the larger active goal, not satisfied by this prototype.

## Interaction correction — tasks and contextual discussion

- Current user complaint: interaction quality is inadequate; use PUA before subsequent UI work. Read the Skill and Apple methodology; saved that project rule in root `AGENTS.md`.
- Confirmed defects: second custom task overwrote the first; course-created tasks were absent from course list; activity question link led to an unrelated wall post; opening an inbox item did not mark that item read.
- Corrected mock task identity and shared state: multiple tasks, detail, title/note editing, optional course association, completion/reopening, removal with six-second undo. Today, course and profile completion count use the same task records.
- Activity discussion now has its own replies and inbox route, separate from wall replies. Opening a notice marks only that notice read.
- Forward/back/tab motion now differ. Task sheets focus the name input; Escape closes and restores trigger focus. Existing reduced-motion rules disable new effects.
- Browser acceptance: added two course tasks; edited/completed one; checked both in Today and completion count in Me; removed/restored the task; added activity comment; opened its inbox item and confirmed the same discussion plus no unread badge. At 390px, no document horizontal overflow; task modal fields and action visible; reduced-motion computed animation is `none`; Escape restored focus to Add task.
- Validation: 7/7 mock state tests, Next production build and TypeScript pass. Evidence: `mock-ux-tests.txt`, `mock-ux-build.txt`, `mock-task-editor-mobile.png` in `docs/progress/evidence/apple-ui/`.
- Boundary: these corrections affect the isolated browser mock shared by the website/Pen browser. This checkpoint does not add native reminders or certify iOS runtime or the overall visual design. The existing browser context still logs a storage-access error; no clean-console claim.
- Next: carry the accepted interactions into native UI; native local reminders and iOS runtime acceptance remain open under the existing Goal. Xcode remains deferred by user direction.

## Navigation continuity and task drafts — follow-up

User's UI complaint remains the priority. PUA skill was read and its Apple prototype/verification workflow applied; no telemetry or persona pressure. Existing root AGENTS.md already records PUA before UI.

Confirmed in the running browser before editing: opening a task, switching to Campus and back to Today dropped the task detail. Code inspection also confirmed each Add Task reopened with empty inputs.

Changed `apps/hub/components/app-mock.tsx` and scoped `globals.css`:
- Each bottom tab preserves its own screen, navigation trail, selected task and scroll position. Explicit content actions such as “Back to Today” still open the requested root. Re-selecting the active tab returns to its root.
- Back entries carry task identity so a nested course/task journey cannot silently select a different task.
- Closing a changed task form presents Keep draft & close, Keep editing, and Discard changes in the same modal. New and edited task drafts are separate, keyed by task; saving or resetting clears relevant drafts. Drafts remain page-local, reset on refresh, and never submit data.
- Focus moves into the recovery actions, back to the input when editing resumes, and back to the opener after dismissal. Existing reduced-motion handling retained.

Actual Chrome acceptance:
1. Type task and note → keep draft → reopen → exact title restored → save → detail → Campus → Today → original detail retained.
2. Edit existing task → discard → reopen → original title restored; Back returns to Today.
3. 390×844: Escape opens recovery; Keep editing retains text and restores input focus; no horizontal overflow; dialog fits viewport.

The seven existing mock state tests pass. Production build evidence is saved alongside this note. This does not complete an overall visual redesign or prove native iOS gesture/keyboard/runtime behavior. Broader native acceptance remains open.
