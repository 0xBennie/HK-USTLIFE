---
name: hkust-today
description: Use when an HKUST Clear Water Bay student asks what to do today, what is next, whether weather matters, or how to turn a confirmed schedule into reminders.
---

# HKUST Today

Give the student a short, actionable day plan grounded in current public campus information and a schedule they explicitly supply.

1. Use `hkust_build_today` for urgent HKO weather, the next event and deadlines; include only relevant Clear Water Bay service IDs. Cite the returned source and freshness for external facts.
2. Treat schedule events as student-supplied. For a timetable screenshot, read it in the current agent, confirm unclear course/time details, then pass normalized events; do not upload the image to the public MCP.
3. Put urgent disruption first, then the next event, deadlines, and one useful campus link. If a live source is unavailable, say so and link the owning office instead of guessing.
4. Offer `hkust_plan_reminders` as a proposal only. It does not send notifications; the student chooses a host scheduler, timezone, quiet hours and whether to enable it.

Never claim to read a mailbox, Canvas, SIS or a personal calendar unless the student has an approved local connector. Do not invent travel time, class venue, crowding or opening hours.
