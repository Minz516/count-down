"use client";

import { PencilSimple, Trash } from "@phosphor-icons/react/ssr";
import type { EventStatusInfo } from "@/modules/events/events.interface";
import { formatTimelineDate } from "@/lib/dateFormat";
import { StatusLabel } from "./StatusIndicator";
import type { EventRecord } from "@/types/event";

interface EventListItemProps {
  event: EventRecord;
  status: EventStatusInfo;
  onEdit: (event: EventRecord) => void;
  onDelete: (event: EventRecord) => void;
}

/** Card content only - the status dot + connecting rail are owned by Timeline (docs/DESIGN.md §8.3). */
export function EventListItem({ event, status, onEdit, onDelete }: EventListItemProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-primary-container/10 bg-surface-container px-5 py-4 transition-[transform,background-color,border-color] duration-150 hover:-translate-y-px hover:border-primary-container/20 hover:bg-surface-elevated">
      <div className="min-w-0 flex-1">
        <p className="font-mono text-xs tracking-[0.05em] text-text-muted">
          {formatTimelineDate(event.deadline)}
        </p>
        <p className="truncate font-body text-base font-semibold text-on-surface">{event.name}</p>
      </div>

      <StatusLabel status={status.status} label={status.label} chip />

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onEdit(event)}
          aria-label={`Sửa ${event.name}`}
          className="rounded p-1.5 text-text-muted transition-colors hover:bg-surface-elevated hover:text-primary focus-visible:outline-2 focus-visible:outline-primary/50 focus-visible:outline-offset-2"
        >
          <PencilSimple size={16} />
        </button>
        <button
          type="button"
          onClick={() => onDelete(event)}
          aria-label={`Xóa ${event.name}`}
          className="rounded p-1.5 text-text-muted transition-colors hover:bg-surface-elevated hover:text-error focus-visible:outline-2 focus-visible:outline-primary/50 focus-visible:outline-offset-2"
        >
          <Trash size={16} />
        </button>
      </div>
    </div>
  );
}
