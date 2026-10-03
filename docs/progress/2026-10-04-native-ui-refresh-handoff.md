# Native UI refresh — batch 1 (Pen → Expo)

Branch `claude/native-ui-refresh` (worktree `/Users/bennie/HKUST/.worktrees/hkust-native-ui`), based on Codex `6709d5f`. Uncommitted.
Rule added to `AGENTS.md`: Pen (`design/campus-apple.pen`) is the single UI source; no ad-hoc UI.

## Done (values read from Pen via MCP, resolved variables)
- `src/theme.ts`: palette = Pen `campus-*`/`ios-*` variables (light/dark); page padding 16, gap 18.
- `src/ui/Pen.tsx`: native counterparts of Pen components — lucide icons (`lucide-react-native@1.51.0`, same names as Pen), LargeTitle, CircleButton, Segmented, FilterPill/PillRow, Tag, ListGroup/ListRow (icon tiles), AvatarDots/InitialAvatar, PrimaryButton, BottomBar, FloatingTabBar.
- App shell: dev header removed; floating glass tab bar (Pen `C2KuRh`); content under the status bar with scroll-aware status material; language switch moved to 我的 → 外观与语言 (Pen `B7wsR`).
- `SceneOverlay`: pushed pages show the Pen bottom bar instead of the tab bar.
- Discover (Pen `MjoHv`, empty state `M2UXBG`) and Activity details (Pen `lAQTw`, confirmed bar per `zrHOJ`). Covers are the Unsplash photos already on the Pen boards, mapped by interaction style (`src/social/covers.ts`, `apps/mobile/assets/covers/`).
- Write/retry/idempotency/guard logic unchanged; only presentation changed.
- Fixed: primary labels on accent are white in dark mode (old navy label became unreadable with Pen accent).

## Verified on iPhone 18 Pro simulator (iOS 27, dev client, isolated API :4338 / Metro :8098)
Discover list light/dark, scrolled status material, open detail, back, confirmed-participant bar, calendar save (server persisted: reminder section appeared), join sheet opens with correct calendar state. Evidence: `docs/progress/evidence/native-ui-refresh/` (incl. `pen-vs-native.jpg`).
Mobile `tsc --noEmit`: no errors in app files; the 10 errors in `src/product/**` (node types) also exist on 6709d5f, so the handoff claim "Mobile TypeScript passed" does not hold for that command.
Not exercised: bookmark button via UI (Expo dev-menu gear overlaps it; same `prefs()` path as the calendar button), comment posting, organizer manage rows, VoiceOver, large text, reduced motion.

## Gaps / next batch (all have Pen boards)
1. Join review sheet `oiYrF`, result pages `zrHOJ`/`v69Dn`/`qOuXf`, reminder picker, filter panel (no board yet — needs Pen design first), report/block flow.
2. Back should restore list scroll position (Pen motion rule); currently `onNavigate` scrolls to top.
3. Today `vkMwi`, Campus `DBOQz`, Inbox `t1Arsk`, Me `B7wsR`, wall, forms.
4. Tab switch re-render feels ~1s in dev build; re-check in a release build.
5. Demo data: isolated DB `.local/claude-ui` has 4 realistic activities from `.local/seed-demo.mjs`; Codex test titles remain in the shared acceptance DB.

Runtime handles (this session): API bg job on 4338, Metro on 8098 (IPv6) + IPv4 bridge on 127.0.0.1:8098. Revalidate before reuse.
