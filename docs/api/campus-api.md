# Campus API — implemented local MVP subset

Public visitor access (no bearer required), local-development server restrictions still apply. Campus native screen currently offers school shuttle schedules only. KMB/GMB prediction adapters, place/service directory, bookmarks/corrections and admin updates remain pending E3/E5.

- GET `/api/v1/transport/routes`: reviewed school-shuttle catalog, version, provenance, review deadline, holiday provenance/coverage and explicit missing live/disruption status.
- GET `/api/v1/transport/routes/:id/departures?at=<offset ISO instant>`: `at` defaults to server now; interpreted in Asia/Hong_Kong. Returns route, service_date, kind=planned, status, upcoming, published regular timetable, holiday, provenance and query/generated timestamps. Not real-time vehicle telemetry.

States: scheduled, finished_for_day, public_holiday (including Sunday), non_operating_day, outside_service_period, holiday_coverage_unknown, stale. Stale and unavailable service states return no upcoming departures. Regular timetable stays visible as reference, explicitly subject to operating dates. Exact scheduled second is included; after it, that departure is past. No invented arrival times or seats.

Reviewed snapshot: CSO 2026-09-01 through 2026-12-18, weekday/non-holiday services. 24 direction/boarding entries: Diamond Hill and Tseung Kwan O both ways; Hang Hau, Kowloon Tong, Mong Kok, Tsuen Wan, Tsing Yi, Tuen Mun and Yuen Long both ways; Causeway Bay via North Point morning, North Point morning boarding, campus via North Point to Causeway Bay afternoon; three lunch boarding directions. North Point morning is the same Causeway Bay vehicle, not another trip. Lunch fare not stated, kept null. Campus boarding-map links remain on the official page, not independently geocoded navigation.

Provenance captured in `docs/progress/evidence/e3/`: full CSO page/1823 holiday response with URL, retrieved_at and SHA-256. Facts transcribed in `src/product/campus/shuttle-data.ts`; legacy specification-only three-route fixture is not used. Holiday JSON covers 2025–2027; Sundays handled independently. School requires approved identification; application login does not establish boarding eligibility.

Snapshot review deadline is seven days after retrieval (product freshness policy, not an official school validity guarantee). Source publication changes are not auto-adopted, and weather warnings do not imply cancellation. Official temporary-disruption monitoring and refresh/admin workflow still pending. Native screen refreshes on entry, foreground and each foreground minute; request failure hides departure details and permits retry. It does not keep a fake ETA countdown.

Source: https://cso.hkust.edu.hk/index.php/tran/stud_sh_b
Holiday source: https://www.1823.gov.hk/common/ical/en.json

## Directory, bookmarks and corrections (implemented)

- GET `/api/v1/campus/places?q=&category=study|shop|service`: public bilingual name/location/description search, optional category. Reviewed seed coverage is nine entries: postal counter, EF Locker, Fusion, 7-Eleven LG5/iVillage, photo booth, coin kiosk, Information Commons and Learning Commons.
- GET `/api/v1/campus/places/:id`: public detail with location, description, published-hours text, source/retrieval/hash, review deadline, version, official map/action URLs where verified. `open_now` and `availability` remain `unknown`. Thirty-day review period is an app policy; past it, `freshness=stale`. Published schedules are not current operating status.
- GET `/api/v1/me/campus/bookmarks`: owner's `{target_kind,target_id,created_at}[]`.
- PUT / DELETE `/api/v1/me/campus/bookmarks`: `{target_kind:place|shuttle,target_id}`. Save/remove idempotently; new saves require a known reviewed target. No owner ID accepted in body.
- POST `/api/v1/campus/corrections`: authenticated `{target_kind,target_id,message}` (5–2,000 characters) with Idempotency-Key (8–128 safe identifier characters). Returns private pending record; same owner/key/content retries return it, changed content 409. Maximum 20 new requests per rolling day. Does not change directory, send external email or represent official acknowledgment.
- GET `/api/v1/me/campus/corrections`: owner's requests/status/resolution. Admin review/update implementation belongs to E5; requests remain pending until reviewed.
- GET `/api/v1/me/export`: additive `campus:{bookmarks,corrections}`. Account deletion cascades these private rows; public directory remains.

Migration 5 stores directory entries, private bookmarks and corrections. Reviewed seed inserts missing IDs only and does not overwrite persisted maintenance edits on restart. Source evidence: `docs/progress/evidence/e3/directory/` with seven retrieved official pages and hashes; reviewed factual entries in `directory-data.ts`. Native DirectoryScreen supports search/category, detail/source/map links and saved-only view. TargetActions supports both places and school-shuttle routes, retry-safe corrections and own request history. Parent native campus screen remounts on account changes to clear private state. Actual iOS runtime acceptance pending.
