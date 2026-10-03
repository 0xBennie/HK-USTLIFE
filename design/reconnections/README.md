# Again together design trace

PRD X04 / AC18. Supplemental states in isolated campus-apple.pen:
- D3Jdk: explicit private participation/interest choice.
- PSjRA: own saved intent without revealing the other person's choice.
- oKBe2: mutual consent; messaging is explicitly unavailable.

All three exported PNGs were rendered and inspected, structural traversal returned no clipping, and native Save persisted this document. This is not native-runtime or animation evidence. Error, expired, withdrawal, confirmation and accessibility variants still need full design/runtime review.

Native: ActivityDetail → existing visible organizer/comment author → ReconnectionScreen → ReconnectionController → real authenticated reconnection routes. No new public roster. A comment author can be ineligible; server returns a neutral unavailable response. No release of contact details, chat, automatic group or signup. Native actual interaction acceptance remains pending.

## Voluntary contact cards (2026-10-04)

- `Y1V0gg`: recipient and content preview before explicit share.
- `Ee7DV`: shared card; editing/clearing remains voluntary.
- `whbTA`: unknown write, read-only recovery, draft retained.
- Implementation: `apps/mobile/src/social/ContactCardScreen.tsx`, `contact-card-controller.ts`; entry from `ReconnectionScreen.tsx` after mutual consent.
- API: GET/PUT `/activities/:id/reconnections/:target/contact-card`; backend validates current consent on every write/read.
- Native interactions: preview Alert, clear by empty input and confirmation, refresh without draft loss, explicit saved-content replacement, protected Back, background/tab hiding. Existing Button component honors reduced motion. No extra animation added to sensitive text.
- Three exported boards visually checked and canvas saved. These are design states, not an iOS runtime recording. Keyboard, font scaling, VoiceOver and actual motion require native acceptance.
