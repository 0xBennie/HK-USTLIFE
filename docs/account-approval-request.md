# HKUST Life MCP — Account Integration Approval Request

## Request

We request a formally approved, student-consented, **read-only** integration for HKUST Clear Water Bay students. The objective is a personal daily brief: show basic calendar commitments and alert a student to time-sensitive official e-mail without asking them to hand a password, MFA code, cookie, QR code or e-identity credential to a third-party tool.

## Microsoft 365 / Outlook

**Identity flow:** Microsoft Entra ID delegated OAuth 2.0 authorization-code flow with PKCE. The student signs in on the HKUST/Microsoft hosted page. Tokens are held in the student's approved client secret store, never in MCP arguments, prompts, logs or a shared campus database.

**Requested minimum delegated scopes:**

| Scope | Needed fields | Explicitly excluded |
| --- | --- | --- |
| `Mail.ReadBasic` | `id`, `subject`, `from`, `receivedDateTime`, `isRead`, `importance` | message body, `bodyPreview`, attachments, extensions |
| `Calendars.ReadBasic` | `id`, `subject`, `start`, `end`, `location`, `isCancelled`, `showAs` | body, attachments, extensions, calendar writes |

**Proposed Graph reads:**

- `GET /me/mailFolders/inbox/messages` with `$select=id,subject,from,receivedDateTime,isRead,importance`, `$orderby=receivedDateTime desc`, `$top=10`.
- `GET /me/calendarView` with a seven-day range and `$select=id,subject,start,end,location,isCancelled,showAs`.

No `POST`, `PATCH`, `DELETE`, `sendMail`, calendar creation, directory read, file read, or application permission is requested. Students can revoke consent and disconnect at any time. Microsoft documents delegated consent and the permission model at [Microsoft Graph authorization](https://learn.microsoft.com/en-us/graph/auth-v2-user) and [Microsoft Graph permissions reference](https://learn.microsoft.com/en-us/graph/permissions-reference).

## Canvas

Request a root-account Developer Key with a student-consented, read-only scope limited to course list, calendar events and assignment/deadline metadata. No submissions, grading, enrolment changes or account management. Canvas Developer Keys are a root-account admin-controlled capability: [Canvas Developer Keys](https://developerdocs.instructure.com/services/canvas/oauth2/file.developer_keys).

## SIS

Request an ARO/ITSO-approved protected, read-only API for a student's enrolled sections and official assessment timetable only. Do not expose grades, billing, addresses, identity documents or full student records. There is no fallback of scripted sign-in, cookie extraction or MFA automation.

## Operational controls

- Per-user OAuth tokens stored in a local OS secret store or approved encrypted credential service.
- Encrypted in transit; no token logged or returned by MCP.
- Raw private data retained only for the active request in v0.1; no central campus-wide private cache.
- Audit access by connector, student pseudonymous id, scope, timestamp and endpoint—never message bodies or tokens.
- Consent screen states each data type and includes disconnect/revoke instructions.
- Rate limits, expiry handling, scope downgrade and incident contact agreed with ITSO before launch.

## Needed decisions

1. ITSO: Entra app registration, tenant consent policy and production redirect URI review.
2. CEI/Canvas admin: Developer Key ownership and exact read-only scopes.
3. ARO + ITSO: SIS data contract, subject coverage, rate limits and student consent mechanism.
4. HKUST privacy/security review: retention, access audit, terms and incident response.
