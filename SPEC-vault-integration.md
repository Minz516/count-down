# Spec: `vault-integration` (making Claude Code push events from the vault flow)

Part of `SPEC.md`. Depends on: `mcp-server`. Lives mostly in the Obsidian vault, not in this repo: this repo ships the setup guide and a copy-paste instruction snippet (`docs/CLAUDE_CODE_EVENTS.md`).

## Objective
Whenever the owner tells Claude Code that an event happens on a date, Claude records it in the vault as it does today and also calls the Countdown tools, with a stable id, safe defaults and honest reporting, without the owner having to remember to ask.

## What gets delivered
1. **Setup guide** (`docs/CLAUDE_CODE_EVENTS.md`): create a token in Settings, run the `claude mcp add` command, check with `/mcp`, rotate or revoke a token.
2. **Instruction snippet** to paste into the vault's `CLAUDE.md` (or save as a skill) that tells Claude:
   - **When:** the owner states or changes an event with a date or deadline, or cancels one.
   - **Dates:** resolve "next Friday" or "tomorrow" to an absolute `YYYY-MM-DD` using today's date before calling any tool. If the date is ambiguous, ask first.
   - **Time:** pass a time only if the owner gave one; otherwise leave it (the server uses 23:59 Asia/Ho_Chi_Minh). Pass `timezone` only if the owner names another zone.
   - **Stable id:** keep a `countdown_id` property in the note's frontmatter. First time, create it from the note path and event title (for example `vault:Personal/Passport.md#appointment`). Every later change reuses it, so the tool updates instead of duplicating.
   - **Order:** update the vault note, then call `create_event`. Report both results in one short line (what was written, where, local date and time).
   - **Delete:** never call `delete_event` without first asking the owner and getting a yes in this conversation; then pass `confirm: true`.
   - **Failure:** if the tool fails or times out, say clearly that the website was NOT updated and why; do not retry in a loop and do not claim success.
   - **Before creating without an id:** call `list_events` with the title and date to avoid a duplicate.
3. **Graphify note:** the frontmatter id is a normal property, so Graphify indexes it; no change to the graph pipeline is required.

## Boundaries
- Always: confirm outcomes to the owner; keep the vault the source of truth; pass `external_id`.
- Ask first: any bulk operation (importing many existing notes), changing the id scheme, deleting.
- Never: write a token into a vault note or any file that syncs or is committed; guess a date; delete silently.

## Acceptance criteria (manual scenarios, run with real Claude Code and a test token)
| # | Scenario | Expected |
|---|---|---|
| 1 | "My passport appointment is on 20 November" | Note updated with `countdown_id`; one event on the site, 20/11, 23:59 |
| 2 | "It is at 9:30 AM" | Same event now 09:30, no duplicate |
| 3 | Repeat scenario 1 in a new session | Still one event (list_events or the stored id prevents a duplicate) |
| 4 | "Move it to the 25th" | Same event moves to 25 November |
| 5 | "Cancel the passport appointment" | Claude asks to confirm, deletes only after yes; note marked cancelled |
| 6 | "Every Monday I have a team standup" | Weekly event on Monday, next occurrence date |
| 7 | Website unreachable | Claude reports the website was not updated; vault still updated |
| 8 | Revoked token | Claude reports an auth error and tells the owner to create a new token |
| 9 | "Next Friday" on a Friday | Claude states the absolute date it picked, or asks |

Files likely touched: `docs/CLAUDE_CODE_EVENTS.md` (new). The vault files are changed by the owner, outside this repo.
