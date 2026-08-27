# HKUST Skills Hub Web Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a public, mobile-first website that helps an unfamiliar HKUST student discover skills, understand their next action, and connect to the public MCP safely.

**Architecture:** Add an isolated Next.js app under `apps/hub` using the shared catalog and static source manifest as build input. Public pages are static where possible; a Node runtime MCP route creates a new public-mode server for each stateless request and never receives private credentials.

**Tech Stack:** Next.js App Router, React, TypeScript, Vitest, Playwright-free DOM-free component helpers, shared root MCP core.

**Spec:** `docs/superpowers/specs/2026-08-28-hkust-skills-hub-design.md`

## Global Constraints

- User first: a new student sees Today, Start at HKUST, Campus now and skill installation before technical details.
- Mobile-first, accessible semantic HTML, keyboard focus, no auto-playing content.
- Do not show a password form or imply a private account is connected.
- Render only Clear Water Bay public sources; every dynamic fact has provenance/freshness.
- Remote endpoint is public-mode MCP only; never instantiate a server with Graph credentials.

---

### Task 1: Hub workspace and shared manifest

**Files:**
- Modify: `package.json`
- Create: `apps/hub/package.json`
- Create: `apps/hub/next.config.ts`
- Create: `apps/hub/tsconfig.json`
- Create: `apps/hub/lib/catalog.ts`
- Test: `tests/hub-manifest.test.ts`

**Interfaces:**
- Produces `HubSkillCard[]` from the core `listSkills()` catalogue.
- Hub pages consume only the normalized manifest, not direct ad-hoc source registry reads.

- [ ] **Step 1: Write failing manifest test**

```ts
expect(toHubSkillCards(listSkills())).toHaveLength(6);
expect(toHubSkillCards(listSkills())[0]).toHaveProperty('installCommand');
```

- [ ] **Step 2: Verify red**

Run: `npm test -- tests/hub-manifest.test.ts`

Expected: `apps/hub/lib/catalog.ts` cannot be imported.

- [ ] **Step 3: Scaffold Next app and manifest transformer**

```ts
export function toHubSkillCards(skills: SkillDefinition[]): HubSkillCard[] {
  return skills.map((skill) => ({ slug: skill.slug, title: skill.title, installCommand: `codex skills install ${skill.slug}` }));
}
```

Configure root scripts `build:core`, `build:hub`, and `build` to compile both packages.

- [ ] **Step 4: Verify green**

Run: `npm install && npm test -- tests/hub-manifest.test.ts && npm run build`

Expected: shared manifest test and both builds pass.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json apps/hub tests/hub-manifest.test.ts
git commit -m "feat: scaffold HKUST Skills Hub"
```

### Task 2: User-oriented Hub pages

**Files:**
- Create: `apps/hub/app/layout.tsx`
- Create: `apps/hub/app/page.tsx`
- Create: `apps/hub/app/skills/page.tsx`
- Create: `apps/hub/app/start/page.tsx`
- Create: `apps/hub/app/sources/page.tsx`
- Create: `apps/hub/app/connect/page.tsx`
- Create: `apps/hub/app/globals.css`
- Create: `apps/hub/components/skill-card.tsx`
- Create: `apps/hub/components/source-badge.tsx`
- Test: `tests/hub-content.test.ts`

**Interfaces:**
- `SkillCard` consumes `HubSkillCard`; `SourceBadge` consumes `Provenance`.
- `/` provides the student’s first action; `/skills` lists six skills; `/start` asks newcomer context client-side; `/sources` explains official source governance; `/connect` states OAuth status accurately.

- [ ] **Step 1: Write failing content tests**

```ts
expect(renderHomeModel().primaryAction.href).toBe('/start');
expect(renderConnectModel().privateDataNotice).toContain('never ask for your password');
```

- [ ] **Step 2: Verify red**

Run: `npm test -- tests/hub-content.test.ts`

Expected: Hub view-model imports fail.

- [ ] **Step 3: Implement view models and pages**

The landing page must lead with “I just arrived”, “Plan today”, “Is it open?”, and “Find an opportunity”. Each route renders source cards or static copy from the manifest. The connect page explicitly lists Outlook as pending consent and Canvas/SIS as institutional approval required.

- [ ] **Step 4: Verify green and production build**

Run: `npm test -- tests/hub-content.test.ts && npm run build:hub`

Expected: pages compile and models test green.

- [ ] **Step 5: Commit**

```bash
git add apps/hub tests/hub-content.test.ts
git commit -m "feat: add student-first Skills Hub pages"
```

### Task 3: Browser-local newcomer and ICS flows

**Files:**
- Create: `apps/hub/components/newcomer-flow.tsx`
- Create: `apps/hub/components/ics-import.tsx`
- Create: `apps/hub/lib/browser-profile.ts`
- Test: `tests/browser-profile.test.ts`

**Interfaces:**
- `loadLocalProfile(storage): NewcomerProfile | null` and `saveLocalProfile(storage, profile): void` use browser localStorage only.
- `IcsImport` passes selected file text to the shared parser in the browser bundle and never uploads calendar content.

- [ ] **Step 1: Write failing browser-profile tests**

```ts
const storage = memoryStorage();
saveLocalProfile(storage, profile);
expect(loadLocalProfile(storage)).toEqual(profile);
```

- [ ] **Step 2: Verify red**

Run: `npm test -- tests/browser-profile.test.ts`

Expected: `browser-profile` is missing.

- [ ] **Step 3: Implement local-only persistence and UI safeguards**

```ts
export function saveLocalProfile(storage: StorageLike, profile: NewcomerProfile): void {
  storage.setItem('hkust-life-profile-v1', JSON.stringify(profile));
}
```

The UI shows a local-only notice, a clear-data control, and does not issue a network request on import.

- [ ] **Step 4: Verify green**

Run: `npm test -- tests/browser-profile.test.ts && npm run build:hub`

Expected: persistence test and Hub build pass.

- [ ] **Step 5: Commit**

```bash
git add apps/hub tests/browser-profile.test.ts
git commit -m "feat: add local newcomer and calendar flows"
```

### Task 4: Public Streamable HTTP MCP route

**Files:**
- Create: `apps/hub/app/api/mcp/route.ts`
- Create: `apps/hub/app/api/health/route.ts`
- Test: `tests/public-mcp-route.test.ts`

**Interfaces:**
- `/api/mcp` accepts Streamable HTTP MCP requests and uses `createMcpServer({ mode: 'public' })`.
- `/api/health` returns `{ status: 'ok', scope: 'clear-water-bay-public' }` without fetching private data.

- [ ] **Step 1: Write failing route test**

```ts
const response = await handlePublicMcp(initializeRequest);
expect(response.status).toBe(200);
expect(await response.text()).toContain('hkust-life-mcp');
```

- [ ] **Step 2: Verify red**

Run: `npm test -- tests/public-mcp-route.test.ts`

Expected: public route handler import is missing.

- [ ] **Step 3: Implement stateless web-standard transport adapter**

Create a server per POST with the SDK web-standard transport and `mode: 'public'`. Accept only `POST /api/mcp`, enforce a 1 MB request body limit, return JSON-RPC method errors for unsupported methods, and expose no private connector tool.

- [ ] **Step 4: Verify green and build**

Run: `npm test -- tests/public-mcp-route.test.ts tests/server-tools.test.ts && npm run build`

Expected: public route initializes successfully and tool filtering test stays green.

- [ ] **Step 5: Commit**

```bash
git add apps/hub/app/api tests/public-mcp-route.test.ts
git commit -m "feat: expose public HKUST MCP route"
```
