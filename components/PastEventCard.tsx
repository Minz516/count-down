"use client";

import { useState } from "react";
import { PencilSimple, Trash } from "@phosphor-icons/react/ssr";
import { clsx } from "clsx";
import { formatTimelineDate } from "@/lib/dateFormat";
import { TodoChecklist } from "./TodoChecklist";
import type { EventDTO } from "@/modules/events/events.interface";
import type { TodoDTO } from "@/modules/todos/todos.interface";

interface PastEventCardProps {
  event: EventDTO;
  todos: TodoDTO[];
  /** false on the Group Dashboard - group event cards aren't expandable yet (docs/milestone2/UI_SPEC-milestone-2.md). */
  showChecklist?: boolean;
  onEdit: (event: EventDTO) => void;
  onDelete: (event: EventDTO) => void;
}

/**
 * Compact, de-emphasized row - no status dot/chip since the section itself
 * already conveys "past" (docs/DESIGN.md §8.7). Only ever lives here for the
 * 24h grace window before `supabase/cleanup_and_rollover.sql` hard-deletes it.
 */
export function PastEventCard({ event, todos, showChecklist = true, onEdit, onDelete }: PastEventCardProps) {
  const [checklistExpanded, setChecklistExpanded] = useState(false);

  return (
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
        "flex flex-col rounded border border-transparent bg-surface-container-lowest opacity-70 grayscale transition-opacity hover:opacity-100",
        showChecklist && "cursor-pointer focus-visible:outline-2 focus-visible:outline-primary/50 focus-visible:outline-offset-2",
      )}
    >
      <div className="flex items-center gap-3 px-3 py-2">
        <div className="flex min-w-0 flex-1 items-baseline gap-2">
          <p className="truncate font-body text-sm text-text-muted">{event.name}</p>
          <p className="shrink-0 font-mono text-[11px] text-text-muted/70">
            {formatTimelineDate(event.deadline)}
          </p>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={(clickEvent) => {
              clickEvent.stopPropagation();
              onEdit(event);
            }}
            aria-label={`Sửa ${event.name}`}
            className="rounded p-1 text-text-muted transition-colors hover:bg-surface-elevated hover:text-primary focus-visible:outline-2 focus-visible:outline-primary/50 focus-visible:outline-offset-2"
          >
            <PencilSimple size={14} />
          </button>
          <button
            type="button"
            onClick={(clickEvent) => {
              clickEvent.stopPropagation();
              onDelete(event);
            }}
            aria-label={`Xóa ${event.name}`}
            className="rounded p-1 text-text-muted transition-colors hover:bg-surface-elevated hover:text-error focus-visible:outline-2 focus-visible:outline-primary/50 focus-visible:outline-offset-2"
          >
            <Trash size={14} />
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
