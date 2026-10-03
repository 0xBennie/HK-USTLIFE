# Apple-oriented UI redesign — 2026-10-03

User explicitly rejected the prior UI and requested Apple-style design across the product. This supersedes the green/mint visual direction, not the functional MVP scope. Implementation is authorized in the current conversation. No new product dependency or unrelated data deletion.

## Visual contract

- iPhone first: system font, 34pt bold page titles, 17pt body, 13pt secondary text; font scaling stays enabled. Neutral grouped backgrounds, readable opaque content, one blue action accent. Semantic red for destructive operations.
- Five icon-and-label tabs retained. Primary content precedes administration. Secondary actions collapse into labelled disclosure controls. Segmented controls replace vertical stacks of mutually exclusive buttons.
- Buttons ≥44pt targets, concise labels, restrained rounded corners. Shared button/card/input wrappers across every native screen; avoid a mixture of library defaults and handwritten styles.
- Light and dark semantic palettes; blur limited to navigation and disabled with Reduce Transparency. Motion: short opacity transitions, subtle pressed feedback, no looping decorative motion. Respect Reduce Motion, avoid animating long lists or remounting forms merely for transitions.
- Web uses system typography, quiet translucent header, large editorial product heading, generous white space, product UI illustration explicitly labelled as illustrative, and reusable grouped surfaces for events, help, privacy, administration and retained guide pages.
- No Apple logo, fabricated SF Symbols asset, copied Apple content, stock data presented as live, or claim that CSS blur equals Apple's native Liquid Glass.

## Implementation sequence and acceptance

1. Shared native tokens/components, navigation icons and animation accessibility provider.
2. Reorganize Today/Campus/Discover/Wall/Inbox/Account; preserve API handlers, identifiers, privacy and mutation retry semantics.
3. Replace website visual foundation and home composition; all existing web routes inherit consistent typography, controls and neutral palette. Add an explicitly labelled interactive design preview for review (not native runtime proof).
4. Verify TypeScript, iOS export, web build and existing API suite; inspect actual browser screenshots at desktop and 360px, dark mode and reduced motion. Preserve evidence.
5. Native simulator/device visual, keyboard, VoiceOver and animation acceptance remains mandatory. Current machine has CommandLineTools only and no simctl; browser preview is not a substitute.

## Official references consulted

- https://developer.apple.com/design/resources/ — official UI kits, system type and symbol resources.
- https://developer.apple.com/design/human-interface-guidelines/materials — navigation/control materials and accessibility adaptation.
- https://developer.apple.com/design/tips/ — hierarchy, legibility and minimum touch targets.
- https://developer.apple.com/design/human-interface-guidelines/accessibility — scalable text and readable interfaces.
- https://developer.apple.com/videos/play/wwdc2025/219/ — material hierarchy and reduced transparency/motion.

## Scope boundary

Existing backend and E5 in-progress website/auth work stay intact. Native implementation is React Native/Expo, not a SwiftUI rewrite. HeroUI remains an underlying primitive library; it must follow the product tokens. Full MVP still requires source maintenance, native reminders and actual iOS acceptance. No public release authorized.
