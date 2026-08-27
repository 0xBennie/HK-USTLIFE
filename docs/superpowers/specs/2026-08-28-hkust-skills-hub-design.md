# HKUST Skills Hub Design

## Purpose

Turn HKUST Life MCP into a public, Clear Water Bay main-campus Skills Hub. Any student can discover and install focused agent skills, invoke reliable public campus tools online, and see the official source and freshness of the answer. Private student data stays local or in a future per-user approved connector; it is never part of the public hub.

## Product promise

For a student who has just arrived and knows nothing about HKUST:

1. Open the Hub and immediately find the relevant task instead of guessing which office owns it.
2. Install one focused Skill into Codex, Claude Code, or another compatible agent.
3. Use a public remote MCP for current, source-attributed campus information.
4. Connect private Outlook/Canvas/SIS data only through explicit per-user authorization, after institutional approval.

## Scope

**In scope**

- HKUST Clear Water Bay main campus only.
- Public website for Skill discovery, installation instructions, campus sources and first-week onboarding.
- A public remote MCP endpoint for public read-only data.
- Seven versioned skill packages in the repository.
- Official-source provenance, freshness and graceful degradation.
- Local-only student profile, ICS schedule import and host-agent timetable screenshot interpretation as the no-credential personal path.
- Source-attributed course-schedule planning that proposes combinations but never registers a class.
- GitHub publication as a public repository after checks pass.

**Out of scope for this release**

- HKUST(GZ).
- Collecting a student password, MFA code, cookie, QR identity or SIS credentials.
- Course registration, payment, booking, calendar writes, or any other account mutation.
- A shared store of student mailbox, timetable, or profile data.
- Unmoderated student advice presented as official university guidance.
- Canvas/SIS production connectivity before written approval from their system owners.

## Users

| User | Primary outcome |
| --- | --- |
| New UG student | Finish first-week tasks, find places and avoid missing administrative deadlines. |
| Continuing student | Get a current daily operational brief and deadline/reminder plan. |
| RPG/exchange student | Find relevant housing, academic and international support without wading through unrelated information. |
| Agent user | Install a concise skill or call an MCP tool with predictable source provenance. |
| Hub maintainer | Add/refresh a source, observe a failed fetch, and review a student-contributed tip. |

## Information architecture

```text
Skills Hub website
├─ Today                 current personal/public brief entry point
├─ Start at HKUST        newcomer task flow
├─ Campus now            transport, places, weather and disruption
├─ Academic              calendar, registration, deadlines and support
├─ Plan my timetable     screenshot-to-events and course-section planning
├─ Opportunities         events, clubs, career, exchange and scholarships
├─ Skills catalogue      inspect, install and invoke a focused skill
├─ Sources               owners, source URLs, freshness and exclusions
└─ Connect account       explains consent status; no password form

Remote MCP API
├─ public tools          weather, source search, official update, reminder plan
├─ local profile tools   only when launched locally by the student
└─ private connector     absent until per-user OAuth and institutional approval
```

## Skill packages

All skills live under `skills/`, are independently installable, and include only domain-specific instructions and references. They invoke the same `hkust-life-mcp` tools rather than duplicating data fetch logic.

| Skill | Triggered student intent | Allowed action |
| --- | --- | --- |
| `hkust-today` | “What do I need to do today?” | Build a cited daily brief and reminder proposal. |
| `hkust-newcomer` | “I just arrived / what do I need to set up?” | Ask only essential profile questions and issue a source-linked checklist. |
| `hkust-campus-status` | “How do I get there / is it open / what does weather affect?” | Query public status and give official deep links. |
| `hkust-academic` | “When do I register / what is due / where is the rule?” | Find official academic sources; never alter enrolment. |
| `hkust-opportunities` | “What events, clubs, careers, exchange or scholarships are relevant?” | Return dated official opportunities and contact points. |
| `hkust-course-planner` | “Here are the courses I want; make me a schedule” | Rank conflict-free, source-linked section combinations; never add, drop or submit a class. |
| `hkust-life-mcp` | “Use HKUST campus tools” | Route a general campus request to MCP tools and preserve provenance. |

## Data model and source governance

Each public answer carries:

```ts
type Provenance = {
  sourceId: string;
  owner: string;
  url: string;
  fetchedAt: string;
  effectiveDate?: string;
  freshness: 'live' | 'fetched' | 'static-link';
};
```

The source registry is an allow-list. A source has its owner, topical coverage, Clear Water Bay scope, URL, expected update cadence and parser type. The owning office overrides a conflicting third-party page. Failed live fetches return a clear `unavailable` state plus the official deep link; they never silently use fabricated, stale or cached values.

