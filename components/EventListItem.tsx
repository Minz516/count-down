"use client";

import { useState } from "react";
import { PencilSimple, Trash } from "@phosphor-icons/react/ssr";
import { clsx } from "clsx";
import type { EventDTO, EventStatusInfo } from "@/modules/events/events.interface";
import { LocalDate } from "./LocalDate";
import { StatusLabel } from "./StatusIndicator";
import { TodoChecklist } from "./TodoChecklist";
import type { TodoDTO } from "@/modules/todos/todos.interface";
import { useT } from "./LocaleProvider";

interface EventListItemProps {
  event: EventDTO;
  status: EventStatusInfo;
  todos: TodoDTO[];
  /** false on the Group Dashboard - group event cards aren't expandable yet. */
  showChecklist?: boolean;
  onEdit: (event: EventDTO) => void;
  onDelete: (event: EventDTO) => void;
}

/** Card content only - the status dot + connecting rail are owned by Timeline. */
export function EventListItem({
  event,
  status,
  todos,
  showChecklist = true,
  onEdit,
  onDelete,
}: EventListItemProps) {
  const t = useT();
  const [checklistExpanded, setChecklistExpanded] = useState(false);

  return (
    // The whole card toggles the checklist - Edit/Delete below stopPropagation
    // so they don't also trigger it. Keyboard-
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
        "flex flex-col rounded-lg border border-primary-container/10 bg-surface-container transition-[transform,background-color,border-color] duration-150 hover:-translate-y-px hover:border-primary-container/20 hover:bg-surface-elevated",
        showChecklist && "cursor-pointer focus-visible:outline-2 focus-visible:outline-primary/50 focus-visible:outline-offset-2",
      )}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-4 sm:px-5">
        <div className="min-w-0 grow basis-64">
          <p className="font-mono text-xs tracking-[0.05em] text-text-muted">
            <LocalDate iso={event.deadline} kind="timeline" />
          </p>
          <p className="line-clamp-2 font-body text-base font-semibold text-on-surface">{event.name}</p>
        </div>

        <StatusLabel status={status.status} daysRemaining={status.daysRemaining} chip />

        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={(clickEvent) => {
              clickEvent.stopPropagation();
              onEdit(event);
            }}
            aria-label={t("event.edit", { name: event.name })}
            className="rounded p-3 text-text-muted transition-colors hover:bg-surface-elevated hover:text-primary sm:p-1.5 focus-visible:outline-2 focus-visible:outline-primary/50 focus-visible:outline-offset-2"
          >
            <PencilSimple aria-hidden="true" size={16} />
          </button>
          <button
            type="button"
            onClick={(clickEvent) => {
              clickEvent.stopPropagation();
              onDelete(event);
            }}
            aria-label={t("event.delete", { name: event.name })}
            className="rounded p-3 text-text-muted transition-colors hover:bg-surface-elevated hover:text-error sm:p-1.5 focus-visible:outline-2 focus-visible:outline-primary/50 focus-visible:outline-offset-2"
          >
            <Trash aria-hidden="true" size={16} />
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
