# UI work in this project

- Before UI, interaction, animation or App mock work, read and apply `/Users/bennie/.agents/skills/pua/SKILL.md`, as explicitly requested by the user. Use its prototype-first and evidence-based verification methods; do not upload telemetry or broaden the task.
- Inspect the existing runnable experience first. Preserve the Apple-style direction, five main tabs, connected learning/campus/social journeys, and voluntary social participation.
- A screen count, screenshot or successful build is not interaction acceptance. Exercise the changed flow, including cross-page state, back navigation, feedback, recovery, narrow screens and reduced motion where relevant.
- Keep Pen design boards, browser mock, native implementation and actual iOS runtime evidence distinct. Do not call mock data a live integration or claim native motion is verified from a browser.
- Preserve existing changes. No subagents, deployment, external messages or global tool changes without the user's applicable authorization.

# Pen is the single source of truth for UI (user rule, 2026-10-04)

User's words: 后续所有的 UI 需要根据 Pen 的 UI 来进行设计，而不是自己拍脑门想 UI。

- Every UI change in `apps/mobile` (and the website/mock) must implement an existing Pen board in `design/campus-apple.pen`. Do not invent layouts, controls, colors, spacing, icons or copy that the board does not show.
- Before coding a screen, read its board through the Pen MCP (`execute` + `Get` with `resolveVariables`) and use the actual values: Pen color variables (`campus-*`, `ios-*`), font sizes/weights, padding, gap, corner radius, shadows, image fills and the lucide icon names (`lucide-react-native` in native).
- If a needed screen or state has no board, design it in Pen first, show it to the user, and only implement after approval. Never fill the gap with ad-hoc UI in code.
- If Pen and the PRD/API disagree (missing field, impossible state), stop and raise it; update Pen first, then code.
- Native acceptance includes a side-by-side check: the iOS simulator screenshot next to the Pen board export for the same screen and state. Functional tests alone do not complete UI work.
- Engineering/disclaimer text that is not on the board stays out of the screen; use the board's status chips or detail sheets instead.

## HARD RULE (user, 2026-10-04): every UI lives in Pen first
- No screen, state, component, interaction or motion may be implemented in `apps/mobile` (or web/mock) unless the same screen exists in `design/campus-apple.pen`. Code that adds UI without a matching board is a defect and must be reverted or designed first.
- Current visual language is **V3 Glass** (Pen boards named `V3 / …`, components `V3 / Ink button`, `V3 / Glass button`, `V3 / Glass circle`, `V3 / Avatar`, `V3 / Chip`, `V3 / Row`, `V3 / Tab bar`, variables `g-*`). Older V1/V2 boards are reference only.
- Every UI change updates Pen in the same task; every native screen cites its Pen board name in a comment.
