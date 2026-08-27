# HKUST Skills Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a student-first Today engine, local ICS/newcomer workflows, source governance, public/local MCP modes, and six installable HKUST skills.

**Architecture:** Preserve the existing TypeScript MCP core and add pure domain modules for newcomer checklist generation, calendar import, and Today briefs. The MCP server composes those modules in `local` or `public` mode; public mode never advertises private Outlook tools. Skills contain guidance only and invoke the MCP core for facts.

**Tech Stack:** Node.js 22+, TypeScript, Vitest, Zod, `@modelcontextprotocol/sdk`, standard iCalendar text parsing.

**Spec:** `docs/superpowers/specs/2026-08-28-hkust-skills-hub-design.md`

## Global Constraints

- Cover HKUST Clear Water Bay main campus only; reject HKUST(GZ).
- Preserve source owner, URL, fetched time and freshness on every public fact.
- Never accept or persist passwords, MFA codes, cookies, QR identity or shared Graph tokens.
- No account writes, booking, payment, registration or calendar mutations.
- Default user-facing timezone is `Asia/Hong_Kong`.
- Skills must be self-contained, under `skills/`, and pass `quick_validate.py`.
- Tests precede their corresponding production implementation.

---

### Task 1: Source governance and Skills catalogue

**Files:**
- Create: `src/data/skills-catalog.ts`
- Create: `src/domain/provenance.ts`
- Modify: `src/data/source-registry.ts`
- Modify: `src/domain/types.ts`
- Test: `tests/skills-catalog.test.ts`
- Test: `tests/source-registry.test.ts`

**Interfaces:**
- Produces `SkillDefinition`, `Provenance`, `listSkills()`, `findSkill(slug)`, and `findCampusService(id)`.
- Hub and MCP tools consume `SkillDefinition`; all source adapters consume `Provenance`.

- [ ] **Step 1: Write failing tests**

```ts
expect(listSkills().map((skill) => skill.slug)).toContain('hkust-newcomer');
expect(() => findCampusService('hkust-gz')).toThrow('Unknown main-campus source');
```

- [ ] **Step 2: Verify red**

Run: `npm test -- tests/skills-catalog.test.ts tests/source-registry.test.ts`

Expected: module-not-found failure for `skills-catalog` and missing source lookup.

- [ ] **Step 3: Implement minimal domain types and registry lookup**

```ts
export type Provenance = { sourceId: string; owner: string; url: string; fetchedAt: string; freshness: 'live' | 'fetched' | 'static-link' };
export const listSkills = (): SkillDefinition[] => [...skills];
export function findCampusService(id: string): CampusService { /* lookup allow-list or throw */ }
```

- [ ] **Step 4: Verify green and compile**

Run: `npm test -- tests/skills-catalog.test.ts tests/source-registry.test.ts && npm run build`

Expected: all tests pass and TypeScript exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/data src/domain tests
git commit -m "feat: add governed Skills catalogue"
```

### Task 2: Local ICS calendar normalization

**Files:**
- Create: `src/adapters/ics-calendar.ts`
- Test: `tests/ics-calendar.test.ts`

**Interfaces:**
- Produces `parseIcsCalendar(content: string, timezone: string): PlannableEvent[]`.
- Today engine consumes normalized `PlannableEvent[]`; parser reads only caller-provided text and has no filesystem or network access.

- [ ] **Step 1: Write failing test with a folded VCALENDAR fixture**

```ts
const events = parseIcsCalendar('BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:math-1\nSUMMARY:MATH101\nDTSTART:20260901T100000\nEND:VEVENT\nEND:VCALENDAR', 'Asia/Hong_Kong');
expect(events[0]).toMatchObject({ id: 'math-1', title: 'MATH101', kind: 'class', startsAt: '2026-09-01T10:00:00+08:00', source: 'student_calendar' });
```

- [ ] **Step 2: Verify red**

Run: `npm test -- tests/ics-calendar.test.ts`

Expected: `parseIcsCalendar` cannot be imported.

- [ ] **Step 3: Implement a narrow VEVENT parser**

```ts
export function parseIcsCalendar(content: string, timezone: string): PlannableEvent[] {
  return unfold(content).split('BEGIN:VEVENT').slice(1).map(toEvent).filter(isDatedEvent);
}
```

Support `UID`, `SUMMARY`, `DTSTART`, `DTEND`, date-time offsets and all-day events. Reject invalid event dates with a `CalendarParseError` that names no private content.

- [ ] **Step 4: Verify green and existing reminders**

Run: `npm test -- tests/ics-calendar.test.ts tests/reminder-plan.test.ts && npm run build`

Expected: parser and reminder tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/adapters/ics-calendar.ts tests/ics-calendar.test.ts
git commit -m "feat: import local ICS schedules"
```

### Task 3: Newcomer checklist and Today engine

**Files:**
- Create: `src/domain/newcomer-checklist.ts`
- Create: `src/domain/today.ts`
- Test: `tests/newcomer-checklist.test.ts`
- Test: `tests/today.test.ts`

**Interfaces:**
- Produces `buildNewcomerChecklist(profile: NewcomerProfile): ChecklistItem[]`.
- Produces `buildToday({ now, weather, events, serviceFacts }): TodayBrief`.
- MCP and Hub each serialize the same result but do not persist task completion server-side.

