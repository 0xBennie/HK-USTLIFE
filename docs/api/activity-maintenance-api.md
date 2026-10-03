# Activity maintenance API (local development)

Base: `/api/v1`. Every endpoint requires a current, non-banned administrator bearer session. Ordinary organizer endpoints retain their ownership restrictions; admin maintenance is a separate capability. Browser access uses the existing fixed `/api/campus` gateway, HttpOnly session cookie, same-origin/Host checks and CSRF for POST. No email, push service or school integration is invoked.

| Method | Path | Result |
| --- | --- | --- |
| GET | `/admin/activities?q=&status=all&limit=20&cursor=<uuid>` | `{items,next_cursor}`; title/location substring, status all/open/closed/cancelled, limit1–30, UUID ascending cursor |
| GET | `/admin/activities/:id` | Current activity plus `moderation_state`, `organizer_restricted`; `mine:null` |
| GET | `/admin/activities/:id/history` | Newest50 metadata audit rows |
| POST | `/admin/activities/:id/maintain` | Versioned change; returns current admin activity |

These reads include members-only and moderated content under explicit admin authority. They never return participant rosters or account emails. Browser routes do not proxy arbitrary API paths. Unknown query parameters on list are rejected. Detail/history do not support browser query parameters.

Edit request:

```json
{
  "version": 1,
  "action": "edit",
  "reason": "Reviewed the revised meeting location",
  "changes": {"location":"Library · Room B","status":"closed"}
}
```

Cancellation request:

```json
{"version":2,"action":"cancel","reason":"Organizer confirmed cancellation"}
```

`reason` is trimmed,5–1000 characters, administrator-only. `version` is the current positive version. `changes` is a nonempty partial set of activity fields: title, description, location, starts_at, ends_at, timezone, capacity, languages, interaction, cost_minor, requirements, status(open/closed). Kind, visibility, organizer and IDs cannot be rewritten. Same activity schema and constraints as organizer edits: future start, ordered times and duration≤7days, capacity1–50 and at least confirmed participants, supported language/interaction, bounded lengths and cost. The web editor uses Hong Kong time explicitly; API timestamps require timezone offsets. No delete or restoration endpoint.

Changes to hidden/restricted/cancelled records return409; started activities cannot be edited. Closing blocks new joins while retaining existing participants and saved calendars; existing waitlist promotion rules remain unchanged. Cancellation is terminal, including when repeated with a new version. Reusing an old version returns409; this is optimistic concurrency, not a reusable POST receipt.

Successful edits increment version, broadcast an in-app update to the existing participant/saved-calendar audience and notify a different organizer. Shared domain logic handles increased capacity/FIFO promotion and current calendar/reminder projections. Cancellation marks confirmed and waiting participation cancelled, clears calendar_saved/remind_minutes, and sends cancellation notices. The backend projection is updated immediately; already-scheduled device notifications are reconciled when the App synchronizes, not remotely deleted from an offline device.

Migration10 creates `activity_maintenance_audit`. An edit/cancel, participant changes, notices and audit insertion run in one SQLite transaction. Audit contains actor/activity IDs, action, reason, changed field names, before/after versions and timestamp, **not activity content snapshots**. Deletion nulls referenced IDs via foreign keys; audit metadata and operator-entered reason remain. Do not put private student details into reasons. This unit does not add audit retention/deletion controls.

Errors:400invalid input,401missing/expired session,403role denied,404missing activity,409version/capacity/state conflict,500transaction failure. Gateway additionally enforces403Origin/CSRF,32KBrequest limit and bounded upstream timeout. Clients must retain a draft on unknown results, read current state, explicitly review it and only then start a new versioned decision. Never convert an unknown cancellation response into success or silently retry with a newly fetched version.

Web behavior: searchable catalog → current detail → changed-field review → save; cancel impact disclosure; metadata history; memory drafts retained across admin sections. Conflicts/unknown responses freeze resubmission and offer GET-only current-state review without overwriting the draft. Explicit discard uses a modal with Keep editing default and Escape/focus return. Narrow-screen selection moves focus to detail. Browser refresh, login expiry/account change and development HMR can clear memory drafts; no durable draft storage is claimed. Reconnect/logout in the parent console still require broader input protection.

Verification: `tests/product-activity-maintenance.test.ts` plus gateway test in `tests/product-web.test.ts`;241tests/46files passed. Core/Next production build and final web TypeScript pass. Real local Chrome fixture edit, section retention, change review/back, discard-Escape, stale version conflict/current-state recovery, cancel and participant calendar/message/reminder readback. Evidence: `docs/progress/evidence/admin-activities/`. This proves web/domain behavior, not native iOS runtime or device notification delivery.
