"use client";

import { useSyncExternalStore } from "react";
import { formatEventDate, formatEventTime, formatTimelineDate } from "@/lib/dateFormat";

const KINDS = {
  date: formatEventDate,
  time: formatEventTime,
  timeline: formatTimelineDate,
} as const;

const subscribeNever = () => () => {};

/**
 * Renders a deadline in the viewer's own time zone. The server doesn't know that zone, so it
 * renders a blank placeholder and the browser fills the real text in after hydration. Formatting
 * on the server would print server-zone times and then mismatch (or silently stay wrong) on the client.
 */
export function LocalDate({ iso, kind }: { iso: string; kind: keyof typeof KINDS }) {
  const isClient = useSyncExternalStore(subscribeNever, () => true, () => false);
  return <>{isClient ? KINDS[kind](iso) : " "}</>;
}
