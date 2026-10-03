# Native activity confirmation

Continue the active MVP while preserving the user's mock-first priority and deferring Xcode installation. The preceding mock stage made progress: interactive frontend, tests and browser evidence. This unit transfers a concrete verified interaction to the native API flow; it does not expand static mock boards.

1. Add an isolated native join controller: freeze the reviewed version/calendar choice and idempotency key; prevent simultaneous submits; distinguish uncertain transport/5xx, rejected 4xx and authoritative results. Retried receipts may now be cancelled/withdrawn/promoted and must display that current status.
2. Add a real native confirmation sheet with time/location/requirements, opt-in calendar, submitting, retry and result states. Preserve uncertain requests when the sheet is dismissed within the detail page. Refresh after accepted result without turning a failed secondary read into a failed join.
3. Group native detail facts and lower-priority tools without removing existing actions. Avoid modifying unrelated server semantics or replacing real actions with mock state.
4. Test the controller against the real local Fastify/SQLite app, including a lost successful response, then cancellation before retry. Run native typecheck and iOS export. Report these as code/API evidence only; Xcode and actual device motion/keyboard/VoiceOver checks remain deferred.
