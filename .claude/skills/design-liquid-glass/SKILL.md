---
name: design-liquid-glass
description: HKUST Campus app design system (Liquid Glass). Use before any UI, interaction or motion work in apps/mobile or design/campus-apple.pen.
license: MIT
metadata:
  author: HKUST Campus (format adapted from bergside/awesome-design-skills · glassmorphism)
---

# Liquid Glass Design System Skill — HKUST Campus

## Mission
Make the app feel like a first-party iOS 26 app: content is calm and solid, a thin layer of real Liquid Glass floats above it for navigation and controls, and every touch answers with motion that means something.

## Brand
A daily companion for HKUST students: deadlines, classes, shuttles, the campus wall. Quiet, trustworthy, fast to scan. HKUST navy is the only brand colour.

## Style Foundations
- Visual style: Apple Liquid Glass (functional glass layer over solid content), misty light backdrop, one navy accent.
- Typography: SF Pro (system). Display 32/700, title 22/700, headline 17/600, body 16/400, footnote 13/500, caption 11/600. Numerals `ui-rounded`, tabular.
- Tokens (light / dark):
  - backdrop `#F2F4F7` / `#07090D`; content `#FFFFFF` / `#1C1C1E`; ink `#0B0B0C` / `#F5F5F7`; muted `#7A7A80` / `#8E8E93`
  - accent (navy) `#24467F` / `#8FB0E8`; accent-deep `#182F59`
  - status only: danger `#E5484D`, success `#2E9E5B`, warning `#D98A1C`
  - topic hues (wall only): question `#24467F`, buddy `#7A5C8E`, market `#A9824C`, share `#2E7D55`
- Radius: concentric. Screen card 28, inner element = parent − padding (28−16=12). Controls are capsules.
- Spacing: 4/8/12/16/24/32; page gutter 16.

## The two layers (most important rule)
1. **Content layer** — cards, lists, timelines, posts. Solid `content` colour, hairline separator, soft shadow. Never glass.
2. **Glass layer** — tab bar, top-bar actions, floating buttons, chips/segmented controls, bottom input bars, sheets, menus. Real `GlassView` (expo-glass-effect) on iOS 26+, `BlurView` fallback. Never put glass on glass; never put long text inside glass.

## Rules: Do
- Group adjacent glass controls in one `GlassContainer` so they merge and morph (e.g. search + compose capsule).
- Use **tinted (prominent) glass** only for the single primary action on a screen; everything else is regular glass.
- Selection inside glass = a sliding glass lens (spring, ~350ms), not a colour swap.
- Glass controls are `isInteractive` (native press shimmer) and give a light haptic.
- Glass materialises (scale 0.96→1 + fade, 200ms) when it appears; it never slides across content.
- Let content run edge to edge under bars; soften it with the scroll-edge blur.
- Tab bar shrinks to a compact capsule while scrolling down and returns on scroll up.

## Rules: Don't
- Don't make content cards translucent (that is 2015 glassmorphism, not Liquid Glass).
- Don't animate content for decoration (no fly-ins, no stagger). Content may only fade ≤150ms.
- Don't use saturated colour for decoration; colour carries status or identity.
- Don't mix metaphors: no neumorphism, no gradients on controls, no drop shadows on glass.
- Don't hard-code raw hex in screens; use theme tokens.

## Accessibility
- Text on glass ≥ 4.5:1; respect Reduce Transparency (glass → solid `content`), Reduce Motion (no lens slide, no drift), Dynamic Type up to XL without clipping.
- Hit targets ≥ 44pt; every glass control has an accessibilityLabel.

## Component anatomy (Pen `V5 / …` components)
- **Glass tab bar**: 5 items, floating capsule 64pt, inset 14; selection lens = interactive glass capsule tinted 8% accent that springs between items; compact mode 48pt shows only icons.
- **Glass action group**: capsule containing 1–3 icon buttons 44pt, separated by spacing 0 (merged).
- **Prominent button**: capsule 52pt, tinted accent glass, white label 17/600.
- **Glass chip row**: capsules 36pt; selected chip = lens with accent tint, label accent.
- **Floating input bar**: glass capsule input (min 44pt) + separate prominent circle send button, floating 8pt above keyboard/home indicator.

## QA checklist (run before calling UI done)
- [ ] Every glass element is navigation/control, never content.
- [ ] Only one prominent (tinted) action per screen.
- [ ] Adjacent glass controls are grouped and merge.
- [ ] No content animation except ≤150ms fade.
- [ ] Reduce Transparency and Reduce Motion both look correct.
- [ ] Pen board exists for the screen and the simulator screenshot matches it.
