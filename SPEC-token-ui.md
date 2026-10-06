# Spec: `token-ui` (create and revoke access tokens in Settings)

Part of `SPEC.md`. Depends on: `event-api`. Used by: the owner, to connect Claude Code.

## Objective
Give the owner a safe place in Settings to create a token for Claude Code, copy it once, see which tokens exist and when they were last used, and revoke any of them.

## Behaviour
- New section on `/settings`, below the Discord digest card, headed "Claude Code access" (EN) / Vietnamese equivalent.
- **List:** name, first 8 characters (`cdt_ab12...`), created date, last used (or "never"), status (active, expired, revoked). Revoked tokens stay listed as history.
- **Create:** a button opens a dialog (uses `useDialog`) with a name field and an optional expiry. On success the dialog shows the full token **once**, with a copy button and the ready-to-paste command:
  `claude mcp add --transport http --scope user countdown <site-url>/api/mcp --header "Authorization: Bearer <token>"` (user scope, so it works from the vault folder)
  Closing the dialog clears the token from memory. A clear warning explains it cannot be shown again.
- **Revoke:** `ConfirmDialog` ("Revoke this token? Claude Code will stop working with it"), then the row shows revoked.
- Empty state explains what a token is for in one sentence and how to create the first one.
- Errors (limit of 10 active tokens, network) are shown inline with `role="alert"`.

## Module and data flow
New module `modules/apitokens/` (`interface`, `service`, `repository`, `dto`) following the project layering; the repository calls `create_api_token`, `revoke_api_token` and selects the safe columns. Component `components/ApiTokensSection.tsx` is a client component fed initial data by the settings Server Component.

## Boundaries
- Always: show the token once; clear it on close; EN + VI strings; accessible dialogs and focus handling; confirm before revoking; copy button announces success politely.
- Ask first: storing anything about tokens in Redux or localStorage (default: do not).
- Never: render `token_hash`; log the token; put the token in the URL; persist it anywhere in the browser.

## Acceptance criteria and verification
| # | Criterion | Verified by |
|---|---|---|
| 1 | Creating a token shows it once with the copy command; reopening the section shows only the prefix | manual checklist (signed-in) |
| 2 | The token string is absent from the DOM after the dialog closes | manual check plus component test if feasible |
| 3 | Revoke asks to confirm, then the row shows revoked and the token stops working at `/api/mcp` | manual + contract test |
| 4 | 11th active token is refused with a readable message | manual |
| 5 | Section passes axe in light and dark, EN and VI; no horizontal overflow at 390 px; 44 px touch targets on mobile | extend the axe test where reachable, otherwise manual |
| 6 | Every string exists in `en` and `vi` | type-check (typed messages) |

Files likely touched: `modules/apitokens/*`, `components/ApiTokensSection.tsx`, `app/settings/page.tsx`, `lib/i18n/messages.ts`, `types/` (token entity), tests.
