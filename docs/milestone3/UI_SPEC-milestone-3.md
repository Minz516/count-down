# UI Specification — Milestone 3: Todo Checklist on Group Events

## Scope
Builds on `UI_SPEC-milestone-2.md` (Group Dashboard). This adds the
expand/checklist behavior that personal events already had since
`UI_SPEC-milestone-1.md`.

## Group Event Card — Now Expandable
- Group event cards in the Timeline gain the same expand/collapse
  interaction as personal event cards from Milestone 1
- Expanding shows the `TodoChecklist` component — identical UI to the
  personal version, same add-item input, checkboxes, and item count

## Personal-Scope Labeling
Because multiple members can each have their own checklist on the same
event, make the personal scope visually explicit:
- Collapsed card header shows "Bạn: 2/5" instead of a bare "2/5", so it's
  clear this reflects the viewer's own progress, not the whole group's
- Optionally, a small caption inside the expanded checklist area, e.g.
  "Đây là checklist của riêng bạn" — a light one-line reminder, not a
  heavy UI element

## No Changes Elsewhere
- Hero Card, Timeline sorting/coloring, Recurring section, Group Settings
  all stay exactly as defined in `UI_SPEC-milestone-2.md`
