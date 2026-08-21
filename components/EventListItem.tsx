"use client";

import { PencilSimple, Trash } from "@phosphor-icons/react/ssr";
import { clsx } from "clsx";
import { getEventStatus } from "@/lib/eventStatus";
import { formatEventDate } from "@/lib/dateFormat";
import { StatusDot, StatusLabel } from "./StatusIndicator";
import type { EventRecord } from "@/types/event";

interface EventListItemProps {
  event: EventRecord;
  onEdit: (event: EventRecord) => void;
  onDelete: (event: EventRecord) => void;
}

export function EventListItem({ event, onEdit, onDelete }: EventListItemProps) {
  const { status, label } = getEventStatus(event.deadline);
  const isPast = status === "past";

  return (
    <div
      className={clsx(
        "flex items-center gap-3 rounded-lg border border-primary-container/10 bg-surface-container px-4 py-3",
        isPast && "opacity-60 grayscale",
      )}
    >
      <StatusDot status={status} />

      <div className="min-w-0 flex-1">
        <p className="truncate font-body text-base text-on-surface">{event.name}</p>
        <p className="font-body text-sm text-text-muted">{formatEventDate(event.deadline)}</p>
      </div>

      <StatusLabel status={status} label={label} />

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
