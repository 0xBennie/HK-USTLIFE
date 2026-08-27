---
name: hkust-campus-status
description: Use when an HKUST Clear Water Bay student needs current weather, disruption, transport, place, route, opening-hour, or campus-service information.
---

# HKUST Campus Status

Find the responsible official source first, then provide the smallest current answer that helps the student act.

1. For weather or warnings, call `hkust_get_weather`. State the observation time and never extrapolate a safety decision from a stale result.
2. For a place, shuttle, food outlet, library, housing, IT or route question, call `hkust_search_services` to identify the owner. Call `hkust_get_campus_updates` only with the matching allow-listed service ID.
3. Preserve the returned owner, URL and freshness. If a live fetch is unavailable, say it is unavailable and point to the official page—do not substitute social posts or an unverified timetable.
4. Use Path Advisor for building and route links. Do not invent walking time, crowd level, seat availability, closures, bookings or accessibility conditions.

This Skill covers Clear Water Bay only. For an emergency, tell the student to use HKUST emergency contacts or local emergency services rather than waiting for an agent response.
