"use client";

import { PencilSimple, Trash } from "@phosphor-icons/react/ssr";
import { formatTimelineDate } from "@/lib/dateFormat";
import type { EventRecord } from "@/types/event";

interface PastEventCardProps {
  event: EventRecord;
  onEdit: (event: EventRecord) => void;
  onDelete: (event: EventRecord) => void;
}

/**
 * Compact, de-emphasized row - no status dot/chip since the section itself
 * already conveys "past" (docs/DESIGN.md §8.7). Only ever lives here for the
 * 24h grace window before `supabase/cleanup_and_rollover.sql` hard-deletes it.
 */
export function PastEventCard({ event, onEdit, onDelete }: PastEventCardProps) {
  return (
    <div className="flex items-center gap-3 rounded border border-transparent bg-surface-container-lowest px-3 py-2 opacity-70 grayscale transition-opacity hover:opacity-100">
      <div className="flex min-w-0 flex-1 items-baseline gap-2">
        <p className="truncate font-body text-sm text-text-muted">{event.name}</p>
        <p className="shrink-0 font-mono text-[11px] text-text-muted/70">
          {formatTimelineDate(event.deadline)}
        </p>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onEdit(event)}
          aria-label={`Sửa ${event.name}`}
          className="rounded p-1 text-text-muted transition-colors hover:bg-surface-elevated hover:text-primary focus-visible:outline-2 focus-visible:outline-primary/50 focus-visible:outline-offset-2"
        >
          <PencilSimple size={14} />
        </button>
        <button
          type="button"
          onClick={() => onDelete(event)}
          aria-label={`Xóa ${event.name}`}
          className="rounded p-1 text-text-muted transition-colors hover:bg-surface-elevated hover:text-error focus-visible:outline-2 focus-visible:outline-primary/50 focus-visible:outline-offset-2"
        >
          <Trash size={14} />
        </button>
      </div>
    </div>
  );
}
