# Contributing

Thanks for helping HKUST Clear Water Bay students find the right official answer
faster. This project has an unusual rule set, because a wrong campus fact costs a
student a deadline.

## The two rules that matter most

1. **Every campus fact needs an official owner.** A claim about enrolment,
   housing, opening hours, transport, or money belongs to a specific HKUST
   office (ARO, CSO, SHRLO, Library, DSTO, HSEO, ITSO, SFAO, Career Center,
   Office of Global Learning, …). Cite that office's own page. Student wikis,
   forum posts, screenshots, and LLM output are not sources.
2. **Clear Water Bay only.** This project does not cover HKUST(GZ). If a source
   page mixes both campuses, say which part applies to Clear Water Bay.

## Setup

Requires Node.js 22+.

```bash
npm install
npm test
```

## Changing a source

Sources live in the registry under `src/data/`. A source change must carry:

- the **owner URL** — the responsible office's own page, not an aggregator;
- the **observed date** — when you actually loaded that page;
- the **Clear Water Bay** scope confirmation.

Open a [source correction issue](.github/ISSUE_TEMPLATE/source-correction.yml)
first if you are reporting rather than fixing.

## Changing behaviour

This repository is test-driven. Write the failing test first, then make it pass.

- MCP tools and domain logic: `src/`, tested in `tests/`.
- Skill packages: `skills/<slug>/SKILL.md` plus `skills/<slug>/agents/openai.yaml`.
  `tests/skill-packages.test.ts` keeps the catalogue, the folders, and the UI
  metadata in sync — add new skills to `src/data/skills-catalog.ts` too.
- Web Hub: `apps/hub/`, run with `npm run hub`.

Before opening a pull request:

```bash
npm test
npm run build
npm run smoke
npm run release:check
```

## Boundaries a pull request must not cross

- No login automation, credential collection, cookie replay, scraping behind
  SSO, or CAPTCHA/MFA bypass.
- No tool that accepts a password, MFA code, or e-identity QR code.
- No fetching of URLs outside the registry allow-list.
- No student data in the repository: no ICS files, timetable screenshots,
  transcripts, mail exports, `.env` files, or access tokens. Use synthetic
  fixtures.
- Do not present uncertain page text as a university rule. Link the source and
  keep the retrieval timestamp.

Security problems go through [SECURITY.md](SECURITY.md), not a public issue.

By contributing you agree your work is released under the [MIT License](LICENSE).
