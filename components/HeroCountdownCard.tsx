"use client";

import { useCountdown, type Countdown } from "@/lib/useCountdown";
import { formatEventDate, formatEventTime } from "@/lib/dateFormat";
import type { EventDTO } from "@/modules/events/events.interface";

const UNITS: { key: keyof Omit<Countdown, "isPast">; label: string }[] = [
  { key: "days", label: "Days" },
  { key: "hours", label: "Hrs" },
  { key: "minutes", label: "Min" },
  { key: "seconds", label: "Sec" },
];

export function HeroCountdownCard({ event }: { event: EventDTO }) {
  const countdown = useCountdown(event.deadline);

  return (
    <div className="relative overflow-hidden rounded-lg border border-primary-container/15 bg-surface-container bg-gradient-to-b from-primary-container/5 to-transparent px-6 py-10 text-center sm:px-10">
      <h2 className="text-balance font-display text-2xl font-semibold text-on-surface sm:text-[32px]">
        {event.name}
      </h2>
      <p className="mt-2 font-mono text-xs tracking-[0.1em] text-text-muted uppercase">
        {formatEventDate(event.deadline)}, {formatEventTime(event.deadline)}
      </p>

      <div className="mt-8 flex items-start justify-center gap-2 sm:gap-4">
        {UNITS.map(({ key, label }, index) => (
          <div key={key} className="flex items-start">
            {index > 0 && (
              <span
                aria-hidden
                className="font-display text-5xl font-bold text-primary/30 sm:text-[80px]"
              >
                :
              </span>
            )}
            <div className="flex flex-col items-center">
              <span className="font-display text-5xl font-bold tracking-tight tabular-nums text-primary sm:text-[80px]">
                {countdown ? String(countdown[key]).padStart(2, "0") : "--"}
              </span>
              <span className="mt-1 font-mono text-xs tracking-[0.1em] text-text-muted uppercase">
                {label}
              </span>
            </div>
          </div>
        ))}
      </div>

      {event.description && (
        <p className="mx-auto mt-6 max-w-md font-body text-sm text-on-surface-variant">
          {event.description}
        </p>
      )}

      {countdown && (
        <ElapsedProgress createdAt={event.created_at} deadline={event.deadline} now={countdown.now} />
      )}
    </div>
  );
}

/** Nice-to-have per docs/UI_SPEC.md: elapsed time since created_at relative to deadline. */
function ElapsedProgress({
  createdAt,
  deadline,
  now,
}: {
  createdAt: string;
  deadline: string;
  now: number;
}) {
  const total = new Date(deadline).getTime() - new Date(createdAt).getTime();
  if (total <= 0) return null;

  const elapsed = now - new Date(createdAt).getTime();
  const percent = Math.min(100, Math.max(0, (elapsed / total) * 100));

  return (
    <div className="mx-auto mt-6 h-1 w-full max-w-md rounded-full bg-surface-elevated">
      <div
        className="h-full rounded-full bg-primary/70 transition-[width] duration-1000 ease-linear"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
