"use client";

import { clsx } from "clsx";
import type { EventStatus } from "@/modules/events/events.interface";
import { useT } from "./LocaleProvider";

// The one legitimate decorative-looking dot in the app - it carries real
// semantic state, unlike a purely decorative dot.
const DOT_CLASSES: Record<EventStatus, string> = {
  past: "bg-status-past",
  today: "bg-status-today",
  soon: "bg-status-soon",
  later: "bg-text-muted",
};

const RING_CLASSES: Record<EventStatus, string> = {
  past: "ring-status-past/25",
  today: "ring-status-today/25",
  soon: "ring-status-soon/25",
  later: "ring-text-muted/25",
};

/**
 * Timeline rail dot. `emphasized` marks the single
 * nearest-upcoming row - it renders larger with a soft ring in its own real
 * status color, never forced to a fixed hue, so a "today" row still reads
 * urgent-red even when it's also the nearest one.
 */
export function TimelineDot({ status, emphasized }: { status: EventStatus; emphasized?: boolean }) {
  return (
    <span
      aria-hidden
      className={clsx(
        "shrink-0 rounded-full",
        emphasized ? "size-3.5 ring-4" : "size-2",
        DOT_CLASSES[status],
        emphasized && RING_CLASSES[status],
      )}
    />
  );
}

const LABEL_CLASSES: Record<EventStatus, string> = {
  past: "text-status-past",
  today: "text-status-today font-semibold",
  soon: "text-status-soon",
  later: "text-text-muted",
};

const CHIP_CLASSES: Record<EventStatus, string> = {
  past: "bg-status-past/12 text-status-past",
  today: "bg-status-today/12 text-status-today font-semibold",
  soon: "bg-status-soon/12 text-status-soon",
  later: "bg-text-muted/12 text-text-muted",
};

/** Color + text label always paired - never color alone. */
export function StatusLabel({
  status,
  daysRemaining,
  chip = false,
}: {
  status: EventStatus;
  daysRemaining: number;
  /** Tinted rounded-full background instead of bare colored text. */
  chip?: boolean;
}) {
  const t = useT();
  const label = status === "past" ? t("status.past") : status === "today" ? t("status.today") : t("status.daysLeft", { n: daysRemaining });

  return (
    <span
      className={clsx(
        "font-mono text-xs tracking-[0.1em] tabular-nums uppercase",
        chip ? clsx("whitespace-nowrap rounded-full px-2 py-0.5", CHIP_CLASSES[status]) : LABEL_CLASSES[status],
      )}
    >
      {label}
    </span>
  );
}
