# Shuttle maintenance evidence — 2026-10-03

Authoritative local browser: `http://127.0.0.1:14330/admin?lang=zh`; API14328, `.local/e5-web-demo`. SQLite backup before migration/edit: `.local/backups/e5-before-shuttle-maintenance.sqlite`. Existing API process66299 was confirmed live, stopped gracefully and replaced by82662 (exec13384) to load new backend. No database reset, real email or deployment.

## Real browser flow

1. Selected Hang Hau → HKUST, captured actual official CSO page, changed boarding wording to `Ming Shing Street (next to East Point City)` while retaining published times/eligibility/fare/dates. Source inspected at https://cso.hkust.edu.hk/index.php/tran/stud_sh_b (Student Only section).
2. Preview at2026-10-05 08:33 Hong Kong returned08:35/08:40; explicit source review, reason and save produced revision2. Public API independently read matching origin, per-route source and upcoming values.
3. Compared51 existing holiday dates/names across2025–2027 against current official1823JSON, no missing/extra entries. Captured actual holiday evidence, retained complete verified calendar and saved revision3. Read audit action edit_shuttle_holidays.
4. Entered a temporary reason, switched to Content reports and back: exact input retained. Reload opened HTML discard dialog; Keep editing retained draft. Discard and reload restored persisted data.
5. Duplicate departure08:30/08:30 rejected by preview with400; input retained and Save disabled. Reload discard restored canonical times.
6.390×844 screenshot `mobile.png`; no horizontal overflow. Temporary viewport reset. Page is admin UI, not iOS runtime proof.

## Findings corrected

- Initial date fill changed DOM input but did not synchronize React state; old preview date persisted. Added onInput alongside onChange for date/datetime controls. Retest confirmed controlled value and preview both2026-10-05, with correct upcoming. No claim initial date behavior passed.
- Initial two time-advance tests reached session expiry before source-expiry assertions. Test fixture now signs in again at advanced time; production authentication was not weakened. `initial-test-failure.txt` preserved. Final228/228 pass.
- Readback utility initially failed to JSON.parse raw1823 evidence because its UTF-8 content has a BOM. Reader strips leading BOM for comparison; stored source bytes/hash remain unchanged. Public response and audit assertions then passed.

## Results and limits

`live-readback.json`: revisionmaintenance-3,24routes,51holidays; exact saved raw holiday source comparison, workday/public holiday/last departure/service period assertions, other route deadline unchanged, two audit records. `holiday-source-comparison.json`:51official/51seed, no differences. `regression.txt`:228tests/44files. `web-build.txt`:production Next build. `native-typecheck.txt`:passed. `ios-export.txt`:1671modules exported.

Source size/failure restrictions reuse the previously tested maintenance capture service. Timetable validity/independent expiry tests use deterministic fixtures; browser writes use current official evidence. No native simulator/device execution, school-private integration, public deployment, automatic source interpretation or temporary suspension workflow has been accepted.
