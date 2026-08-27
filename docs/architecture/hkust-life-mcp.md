# HKUST Life MCP — Product and Safety Specification

**Scope:** HKUST Clear Water Bay main campus only. HKUST(GZ) is excluded.

## Goal

Give a new HKUST student one reliable, agent-readable entry point for daily campus life. The server must combine official public information with the student's explicitly connected account data, while keeping the source, freshness, and access boundary visible in every answer.

## Product boundary

This is an MCP server, not a replacement for SIS, Canvas, FBS, housing, the Library, or USThing. It helps a student discover official information, make a daily plan, and receive read-only personal signals after consent. It deep-links to the owning service for actions.

The initial release supports the Model Context Protocol over stdio. Codex, ChatGPT-compatible MCP clients, Claude Code, and other MCP clients can invoke the same tools. OpenClaw is optional and is not a dependency.

## Capabilities in the first release

1. `hkust_search_services`: find the responsible office, official link, contact and data freshness policy for campus needs.
2. `hkust_get_daily_brief`: return a source-attributed morning brief with Hong Kong Observatory weather/warnings, an ordered list of user-supplied schedule items, and relevant official campus links.
3. `hkust_get_weather`: retrieve live Hong Kong Observatory weather data without user credentials.
4. `hkust_get_campus_updates`: retrieve public updates from a deliberately allow-listed HKUST source; it never searches or scrapes arbitrary campus systems.
5. `hkust_plan_reminders`: turn classes, deadlines, and events into deduplicated, timezone-aware reminder proposals. It proposes; it does not send notifications or alter a calendar.
6. `hkust_account_status`: say exactly what private connectors are configured, their read-only scopes, and what approval is still needed.
7. `hkust_get_outlook_signals`: after the user has connected Microsoft Graph, retrieve only the minimal e-mail headers and calendar fields needed for a personal brief.

## Source of truth and public ingestion rules

The source registry is shipped with the server and is the allow-list. Each item includes an owner, scope, URL, update cadence, and whether it is fetched live. The owning HKUST office wins when sources conflict.

| Need | Owner/source | Initial MCP treatment |
| --- | --- | --- |
| Academic calendar, registration, class administration | ARO / Registry | official links and source record |
| Campus bus, food, shops, mail, outages | CSO | official links and future live update adapter |
| Maps and classroom navigation | Path Advisor | official deep link |
| Halls and housing | SHRLO | official links and source record |
| Library spaces and hours | HKUST Library | official link, future live adapter |
| Sports, counselling, clubs, special needs | DSTO | official links and source record |
| Clinic and urgent contacts | HSEO | official links and source record |
| Events | University Calendar / ERMS | official link, future live adapter |
| IT, Wi-Fi, SSO and accounts | ITSO | official links and source record |
| Weather warnings and forecast | Hong Kong Observatory | live public JSON adapter |

Public fetches use only declared URLs, a timeout, a descriptive User-Agent, and return provenance (`sourceUrl`, `fetchedAt`, `owner`). No raw page cache or campus-wide personal data store is created in this release.

## Private account boundary

No tool accepts a password, MFA code, e-identity QR code, or cookie. No student credentials are scraped or replayed. Connector access is read-only and user-revocable.

| System | Initial permission | Data used | Status gate |
| --- | --- | --- | --- |
| Outlook / Microsoft 365 | Graph delegated `Mail.ReadBasic`, `Calendars.ReadBasic` | e-mail headers and basic calendar fields | HKUST Entra application registration / tenant consent |
| Canvas | read-only course, calendar, assignment scopes | assignments and class calendar | Canvas root-account Developer Key + HKUST approval |
| SIS | no assumed API | enrolled classes / exam schedule only if formally approved | ARO + ITSO protected API agreement |
| FBS, housing booking, library booking | no automated action | deep link only | owning office API and explicit approval |

Development may supply a short-lived Graph access token through an environment variable. Production tokens belong in an operating-system secret store or an approved connector service, are never logged, and are never returned by MCP. No private data is cached beyond the active request in the first release.

## Reminder model

The MCP server is intentionally stateless for notifications. `hkust_plan_reminders` produces a normalized plan which a client-owned scheduler can deliver. Defaults: course start minus 45 minutes, deadline minus 24 hours and 2 hours; each event has a stable id, a maximum of one reminder per trigger, and `Asia/Hong_Kong` timezone. Later adapters can run this plan in a desktop agent or approved hosted scheduler.

## Non-goals

- No login automation, CAPTCHA/MFA bypass, or account/password collection.
- No course registration, payments, booking, or calendar writes.
- No USThing scraping or unofficial private group ingestion.
- No HKUST(GZ) sources.
- No background daemon started by installation.

## Acceptance criteria

- `npm test` proves source search, reminder timing/deduplication, weather normalization, account gate behaviour, and tool registration helpers.
- `npm run build` compiles without TypeScript errors.
- `npm run demo` starts the server through a real stdio MCP transport.
- The README gives Codex/ChatGPT/Claude Code connection guidance, source boundaries, concrete tool catalogue, and a reproducible test command.
