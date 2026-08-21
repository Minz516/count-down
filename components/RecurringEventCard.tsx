"use client";

import { PencilSimple, Trash } from "@phosphor-icons/react/ssr";
import { dayOfWeekLabel } from "@/lib/dateFormat";
import { nextOccurrence, daysUntil } from "@/lib/recurrence";
import type { EventRecord } from "@/types/event";

interface RecurringEventCardProps {
  event: EventRecord;
  onEdit: (event: EventRecord) => void;
  onDelete: (event: EventRecord) => void;
}

export function RecurringEventCard({ event, onEdit, onDelete }: RecurringEventCardProps) {
  if (event.recurrence_day_of_week === null) return null;

  const days = daysUntil(nextOccurrence(event.deadline));

  return (
    // Dashed border distinguishes recurring cards from the Timeline's solid-border rows (docs/UI_SPEC.md).
    <div className="flex items-center gap-3 rounded-lg border border-dashed border-primary-container/30 bg-surface-container px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="font-mono text-xs tracking-[0.1em] text-secondary uppercase">
          Lặp lại - {dayOfWeekLabel(event.recurrence_day_of_week)} hàng tuần
        </p>
        <p className="truncate font-body text-base text-on-surface">{event.name}</p>
      </div>

      <span className="font-mono text-xs tracking-[0.1em] text-primary tabular-nums uppercase">
        còn {days} ngày
      </span>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onEdit(event)}
          aria-label={`Sửa ${event.name}`}
          className="rounded p-1.5 text-text-muted transition-colors hover:bg-surface-elevated hover:text-on-surface"
        >
          <PencilSimple size={16} />
        </button>
        <button
          type="button"
          onClick={() => onDelete(event)}
          aria-label={`Xóa ${event.name}`}
          className="rounded p-1.5 text-text-muted transition-colors hover:bg-surface-elevated hover:text-error"
        >
          <Trash size={16} />
        </button>
      </div>
    </div>
  );
}
