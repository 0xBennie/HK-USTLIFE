# Campus maintenance acceptance — 2026-10-03

Local only: Next http://127.0.0.1:14330, API http://127.0.0.1:14328. Existing `.local/e5-web-demo` preserved; pre-change SQLite backup in `.local/backups/e5-before-maintenance.sqlite`. No external email or publication.

- Administrator captured the catalog's official postal source at 2026-10-02T22:23:01.391Z. Reviewed the CSO page and saved bilingual location wording at 22:23:27.265Z; version 1 → 2. Published hours unchanged, live opening/availability remain unknown.
- Resolved synthetic [DEMO] correction at 22:23:40.866Z with source and explanation, version 1 → 2. UI showed saved decision and both audit actions.
- Separate submitter session read its own resolution; public place readback confirmed version and wording. Sanitized evidence: `browser-readback.json`. No credentials stored in this evidence folder.
- At 390×844, editing postal reason then choosing EF Locker opens an HTML dialog focused on Keep editing. Cancel retained exact reason `未保存输入保护验收，不提交`; a second attempt followed by Discard selected EF Locker, cleared the draft and focused its heading. No horizontal overflow. This input was never submitted.
- `discard-mobile.png` shows the protected-switch dialog. `resolved-mobile.png` captures the resolved record vicinity/history control. Temporary viewport override reset after testing.
- Initial implementation used window.confirm; browser click and dialog tooling timed out. Canceled that native dialog through Chrome UI, replaced it with page dialog, and reran the scenario successfully. No claim that the initial attempt passed.
- Guard scope: record selection, correction filter and refresh. Parent admin navigation/reconnect/unmount is not covered by this guard; full navigation protection remains open.
- `targeted-tests.txt`: 11 targeted tests passed. `regression.txt`: 222 tests / 43 files passed. `web-build.txt`: latest Next production build passed, including dialog change. Tests use deterministic source fixtures; browser capture used the actual official source.

Not covered: native iOS visual/runtime behavior, school identity, timetable/holiday editing, source interpretation automation, public release. Existing dependency release findings remain open.
