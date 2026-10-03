# School planning design trace

Saved in the isolated `design/campus-apple.pen`; no shared main design was saved.

| Node | State | Export |
|---|---|---|
| f0DrVG | Current school assignment, source facts and private checkbox | f0DrVG.png |
| O2ngP | Partial refresh, retained snapshot and suspended reminder calculation | O2ngP.png |
| apf7H | Personally completed; not Canvas submitted | apf7H.png |

PRD A03/L01/L02/D03, AC14. Implementation: StudyScreen.tsx → calendar API → school/projection.ts; personal checkbox → PATCH /school/records/:id/personal. Reminder targets open Today/date.

These are static interaction-state design examples with explicitly fictional data, not an interactive Pen prototype or iOS screenshots. New-root structural traversal returned no clipping problems; normal/completed rendered screenshots were reviewed, partial state reviewed during creation. Native gestures, VoiceOver, dynamic type, reduced motion and device notifications remain unverified. Browser presentation manifest is not extended by these three supplemental states.

Older g6IET/g8DPsq/jMZip PNGs are superseded scratch exports from the earlier unsaved design attempt; do not use them as current node references.

## Connection management addition

X3COR: school approval/connection state; gXcxl: private notes/reminder settings; VIlQ7: revoke/cache choice. Saved in the same isolated Pen file and exported as PNG. These supplement the initial three states. SchoolSourcesScreen.tsx implements corresponding authenticated record pagination, editor and native confirmation. Structural traversal reported no clipping; X3COR rendered review passed. Error/loading/confirmation logic exists in code but exhaustive Pen variants and actual runtime review remain pending.
