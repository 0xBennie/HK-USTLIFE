# Apple UI redesign checkpoint — 2026-10-03

## User direction

User rejected the earlier UI and requested Apple-style design across all surfaces, then authorized installing missing Xcode and asked to use Pencil. Current source changes are an interim implementation for review, not user-approved visual acceptance. Do not declare the full design or iOS app finished.

## Implemented in this checkpoint

- Shared native semantic light/dark tokens; system typography; reusable HeroUI-backed button/card/input wrappers applied across the native screens.
- Five original vector navigation glyphs, icon+label tabs, Today as initial tab, compact header; 180ms content opacity feedback and accessibility-aware pressed feedback. Reduce Motion and Reduce Transparency listeners default conservatively until system state is loaded.
- Today controls and item management moved to disclosure sections; day/week/course views use segmented control. Campus navigation rows, Discover/wall segmented controls, shorter primary headings and separated inbox count. Backend behavior preserved.
- Website home rebuilt, neutral typography/control system propagated to events, admin/help/privacy and retained guide pages. Browser illustration exposes five tabs and light/dark appearances. Illustrative data and non-native-runtime status visibly labelled.
- Original shared SVG paths: `src/design/icons.ts`. Not SF Symbols assets or Apple branding. App code remains React Native/Expo, not SwiftUI.

## Verified

- Native TypeScript passed.
- iOS export passed: 1,602 modules; bundle export is compile evidence only.
- Next production build passed.
- Full suite: 36 files / 182 tests passed (including seven new E5 public share/admin BFF tests).
- Browser: all five preview tabs change content, light/dark switch works; DOM width equals scroll width at 360px English and 1440px desktop; admin 360px also no horizontal overflow. Reduced-motion emulation reports animation `none`; dark page body is black.
- Screenshots in `docs/progress/evidence/apple-ui/`; image inspection of final desktop home completed. Stored `home-desktop.jpg` is 1440px (an earlier 360px capture was corrected after measured viewport mismatch).
- Browser console contains `Access to storage is not allowed from this context` without useful stack; reproduced on reload, attribution unresolved. Do not claim console-error-free. No application localStorage use was introduced by this redesign.
- Git diff whitespace check passed. E5 and UI work remain uncommitted together; do not discard the owned working tree.

## Xcode installation attempt (explicitly authorized)

- Host macOS 26.3, about 1.2 TiB available. CommandLineTools only; `simctl` unavailable.
- Apple App Store official Xcode page requires macOS 26.6. Get was attempted and App Store explicitly refused for OS incompatibility; no Xcode installed.
- Apple official compatibility table lists Xcode 26.6 compatible with macOS 26.2–26.x. Use compatible full Xcode, not a global OS upgrade without user request.
- Developer download entry redirected to Apple ID login; browser twice showed ERR_TUNNEL_CONNECTION_FAILED. No password requested, no license accepted, no simulator installed.

## Pen — superseding the earlier installation blocker

Official Pen 1.2.15 is installed at `/Applications/Pen.app`; local desktop MCP works. Editable source is saved at `design/campus-apple.pen`. Its integrated browser opens the actual interactive `/preview`, verified with a Discover click. The CLI login limitation does not block desktop design work.

User now prioritizes connected App mocks and defers Xcode. Current implementation and evidence are in `2026-10-03-interactive-mock.md`. Neither editable frames nor browser interactions complete native runtime acceptance.

## Next

Iterate on the clickable mock, keep the Pen source aligned, and address user feedback before expanding static boards. Larger MVP runtime/reminder/governance acceptance remains outstanding.