The initial live adapters are HKO weather/warnings and allow-listed HTML source text. Subsequent adapters are prioritized as follows:

1. CSO transport, food/commercial and outage notices.
2. Library hours and study-space notices.
3. SHRLO application/deadline notices.
4. University Calendar/ERMS event listings.
5. ARO Class Schedule & Quota, Course Catalog and academic calendar/deadline sources.

No source is added by scraping pages that require a login or by reverse-engineering a private student system.

### Timetable screenshots and course planning

A timetable screenshot is personal data. The hosted Hub does not upload or retain it. Instead, the installed Skill instructs the student's current agent (Codex, ChatGPT or Claude Code) to read the image locally, state any ambiguous course code/time for confirmation, and turn confirmed events into the local Today/reminder flow.

For future-term planning, the course-planner Skill consumes course sections normalized from the public ARO Class Schedule & Quota and Course Catalog. Every section records its official URL, fetch time and any quota/matching-rule notes. A student supplies the courses they need and preferences such as free days, earliest/latest time, target credits and times to avoid. The planner returns ranked valid combinations, conflicts, credit/load caveats and the official source link. It does **not** upload a plan to SIS, reserve a quota, or submit registration; the student must confirm the current official data and take the final action in SIS.

## Today and newcomer flows

### Today

Inputs are public campus state plus one of: (a) events supplied in the request, (b) an ICS file stored locally by the student, or (c) a future authorized personal connector.

Output order:

1. Urgent weather/disruption items.
2. Next class/event and a suggested departure time.
3. Deadlines in the next 48 hours.
4. Relevant campus opening/transport facts.
5. Links and source provenance for every external fact.

The Hub can recommend a Path Advisor destination; until a verified routing-time source exists, it must not invent walking time or live crowding.

### Newcomer

The newcomer Skill creates a local checklist from only these optional fields: level (UG/RPG), residency (local/non-local/exchange), housing (on-campus/off-campus/not yet arranged), and intake term. It returns only tasks which have a source in the registry. The student can mark local tasks complete; the public Hub does not store them.

## Deployment model

### Public Hub

The repository uses a Next.js Hub app plus the existing TypeScript MCP core. The Hub and public Streamable HTTP MCP endpoint are deployed to Vercel over HTTPS once the user authenticates a Vercel project. The website is static/cacheable wherever possible; server routes fetch public sources with a timeout and return normalized provenance. The public endpoint never loads a user's Graph token.

### Authentication and private data

The website has no password login in this release. A local agent installation may keep its own local profile and local ICS path. Future hosted personal features require all of:

1. A per-user OAuth connection, encrypted token storage and token revocation UI.
2. HKUST Entra tenant permission for Outlook basic reads.
3. Canvas root-account Developer Key and approved scopes.
4. ARO/ITSO approved SIS API contract.

Until then, private connector tools expose status only. The remote server rejects shared Graph tokens by design.

### Scheduling

MCP is a request/response interface, not a hidden daemon. The Hub returns normalized reminders. Each student deliberately enables delivery in their agent/host scheduler; the settings include local timezone, quiet hours, deduplication and an off switch. No scheduler starts automatically on install.

## GitHub release

The repository is public under the MIT License. Before push:

- run tests, build, protocol smoke test and secret scan;
- verify no `.env`, access token, profile, calendar export or student data is tracked;
- include a security policy, contribution guide and source-contribution rules;
- create the public GitHub repository only with the user's authorized account;
- push the verified branch and report the repository URL.

GitHub issues and pull requests are used for source corrections and new Skills. Student tips are accepted only through a separate moderation workflow and always labeled non-official.

## Quality and acceptance criteria

- `npm test`, `npm run build` and the stdio MCP smoke test pass.
- A public HTTP smoke test verifies authentication, MCP initialization and public tool discovery.
- Every skill passes the bundled skill validator and only references declared resources.
- The Hub renders its seven skills, each with an install command and source-boundary copy.
- The source registry test rejects HKUST(GZ) and arbitrary URLs.
- An ICS fixture yields a deterministic Today brief and reminder plan.
- Course-plan fixtures verify time conflicts, section matching rules, preference ranking and the explicit no-registration boundary.
- A repository secret scan finds no credential-like values or local student files.
- The release README explains local use, remote public use, private-data limitations and the contribution process.

## Delivery order

1. Skill packages and hardened source registry.
2. Local profile + ICS importer + Today/newcomer domain logic.
3. Hub website and public HTTP endpoint.
4. Tests, source/skill validation and GitHub release assets.
5. Create and push public GitHub repository.
6. Deploy only after the target hosting account is authenticated and the user confirms the public URL/domain.
