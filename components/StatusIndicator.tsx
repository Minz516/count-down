import { clsx } from "clsx";
import type { EventStatus } from "@/modules/events/events.interface";

// The one legitimate decorative-looking dot in the app - it carries real
// semantic state (see docs/DESIGN.md §8.3), unlike a purely decorative dot.
const DOT_CLASSES: Record<EventStatus, string> = {
  past: "bg-status-past",
  today: "bg-status-today",
  soon: "bg-status-soon",
  later: "bg-text-muted",
};

export function StatusDot({ status }: { status: EventStatus }) {
  return <span aria-hidden className={clsx("size-2 shrink-0 rounded-full", DOT_CLASSES[status])} />;
}

const LABEL_CLASSES: Record<EventStatus, string> = {
  past: "text-status-past",
  today: "text-status-today font-semibold",
  soon: "text-status-soon",
  later: "text-text-muted",
};

/** Color + text label always paired - never color alone (docs/TASTE.md). */
export function StatusLabel({ status, label }: { status: EventStatus; label: string }) {
  return (
    <span
      className={clsx(
        "font-mono text-xs tracking-[0.1em] tabular-nums uppercase",
        LABEL_CLASSES[status],
      )}
    >
      {label}
    </span>
  );
}