- [ ] **Step 1: Write failing tests**

```ts
expect(buildNewcomerChecklist({ level: 'ug', residency: 'non_local', housing: 'not_arranged', intakeTerm: 'fall' })
  .map((item) => item.sourceId)).toEqual(expect.arrayContaining(['housing', 'it-support']));
expect(buildToday(input).nextEvent?.id).toBe('math-1');
expect(buildToday(input).deadlines[0]?.id).toBe('comp-deadline');
```

- [ ] **Step 2: Verify red**

Run: `npm test -- tests/newcomer-checklist.test.ts tests/today.test.ts`

Expected: imports fail because the two domain modules do not exist.

- [ ] **Step 3: Implement deterministic first-week and daily logic**

```ts
export function buildNewcomerChecklist(profile: NewcomerProfile): ChecklistItem[] { /* filter source-linked task rules */ }
export function buildToday(input: TodayInput): TodayBrief { /* urgent warnings, next event, 48h deadlines, sources */ }
```

Only output a checklist item when its `sourceId` resolves through `findCampusService`; sort warnings, next event, and deadlines deterministically.

- [ ] **Step 4: Verify green**

Run: `npm test -- tests/newcomer-checklist.test.ts tests/today.test.ts && npm run build`

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/domain tests
git commit -m "feat: add newcomer and Today student flows"
```

### Task 4: Public/local MCP modes and new student tools

**Files:**
- Modify: `src/server.ts`
- Modify: `src/http.ts`
- Test: `tests/server-tools.test.ts`
- Test: `tests/http-transport.test.ts`

**Interfaces:**
- Changes `createMcpServer({ mode: 'local' | 'public', ...dependencies })`.
- Adds `hkust_build_today`, `hkust_build_newcomer_checklist`, `hkust_parse_ics_schedule`, and `hkust_list_skills`.
- Public mode omits `hkust_get_outlook_signals`; local mode retains it only with an explicit local token.

- [ ] **Step 1: Write failing protocol tests**

```ts
expect((await publicClient.listTools()).tools.map((tool) => tool.name)).not.toContain('hkust_get_outlook_signals');
expect(JSON.stringify(await localClient.callTool({ name: 'hkust_build_newcomer_checklist', arguments: profile }))).toContain('housing');
```

- [ ] **Step 2: Verify red**

Run: `npm test -- tests/server-tools.test.ts tests/http-transport.test.ts`

Expected: tool catalogue assertion fails.

- [ ] **Step 3: Register typed public tools and separate modes**

```ts
export type McpMode = 'local' | 'public';
if (mode === 'local') server.registerTool('hkust_get_outlook_signals', ...);
server.registerTool('hkust_build_today', ...);
```

Route the remote HTTP transport through `mode: 'public'`; do not weaken its bearer/authentication checks when the self-hosted transport is used.

- [ ] **Step 4: Verify full MCP behavior**

Run: `npm test -- tests/server-tools.test.ts tests/http-transport.test.ts tests/smoke-mcp.test.ts && npm run build && npm run smoke`

Expected: public tool list excludes private Outlook; local smoke advertises its approved local tools.

- [ ] **Step 5: Commit**

```bash
git add src/server.ts src/http.ts tests
git commit -m "feat: add public student MCP flows"
```

### Task 5: Create and validate six Skill packages

**Files:**
- Create: `skills/hkust-today/SKILL.md`
- Create: `skills/hkust-newcomer/SKILL.md`
- Create: `skills/hkust-campus-status/SKILL.md`
- Create: `skills/hkust-academic/SKILL.md`
- Create: `skills/hkust-opportunities/SKILL.md`
- Create: `skills/hkust-life-mcp/SKILL.md`
- Create: `skills/*/agents/openai.yaml`
- Test: `tests/skill-packages.test.ts`

**Interfaces:**
- Each package references `hkust-life-mcp` public tools by name and has no network credentials.
- `skills-catalog.ts` publishes the exact slug/name/description path for each package.

- [ ] **Step 1: Write failing package tests**

```ts
expect(await validateSkillPackages()).toEqual([]);
expect(readSkill('hkust-today')).toContain('hkust_build_today');
```

- [ ] **Step 2: Verify red**

Run: `npm test -- tests/skill-packages.test.ts`

Expected: required `skills/hkust-today/SKILL.md` is missing.

- [ ] **Step 3: Initialize packages and write narrow instructions**

Each `SKILL.md` must route only the intent in the catalogue, ask for missing student context one question at a time, call the MCP tool, identify official versus student-supplied information, and never request credentials. Generate matching `agents/openai.yaml` metadata with the Skill Creator helper.

- [ ] **Step 4: Validate packages**

Run: `for skill in skills/*; do /Users/bennie/.codex/skills/.system/skill-creator/scripts/quick_validate.py "$skill"; done && npm test -- tests/skill-packages.test.ts`

Expected: every skill validates and package tests pass.

- [ ] **Step 5: Commit**

```bash
git add skills src/data/skills-catalog.ts tests/skill-packages.test.ts
git commit -m "feat: add installable HKUST student skills"
```
