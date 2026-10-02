# E2 ICS parser boundary — 2026-10-03

## Implemented and verified

`src/product/calendar/ics.ts` exposes:

- `parseCalendar(content, floatingTimezone?)`: selected file → serializable source series plus explicit per-series issues. Retains master/exception definitions and timezone components, UID or visibly marked fingerprint identity. Does not upload/fetch source URLs.
- `expandSeries(series,{from,to})`: bounded recurrence candidates with stable original recurrence ID, actual moved start/end, source timezone/status and unknown participation. Full rules remain available for future date windows instead of permanently materializing one semester.

Fourteen tests in `tests/product-ics.test.ts` cover weekly COUNT and multiple weekdays, EXDATE, single moved/cancelled exception, future-window expansion, all-day exclusive ends, DURATION, unknown end, floating timezone confirmation, IANA DST, embedded custom timezone isolation, unsupported rules, invalid calendar date, duplicate UID/orphan exception, fingerprint identity, malformed/oversized input, bounded traversal, impossible local DST times, precision mismatch, unsafe timezone definitions, tentative source status and ambiguous local time handling.

Full repository verification: **27 files / 106 tests passed**; backend TypeScript and mobile TypeScript passed. No iOS bundler rerun was necessary because this unit changes only server parser/dependency/tests/docs; the previous 1558-module native bundle remains the last bundle evidence, not a fresh runtime check. No simulator/device execution claimed.

Regression cycle: gap-time and unsafe timezone tests first failed, then passed after explicit validation. Tentative source status first disappeared, then was retained separately from actual participation. Import status never establishes event admission or school enrolment.

## Exact supported envelope and limits

- VCALENDAR at most 256 KiB / 500 VEVENT components.
- DAILY/WEEKLY with COUNT/UNTIL/INTERVAL, plain weekday BYDAY and WKST. Other recurrence combinations are explicit issues. RDATE, EXRULE and RANGE exceptions currently unsupported, not silently ignored.
- Display query 1–42 days; at most 10,000 recurrence steps and 2,000 output candidates. Old unbounded sources may require review rather than being silently truncated.
- Timed candidates include a one-day UTC buffer around query dates for downstream timezone-aware day grouping. The **caller must filter by the actual display timezone/range** before presenting calendar results. All-day dates use exact calendar-date overlap.
- Missing end remains null. All-day missing end is also left unknown rather than claiming a source-provided end.
- IANA without VTIMEZONE uses Intl offsets. Ambiguous local time chooses the first occurrence; nonexistent local time produces an explicit review error. Embedded VTIMEZONE remains scoped to its own component tree, never globally registered.
- Custom timezones: at most 32 definitions / 16 observances each; bounded YEARLY observance rule subset. Unsupported/unsafe definitions reject the file explicitly. Alarms/attendees/attachments are not executed/fetched.

## Dependency evidence

Exact npm dependency `ical.js@2.2.1`, MPL-2.0; no runtime dependencies declared. Registry metadata and package source/types inspected. Official references: [Event](https://kewisch.github.io/ical.js/api/ICAL.Event.html), [RecurExpansion](https://kewisch.github.io/ical.js/api/ICAL.RecurExpansion.html). Library code not modified. Preserve upstream license when distributing server dependencies.

Endor `package-risk` signal UNKNOWN: current tool inventory exposes no Endor endpoint and `endorctl` is absent. This is a missing signal, not approval or proof of unsafe code. npm audit reported no `ical.js` finding and the same 18 other findings (12 moderate/4 high/2 critical). Existing dependency risks from E1 remain; no global configuration or tool install performed. Installation used the authorized local dependency workflow with lifecycle scripts disabled.

## Required next integration (not delivered yet)

No preview/confirm HTTP endpoint or native file-picker entry is exposed in this unit. The parser is not the finished import feature.

Next: persist owner-bound preview/source series with source+UID identity, expiration, atomic idempotent confirmation, changed-field/version conflict handling and partial-import preservation. Merge expanded candidates into `/me/calendar` using its existing local-day semantics; keep per-occurrence local edits separate. Then native file selection/preview/selection/confirmation and tests for reimport, source update vs local edit, deletion, export and two-account isolation.

Before integration sign-off, add characterization for UTC UNTIL versus resolved floating UNTIL, exception recurrence membership and EXDATE-vs-exception precedence; current tests do not prove those cases. Capture explicit limitations, do not infer blanket RFC compliance. No full MVP MV gate or Goal completion claimed.
