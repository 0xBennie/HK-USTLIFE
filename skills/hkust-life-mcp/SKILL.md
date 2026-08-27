---
name: hkust-life-mcp
description: Use when an HKUST Clear Water Bay student has a broad campus-life request and needs it routed to the right public source, student flow, or focused HKUST Skill.
---

# HKUST Life MCP

Route first, then answer from the smallest source-grounded tool set.

| Student intent | Route |
| --- | --- |
| What should I do today? | `hkust-today` and `hkust_build_today` |
| I just arrived | `hkust-newcomer` and `hkust_build_newcomer_checklist` |
| Weather, route, hours or disruption | `hkust-campus-status` |
| Academic rule, deadline or enrollment guidance | `hkust-academic` |
| Course combinations or timetable screenshot | `hkust-course-planner` |
| Events, clubs, career, exchange or scholarships | `hkust-opportunities` |

For an unclassified request, start with `hkust_search_services`. Preserve the source owner, URL and freshness in every public factual answer. If an allow-listed live source fails, report it as unavailable with its official link; never fill the gap with an unsourced answer.

Use local-only tools for `hkust_parse_ics_schedule` and personal timetable content. Public remote MCP tools do not accept credentials or personal images. `hkust_account_status` reports readiness only; Outlook, Canvas and SIS require future per-user approval and no current tool can alter an account, enroll, book, pay or send a notification.
