# Local browser administrator session and draft contract

This documents the implemented loopback-only `/api/campus` gateway, not school SSO or a production authentication service. Native API bearer authentication is unchanged.

## Session endpoints

- `GET /session`: returns `{user, csrf, mode}`; current administrator identity or `null`. Rotates the CSRF cookie. A rejected/expired credential is cleared. Backend unavailability is an error, not a successful logout.
- `POST /challenge`, `POST /verify`: existing local development mailbox flow. No real email. Only administrators may establish this browser session.
- `POST /logout`: requires the same exact Host/Origin and CSRF checks even when already signed out. Revokes a present credential; a missing/already expired credential still returns `{signed_out: true, csrf}` and clears the browser cookie. Backend failures with a present credential do not report success.
- Session and CSRF cookies remain HttpOnly/SameSite=Strict; private responses are no-store. This configuration is not for public deployment.

## Retained editor identity

The administrator UI sends `X-Campus-Admin-Id` on all `/admin/...` reads/writes, using the identity that opened the mounted editor. When present, the gateway reads the current identity with the captured cookie and rejects a mismatch with `403 ACCOUNT_CHANGED`, before invoking the requested operation. The same captured credential is used upstream. This prevents an old browser editor from using a different administrator session established by another tab.

This header is an editor continuity check, not authentication or role authorization. The upstream still verifies the current session and administrator role on every admin endpoint. Non-UI clients without this optional header retain those existing checks.

## UI behavior

Campus, shuttle, activity and report draft state is registered centrally. Switching sections retains input in memory. Reconnect refreshes the same user's session/CSRF without resetting drafts or report selection. Network failures retain input and show an error. Pending work disables parent reconnect/logout; destructive record/filter changes and explicit logout require a discard decision. Same-origin navigation links are guarded; document unload has a browser-managed warning.

Authentication loss hides/disables mounted editors and blocks subsequent admin requests. The same administrator can sign in and resume. A different administrator cannot adopt the retained drafts. Explicit logout discards input only after acknowledgement succeeds. Version checks are still required at save time; reauthentication does not update old record versions or automatically retry writes.

These are memory drafts, not durable offline storage. Reload, process exit, mobile browser termination or browser-managed history behavior can still discard them. The hidden DOM is not encrypted storage or a security boundary against someone with local developer-tool access. No persistent copies are written to localStorage, IndexedDB or disk.

Verification: `../progress/evidence/admin-input-protection/acceptance.md`.
