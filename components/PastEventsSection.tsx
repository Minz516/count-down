"use client";

import { PastEventCard } from "./PastEventCard";
import type { EventRecord } from "@/types/event";

interface PastEventsSectionProps {
  events: EventRecord[];
  onEdit: (event: EventRecord) => void;
  onDelete: (event: EventRecord) => void;
}

/**
 * Compact tracking area for events whose deadline just passed - pulled out of
 * the main Timeline (docs/UI_SPEC.md) and pinned at the bottom of the page,
 * below Recurring, since it's the most transient content on the dashboard.
 * Self-bounding: events only sit here for the 24h grace window before the
 * cleanup cron hard-deletes them, at which point this section disappears on
 * its own - same lifecycle as before, just relocated.
 */
export function PastEventsSection({ events, onEdit, onDelete }: PastEventsSectionProps) {
  if (events.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-mono text-xs font-medium tracking-[0.1em] text-text-muted uppercase">Past</h2>
      <div className="flex flex-col gap-2">
        {events.map((event) => (
          <PastEventCard key={event.id} event={event} onEdit={onEdit} onDelete={onDelete} />
        ))}
      </div>
    </section>
  );
}
