"use client";

import { AnimatePresence, motion } from "motion/react";
import { EventListItem } from "./EventListItem";
import type { EventRecord } from "@/types/event";

interface TimelineProps {
  events: EventRecord[];
  onEdit: (event: EventRecord) => void;
  onDelete: (event: EventRecord) => void;
}

/**
 * Single continuous list - past, today, and future events together, sorted
 * ascending by deadline (docs/UI_SPEC.md). Add/remove animates as a soft
 * height collapse so the list never jump-cuts (docs/DESIGN.md §7).
 */
export function Timeline({ events, onEdit, onDelete }: TimelineProps) {
  return (
    <ul className="flex flex-col gap-3">
      <AnimatePresence initial={false}>
        {events.map((event) => (
          <motion.li
            key={event.id}
            layout
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            <EventListItem event={event} onEdit={onEdit} onDelete={onDelete} />
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}
