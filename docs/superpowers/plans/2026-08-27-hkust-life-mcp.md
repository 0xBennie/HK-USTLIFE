# HKUST Life MCP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-minded, stdio MCP server that gives HKUST Clear Water Bay students official campus-life discovery, live weather, reminder planning, and safely gated read-only Outlook signals.

**Architecture:** A small TypeScript service separates pure domain logic from I/O adapters. A static, auditable source registry determines what campus information can be referenced; a Hong Kong Observatory adapter is the only live public data integration in v0.1. An MCP composition root exposes narrow tools and serializes all results with provenance. Personal Outlook access goes through a read-only Graph adapter that is inactive until an access token is deliberately configured.

**Tech Stack:** Node.js 22+, TypeScript 5, `@modelcontextprotocol/sdk` 1.30.0, Zod 3, Vitest, native `fetch`.

**Spec:** `docs/architecture/hkust-life-mcp.md`

## Global Constraints

- Main campus at Clear Water Bay only; exclude HKUST(GZ).
- Use only allow-listed official sources and return provenance for live data.
- Never accept, scrape, or log passwords, MFA codes, QR codes, or cookies.
- Personal connectors are read-only; no booking, payment, registration, or calendar writing.
- Default timezone is `Asia/Hong_Kong`; no notification daemon starts automatically.
- Use `@modelcontextprotocol/sdk` 1.30.0 and its stdio transport.
- Tests are written and observed failing before corresponding production code.

---

### Task 1: Project skeleton and source registry

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: `src/domain/types.ts`
- Create: `src/data/source-registry.ts`
- Create: `src/domain/source-search.ts`
- Test: `tests/source-search.test.ts`

**Interfaces:**
- Produces `CampusSource`, `CampusService`, `searchCampusServices(query: string): CampusService[]`.
- Later tasks consume `searchCampusServices` to give users official destinations.

- [ ] **Step 1: Write the failing test**

```ts
import { searchCampusServices } from '../src/domain/source-search.js';

it('finds the library service from a natural-language query', () => {
  expect(searchCampusServices('where can I study tonight')[0]?.id).toBe('library-hours');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/source-search.test.ts`

Expected: FAIL because `src/domain/source-search.ts` does not exist.

- [ ] **Step 3: Write minimal implementation**

```ts
export function searchCampusServices(query: string): CampusService[] {
  const words = query.toLowerCase().split(/\W+/).filter(Boolean);
  return campusServices.filter((service) =>
    words.some((word) => service.keywords.includes(word)),
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/source-search.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json tsconfig.json .gitignore src tests
git commit -m "feat: add HKUST official source registry"
```

### Task 2: Deterministic reminder planner

**Files:**
- Create: `src/domain/reminder-plan.ts`
- Test: `tests/reminder-plan.test.ts`

**Interfaces:**
- Consumes `PlannableEvent` and `ReminderRule` from `src/domain/types.ts`.
- Produces `planReminders(events, rules, timezone): ReminderProposal[]`.
- Later MCP tool calls it without keeping state.

- [ ] **Step 1: Write the failing test**

```ts
it('creates only one 45-minute course reminder for duplicate input', () => {
  const events = [classEvent, { ...classEvent }];
  expect(planReminders(events, defaultReminderRules, 'Asia/Hong_Kong')).toHaveLength(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/reminder-plan.test.ts`

Expected: FAIL because `planReminders` does not exist.

- [ ] **Step 3: Write minimal implementation**

```ts
export function planReminders(events: PlannableEvent[], rules: ReminderRule[], timezone: string) {
  return deduplicate(events.flatMap((event) => rulesFor(event, rules).map((rule) => toProposal(event, rule, timezone))));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/reminder-plan.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/reminder-plan.ts tests/reminder-plan.test.ts
git commit -m "feat: plan deduplicated HKUST reminders"
```

### Task 3: Public weather adapter and daily brief

**Files:**
- Create: `src/adapters/hko-weather.ts`
- Create: `src/domain/daily-brief.ts`
- Test: `tests/hko-weather.test.ts`
- Test: `tests/daily-brief.test.ts`

**Interfaces:**
- Produces `getHongKongWeather(fetcher): Promise<WeatherSnapshot>`.
- Produces `buildDailyBrief({ weather, events, sourceUrl, generatedAt }): DailyBrief`.
- The MCP server uses `fetch` in production and controlled fake fetches in tests.

- [ ] **Step 1: Write the failing test**

```ts
it('normalizes an HKO warning payload into a source-attributed snapshot', async () => {
  const weather = await getHongKongWeather(fakeFetch(hkoPayload));
  expect(weather.sourceUrl).toContain('data.weather.gov.hk');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/hko-weather.test.ts`

Expected: FAIL because `getHongKongWeather` does not exist.

- [ ] **Step 3: Write minimal implementation**

