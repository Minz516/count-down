"use client";

import { AnimatePresence, motion } from "motion/react";
import { EventListItem } from "./EventListItem";
import { TimelineDot } from "./StatusIndicator";
import { getEventStatus } from "@/modules/events/events.interface";
import type { EventRecord } from "@/types/event";
import type { TodoRecord } from "@/types/todo";

interface TimelineProps {
  /** Today/soon/later events only - past events live in PastEventsSection instead (docs/UI_SPEC.md). */
  events: EventRecord[];
  todosByEvent?: Record<string, TodoRecord[]>;
  /** false on the Group Dashboard - group event cards aren't expandable yet (docs/milestone2/UI_SPEC-milestone-2.md). */
  showChecklist?: boolean;
  onEdit: (event: EventRecord) => void;
  onDelete: (event: EventRecord) => void;
}

/**
 * Today and future events, sorted ascending by deadline (docs/UI_SPEC.md). Rows
 * are connected by a vertical rail: each row draws its own line segment down to
 * the next row's dot, so segments compose into one continuous line with no
 * measurement/JS and no glitching during add/remove (docs/DESIGN.md §8.3).
 * Add/remove animates as a soft height collapse so the list never jump-cuts
 * (docs/DESIGN.md §7).
 */
export function Timeline({ events, todosByEvent = {}, showChecklist = true, onEdit, onDelete }: TimelineProps) {
  // events is already sorted ascending and never contains past events - the
  // first row is always "nearest upcoming".
  const nearestUpcomingId = events[0]?.id ?? null;

  return (
    <ul className="flex flex-col">
      <AnimatePresence initial={false}>
        {events.map((event, index) => {
          const status = getEventStatus(event.deadline);

          return (
            <motion.li
              key={event.id}
              layout
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="flex gap-4"
            >
              <div className="flex flex-col items-center pt-5">
                <TimelineDot status={status.status} emphasized={event.id === nearestUpcomingId} />
                {index < events.length - 1 && <div className="mt-1 w-px flex-1 bg-outline-variant/30" />}
              </div>

              <div className="flex-1 pb-3">
                <EventListItem
                  event={event}
                  status={status}
                  todos={todosByEvent[event.id] ?? []}
                  showChecklist={showChecklist}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              </div>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ul>
  );
}
