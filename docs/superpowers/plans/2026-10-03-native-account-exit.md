# Native account exit and retained input

Observed: bottom-tab forms remain mounted, but ProfileScreen directly signs out/deletes without consulting their guards. Profile name/language changes are not registered. useAction relies on asynchronous React busy state and can run twice before render; StudyForm can invoke onSaved after account-driven unmount.

- Aggregate existing per-scene protections across all retained tabs.
- Centralize account exit proposal/commit: block busy work; confirm draft/uncertain disposal; preserve mandatory delete confirmation; recheck identity and protection before executing an old dialog; serialize requests.
- Register profile dirty/busy state against latest saved profile, protect navigation into governance, freeze fields during operations. Make action helper synchronous and ignore completion after unmount.
- Stop StudyForm callbacks/error publication after unmount; no change to saved-write persistence.
- Verify protection changes, delayed dialog, duplicate operations and actual Session/backend logout behavior in tests; native typecheck/export. No actual native alert/touch/accessibility claim without runtime.
