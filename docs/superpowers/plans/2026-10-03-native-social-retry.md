# Native social write recovery

Previous unit made verified progress on shuttle maintenance. Audit MV06/MV09 against native UI and real server receipts: social create/comment/reply/join receipts expire after24h, but native social forms/details/join retain keys without an age guard. This can replay a creation as new after an uncertain response. Study saves already stop at23h; apply the same bounded policy to social writes.

Create a shared immutable write receipt with23h cutoff and explicit review-required error. Preserve uncertain payloads/keys and distinguish definitive rejection. Wire activity/post forms, comments/replies/detail operations and join confirmation; prevent double tap and post-unmount callbacks. After cutoff, forms/direct actions offer return-to-list review, while join offers a read-only current participation lookup, never automatic rejoin. Fix misleading generic network copy and retain existing input/navigation protection.

Validation: real Fastify/SQLite tests for committed-but-lost social writes, server restart/retry, cutoff preventing duplicate creation after expiry, cancellation/withdrawal before join recovery, invalid response and failed read-only recovery. Run existing regression, native typecheck/export. No runtime iOS/keyboard/VoiceOver claims; Xcode remains deferred. Record remaining runtime evidence separately.

## Completed code/controller checkpoint

Implemented shared receipt rules in social forms, comments/replies/detail actions and join. Expired join recovers with GET only; successful write followed by failed readback is distinguished.235tests/45files, nativeTypeScript and iOS1672-module export passed. Evidence: `docs/progress/evidence/native-social-retry/`. Runtime UI, keyboard/large-type and accessibility remain unverified; overall Goal remains active.
