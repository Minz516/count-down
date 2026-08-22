"use client";

import { useState } from "react";
import { PencilSimple, Trash } from "@phosphor-icons/react/ssr";
import { clsx } from "clsx";
import { dayOfWeekLabel } from "@/lib/dateFormat";
import { nextOccurrence, daysUntil } from "@/modules/events/events.interface";
import { TodoChecklist } from "./TodoChecklist";
import type { EventRecord } from "@/types/event";
import type { TodoRecord } from "@/types/todo";

interface RecurringEventCardProps {
  event: EventRecord;
  todos: TodoRecord[];
  /** false on the Group Dashboard - group event cards aren't expandable yet (docs/milestone2/UI_SPEC-milestone-2.md). */
  showChecklist?: boolean;
  onEdit: (event: EventRecord) => void;
  onDelete: (event: EventRecord) => void;
}

export function RecurringEventCard({
  event,
  todos,
  showChecklist = true,
  onEdit,
  onDelete,
}: RecurringEventCardProps) {
  // Before the early return below - hooks can't run conditionally.
  const [checklistExpanded, setChecklistExpanded] = useState(false);

  if (event.recurrence_day_of_week === null) return null;

  const days = daysUntil(nextOccurrence(event.deadline));

  return (
    // Dashed border distinguishes recurring cards from the Timeline's solid-border rows (docs/UI_SPEC.md).
    // The whole card toggles the checklist - Edit/Delete below stopPropagation
    // so they don't also trigger it (docs/UI_SPEC.md "Todo Checklist"). Keyboard-
    // operable too (role/tabIndex/onKeyDown + a visible focus ring), not mouse-only.
    <div
      onClick={showChecklist ? () => setChecklistExpanded((value) => !value) : undefined}
      onKeyDown={
        showChecklist
          ? (keyEvent) => {
              if (keyEvent.key === "Enter" || keyEvent.key === " ") {
                keyEvent.preventDefault();
                setChecklistExpanded((value) => !value);
              }
            }
          : undefined
      }
      role={showChecklist ? "button" : undefined}
      tabIndex={showChecklist ? 0 : undefined}
      aria-expanded={showChecklist ? checklistExpanded : undefined}
      className={clsx(
        "flex flex-col rounded-lg border border-dashed border-primary-container/30 bg-surface-container transition-[transform,background-color,border-color] duration-150 hover:-translate-y-px hover:border-primary-container/50 hover:bg-surface-elevated",
        showChecklist && "cursor-pointer focus-visible:outline-2 focus-visible:outline-primary/50 focus-visible:outline-offset-2",
      )}
    >
      <div className="flex items-center gap-3 px-5 py-4">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-xs tracking-[0.1em] text-secondary uppercase">
            Lặp lại - {dayOfWeekLabel(event.recurrence_day_of_week)} hàng tuần
          </p>
          <p className="truncate font-body text-base font-semibold text-on-surface">{event.name}</p>
        </div>

        <span className="rounded-full bg-primary/12 px-2 py-0.5 font-mono text-xs tracking-[0.1em] text-primary tabular-nums uppercase">
          còn {days} ngày
        </span>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={(clickEvent) => {
              clickEvent.stopPropagation();
              onEdit(event);
            }}
            aria-label={`Sửa ${event.name}`}
            className="rounded p-1.5 text-text-muted transition-colors hover:bg-surface-elevated hover:text-primary focus-visible:outline-2 focus-visible:outline-primary/50 focus-visible:outline-offset-2"
          >
            <PencilSimple size={16} />
          </button>
          <button
            type="button"
            onClick={(clickEvent) => {
              clickEvent.stopPropagation();
              onDelete(event);
            }}
            aria-label={`Xóa ${event.name}`}
            className="rounded p-1.5 text-text-muted transition-colors hover:bg-surface-elevated hover:text-error focus-visible:outline-2 focus-visible:outline-primary/50 focus-visible:outline-offset-2"
          >
            <Trash size={16} />
          </button>
        </div>
      </div>

      {showChecklist && (
        <TodoChecklist
          event={event}
          initialTodos={todos}
          expanded={checklistExpanded}
          onToggleExpanded={() => setChecklistExpanded((value) => !value)}
        />
      )}
    </div>
  );
}
