# Setup Guide — Milestone 3: Todo Checklist on Group Events

## Prerequisites
- Milestone 1 and Milestone 2 already implemented and working

## 1. No New SQL
Nothing to run — `todos` and its RLS policy from Milestone 1 already
support this milestone as-is. See `ARCHITECTURE-milestone-3.md` for why.

## 2. No New Environment Variables

## Suggested Implementation Order (for Claude Code)
1. Add expand/collapse behavior to the group event card component (reuse
   pattern from the personal Timeline in Milestone 1)
2. Mount the existing `TodoChecklist` component inside the expanded group
   event card, passing the current `event_id`
3. Update the collapsed card header to show "Bạn: X/Y" instead of a bare
   count
4. Manually test with two different logged-in accounts joined to the same
   group, on the same event, to confirm each sees only their own
   checklist
5. Polish: loading state while the checklist loads, empty state when a
   member hasn't added any items yet to that event

## This Completes the Planned Feature Set
After this milestone, all three planned phases (personal countdown +
todos, group countdown, per-member group todos) are implemented.
