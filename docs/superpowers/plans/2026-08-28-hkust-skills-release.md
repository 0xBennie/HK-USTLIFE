# HKUST Skills Hub Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the project safe to publish publicly, document student installation/contribution paths, create the authorized public GitHub repository, and deploy only after authenticated hosting confirmation.

**Architecture:** Release assets live at the repository root and make data boundaries legible to contributors. Verification gates run before external publication. GitHub creation/push and Vercel deployment are separately authorized external actions, with no token printed into logs or committed to the repository.

**Tech Stack:** Git, GitHub CLI, npm audit, repository secret scan, Vercel CLI after user authentication.

**Spec:** `docs/superpowers/specs/2026-08-28-hkust-skills-hub-design.md`

## Global Constraints

- Repository is public under MIT License.
- No access token, `.env`, ICS file, user profile or student data is tracked.
- Do not publish or deploy until all verification commands pass.
- Public deployment contains public MCP only; private data needs per-user OAuth and institutional approval.
- Report the exact GitHub repository and deployed HTTPS URL after external publication.

---

### Task 1: Public repository assets and contributor rules

**Files:**
- Create: `LICENSE`
- Create: `SECURITY.md`
- Create: `CONTRIBUTING.md`
- Create: `.github/ISSUE_TEMPLATE/source-correction.yml`
- Create: `.github/pull_request_template.md`
- Modify: `README.md`
- Test: `tests/release-assets.test.ts`

**Interfaces:**
- `README.md` links each skill, Hub page, local usage, remote usage, screenshot/course-planning boundaries and privacy boundary.
- Contribution template requires owner URL, observed date and Clear Water Bay scope for source changes.

- [ ] **Step 1: Write failing release-asset test**

```ts
expect(await readFile('LICENSE', 'utf8')).toContain('MIT License');
expect(await readFile('SECURITY.md', 'utf8')).toContain('Do not include student data');
```

- [ ] **Step 2: Verify red**

Run: `npm test -- tests/release-assets.test.ts`

Expected: `LICENSE` is missing.

- [ ] **Step 3: Add public-repository policy files**

Use the MIT license text, explain private-data disclosure reporting, and require sources to be official/attributed. README must never promise automatic SIS/Canvas access.

- [ ] **Step 4: Verify green**

Run: `npm test -- tests/release-assets.test.ts && git diff --check`

Expected: tests pass and no whitespace errors.

- [ ] **Step 5: Commit**

```bash
git add LICENSE SECURITY.md CONTRIBUTING.md .github README.md tests/release-assets.test.ts
git commit -m "docs: prepare public Skills Hub release"
```

### Task 2: Release verification and secret guard

**Files:**
- Create: `scripts/release-check.mjs`
- Modify: `package.json`
- Test: `tests/release-check.test.ts`

**Interfaces:**
- Produces `runReleaseCheck({ cwd }): Promise<ReleaseCheckResult>`.
- Fails on tracked `.env`, private calendar/profile extensions, or high-risk credential-name assignments; it does not print a matched secret value.

- [ ] **Step 1: Write failing secret-guard test**

```ts
await expect(scanTrackedText('DEMO_TOKEN=abc')).resolves.toContain('credential-like assignment');
await expect(scanTrackedText('sourceUrl=https://library.hkust.edu.hk')).resolves.toEqual([]);
```

- [ ] **Step 2: Verify red**

Run: `npm test -- tests/release-check.test.ts`

Expected: `release-check.mjs` cannot be imported.

- [ ] **Step 3: Implement conservative tracked-file scan**

```js
export function scanTrackedText(text) {
  return /(API[_-]?KEY|ACCESS[_-]?TOKEN|CLIENT[_-]?SECRET)\s*=\s*[^\s]+/i.test(text) ? ['credential-like assignment'] : [];
}
```

Use `git ls-files` as input, skip binary files, report only file paths and rule names, then run `npm audit --omit=dev`.

- [ ] **Step 4: Verify green and full release gate**

Run: `npm test && npm run build && npm run smoke && npm run release:check`

Expected: all tests/build/smoke pass, secret scan returns no findings, and production audit reports no vulnerabilities.

- [ ] **Step 5: Commit**

```bash
git add scripts/release-check.mjs package.json tests/release-check.test.ts
git commit -m "test: add public release safety checks"
```

### Task 3: Create and push authorized public GitHub repository

**Files:**
- Modify: `.git/config` through `git remote add origin`

**Interfaces:**
- Creates `github.com/$GH_LOGIN/hkust-skills-hub` as a public repository after resolving `$GH_LOGIN` from the GitHub API.
- Pushes branch `feat/hkust-life-mcp` only after Task 2 passes.

- [ ] **Step 1: Verify GitHub authentication and repository availability**

Run:

```bash
GH_LOGIN=$(gh api user --jq .login)
gh auth status
gh repo view "$GH_LOGIN/hkust-skills-hub"
```

Expected: authenticated user is identified; `repo view` either reports not found or shows the user-owned target.

- [ ] **Step 2: Create public repository only if absent**

Run: `gh repo create hkust-skills-hub --public --source=. --remote=origin --push`

Expected: command prints the new repository URL and pushes the active branch.

- [ ] **Step 3: Verify remote publication**

Run: `git ls-remote --heads origin feat/hkust-life-mcp && gh repo view --web=false`

Expected: remote branch SHA matches local HEAD and repository visibility is PUBLIC.

- [ ] **Step 4: Report remote URL without exposing credentials**

Report GitHub URL, branch and verification result. Do not create a pull request unless the user asks.

### Task 4: Deploy public Hub after hosting authentication

**Files:**
- Modify: `README.md`

**Interfaces:**
- Deploys `apps/hub` with public-only environment and reports HTTPS `/api/health` plus `/api/mcp` URLs.

- [ ] **Step 1: Verify Vercel authentication and project ownership**

Run: `vercel whoami && vercel link --yes`

Expected: authenticated account and linked project; stop for user action if authentication opens a browser or asks for ownership selection.

- [ ] **Step 2: Deploy without personal connector variables**

Run: `DEPLOY_URL=$(vercel --prod --yes | tail -n 1); printf '%s\n' "$DEPLOY_URL"`

Expected: a production HTTPS deployment URL; no `HKUST_GRAPH_ACCESS_TOKEN` is configured.

- [ ] **Step 3: Verify public surface**

Run: `curl --fail --silent --show-error "$DEPLOY_URL/api/health" && curl --fail --silent --show-error "$DEPLOY_URL/"`

Expected: health response contains `clear-water-bay-public`; site returns successful HTML.

- [ ] **Step 4: Update README and report URL**

Add the verified public Hub URL and MCP endpoint URL. Report both URLs to the user.
