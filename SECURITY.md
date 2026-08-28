# Security Policy

This project routes HKUST Clear Water Bay students to official sources and, only
after the student's own consent, reads a minimal read-only slice of their
Microsoft 365 signals. That makes private-data handling the most important class
of bug here, not just remote code execution.

## Reporting a vulnerability

Open a private [GitHub security advisory](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability)
on this repository. Do not open a public issue for anything that exposes a
credential, a token, or another person's data.

**Do not include student data in a report.** No mail subjects, calendar entries,
timetable screenshots, student IDs, `@connect.ust.hk` addresses, ICS files,
access tokens, cookies, or session identifiers. Describe the shape of the
problem — endpoint, tool name, and the class of data reachable — and we will
reproduce it with synthetic fixtures.

Expect an initial response within 7 days.

## In scope

- Any path where an MCP tool returns private data the caller was not authorized
  to see, or leaks it into logs, errors, or tool arguments.
- A shared/hosted deployment serving one user's Outlook signals to another.
- The allow-list in the source registry being bypassed so the server fetches an
  arbitrary URL.
- Bearer-token handling on the Streamable HTTP transport (`src/http.ts`).
- Committed secrets. `npm run release:check` guards this, but report anything it
  misses.

## Out of scope

- Availability or content of HKUST's own websites and APIs.
- Anything requiring credentials the project deliberately refuses to accept.
  This project never asks for a password, MFA code, e-identity QR code, or
  session cookie, and does not bypass SSO or MFA. A report that depends on
  supplying those is out of scope.
- Stale public information (an outdated opening hour or deadline). File a
  source-correction issue instead.

## Data boundary

The public deployment exposes public campus information only. Per-user Outlook
and calendar access requires Microsoft Entra delegated OAuth and HKUST
institutional approval; see [docs/account-approval-request.md](docs/account-approval-request.md)
and [docs/architecture/hkust-life-mcp.md](docs/architecture/hkust-life-mcp.md).