```ts
export async function getHongKongWeather(fetcher: Fetcher): Promise<WeatherSnapshot> {
  const [weather, warnings] = await Promise.all([fetchJson(fetcher, CURRENT_WEATHER), fetchJson(fetcher, WARNINGS)]);
  return normalizeWeather(weather, warnings);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/hko-weather.test.ts tests/daily-brief.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/adapters/hko-weather.ts src/domain/daily-brief.ts tests
git commit -m "feat: add live weather and student daily brief"
```

### Task 4: Read-only Outlook gate and Graph adapter

**Files:**
- Create: `src/adapters/graph-outlook.ts`
- Create: `src/domain/account-status.ts`
- Test: `tests/graph-outlook.test.ts`
- Test: `tests/account-status.test.ts`

**Interfaces:**
- Produces `getAccountStatus(environment): AccountStatus[]`.
- Produces `getOutlookSignals(accessToken, fetcher, now): Promise<OutlookSignals>`.
- Later tool registration never exposes access tokens as tool input or response content.

- [ ] **Step 1: Write the failing test**

```ts
it('reports Outlook as awaiting consent when no development token exists', () => {
  expect(getAccountStatus({}).find((item) => item.id === 'outlook')?.state).toBe('awaiting_consent');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/account-status.test.ts`

Expected: FAIL because `getAccountStatus` does not exist.

- [ ] **Step 3: Write minimal implementation**

```ts
export function getAccountStatus(environment: TokenEnvironment): AccountStatus[] {
  return [{ id: 'outlook', state: environment.HKUST_GRAPH_ACCESS_TOKEN ? 'development_token_configured' : 'awaiting_consent' }];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/account-status.test.ts tests/graph-outlook.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/adapters/graph-outlook.ts src/domain/account-status.ts tests
git commit -m "feat: add read-only Outlook connector gate"
```

### Task 5: MCP composition root and client documentation

**Files:**
- Create: `src/server.ts`
- Create: `src/index.ts`
- Create: `tests/server-tools.test.ts`
- Create: `README.md`
- Create: `docs/account-approval-request.md`
- Create: `examples/mcp-server.example.json`

**Interfaces:**
- Consumes the domain and adapter functions from Tasks 1–4.
- Produces `createMcpServer(dependencies): McpServer` and a `stdio` executable through `src/index.ts`.

- [ ] **Step 1: Write the failing test**

```ts
it('registers the daily brief, source search, reminder, account and Outlook tools', () => {
  const server = createMcpServer(testDependencies);
  expect(listRegisteredToolNames(server)).toEqual(expect.arrayContaining(['hkust_get_daily_brief', 'hkust_search_services']));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/server-tools.test.ts`

Expected: FAIL because `createMcpServer` does not exist.

- [ ] **Step 3: Write minimal implementation**

```ts
export function createMcpServer(dependencies: ServerDependencies) {
  const server = new McpServer({ name: 'hkust-life-mcp', version: '0.1.0' });
  server.registerTool('hkust_search_services', schema, handler);
  return server;
}
```

- [ ] **Step 4: Run test to verify it passes and compile**

Run: `npm test && npm run build`

Expected: PASS and a clean TypeScript build.

- [ ] **Step 5: Commit**

```bash
git add src tests README.md docs examples
git commit -m "feat: expose HKUST Life through MCP"
```

### Task 6: End-to-end protocol check

**Files:**
- Create: `scripts/smoke-mcp.mjs`
- Modify: `package.json`
- Test: `tests/smoke-mcp.test.ts`

**Interfaces:**
- Spawns `dist/index.js`, sends MCP `initialize` and `tools/list` JSON-RPC messages, and asserts the server advertises all required tools.

- [ ] **Step 1: Write the failing test**

```ts
it('advertises the expected tool names over stdio MCP', async () => {
  await expect(runMcpSmokeCheck()).resolves.toContain('hkust_get_weather');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/smoke-mcp.test.ts`

Expected: FAIL because the smoke check does not exist.

- [ ] **Step 3: Write minimal implementation**

```js
const child = spawn(process.execPath, ['dist/index.js'], { stdio: ['pipe', 'pipe', 'pipe'] });
child.stdin.write(JSON.stringify(initializeRequest) + '\n');
```

- [ ] **Step 4: Run full verification**

Run: `npm test && npm run build && npm run smoke`

Expected: all tests pass, compilation succeeds, and the stdio server completes an MCP handshake.

- [ ] **Step 5: Commit**

```bash
git add scripts package.json tests
git commit -m "test: verify MCP stdio protocol end to end"
```

## Self-review

- Spec coverage: Tasks 1–5 cover the public source boundary, main-campus source registry, live weather, daily brief, reminder planning, account consent gate, Graph read-only connector, real MCP transport, and documentation. Task 6 verifies the transport itself. Automation delivery is deliberately documented as client-owned because the spec forbids starting a background daemon.
- Placeholder scan: completed; no implementation steps depend on unspecified APIs or unnamed interfaces.
- Type consistency: Tasks 1–4 define the exact domain interfaces consumed by Task 5; Task 6 treats only the public stdio process as its integration surface.
