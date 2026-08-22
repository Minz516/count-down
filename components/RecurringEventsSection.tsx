"use client";

import { RecurringEventCard } from "./RecurringEventCard";
import type { EventRecord } from "@/types/event";
import type { TodoRecord } from "@/types/todo";

interface RecurringEventsSectionProps {
  events: EventRecord[];
  todosByEvent?: Record<string, TodoRecord[]>;
  /** false on the Group Dashboard - group event cards aren't expandable yet (docs/milestone2/UI_SPEC-milestone-2.md). */
  showChecklist?: boolean;
  onEdit: (event: EventRecord) => void;
  onDelete: (event: EventRecord) => void;
}

/** Pinned separately from the Timeline; does not participate in its sort order (docs/UI_SPEC.md). */
export function RecurringEventsSection({
  events,
  todosByEvent = {},
  showChecklist = true,
  onEdit,
  onDelete,
}: RecurringEventsSectionProps) {
  if (events.length === 0) return null;

  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-display text-xl font-medium text-on-surface">Recurring</h2>
      <div className="flex flex-col gap-3">
        {events.map((event) => (
          <RecurringEventCard
            key={event.id}
            event={event}
            todos={todosByEvent[event.id] ?? []}
            showChecklist={showChecklist}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </div>
    </section>
  );
}
