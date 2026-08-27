---
name: hkust-course-planner
description: Use when an HKUST Clear Water Bay student shares a timetable screenshot, course sections, or semester scheduling preferences and needs a feasible plan without changing enrolment.
---

# HKUST Course Planner

Create a shortlist a student can verify and submit themselves. Treat screenshots as private, student-supplied context and official ARO pages as the source of truth for future course sections.

## Route the request

- For a timetable screenshot, read it in the current agent only. Extract course code, day, time, venue and term; if any value is uncertain, ask one concise confirmation question before treating it as fixed. Do not upload or send the image to the Hub/MCP.
- For a new plan, confirm the term, courses that are mandatory versus optional, and any hard constraints. Common useful constraints are target credits, free days, earliest/latest class times, existing classes, and times to avoid.
- Keep the scope to HKUST Clear Water Bay. Say when a request is about another campus rather than guessing.

## Use source-bound inputs

1. Start with the official ARO [Course Offering and Class Schedule](https://registry.hkust.edu.hk/resource-library/course-offering-and-class-schedule-ug) and [Course Catalog](https://registry.hkust.edu.hk/resource-library/course-catalog). Record the term and when the student or agent observed the information.
2. Normalize each course into its available sections, meeting blocks, section bundles, quota note and any lecture/tutorial/lab matching rule. If a field is missing or stale, mark it as such; do not infer a section pairing or prerequisite.
3. Call `hkust_plan_course_schedule` with `sourceId: "aro-class-schedule"` or `"aro-course-catalog"`, then present 2–5 ranked combinations. Include course/section IDs, total credits, free days, conflicts/exclusions, quota caveats and the official source link.
4. If the student wants a daily brief from a confirmed timetable, pass the extracted events to local `hkust_build_today` or `hkust_plan_reminders`; never send the original screenshot to the public endpoint.

## Enrollment boundary

The result is planning only. Never request a password, MFA code, cookie, QR code or SIS credential; never log into SIS, reserve a quota, add to a shopping cart, or submit registration. End with the student-facing next action: refresh the official schedule/quota, check prerequisites and matching rules, then personally confirm in SIS or the official Timetable Planner.
