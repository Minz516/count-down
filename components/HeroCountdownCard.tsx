"use client";

import { useCountdown, type Countdown } from "@/lib/useCountdown";
import { LocalDate } from "./LocalDate";
import type { EventDTO } from "@/modules/events/events.interface";
import { useT } from "./LocaleProvider";

const UNITS: { key: keyof Omit<Countdown, "isPast">; label: "hero.days" | "hero.hours" | "hero.minutes" | "hero.seconds" }[] = [
  { key: "days", label: "hero.days" },
  { key: "hours", label: "hero.hours" },
  { key: "minutes", label: "hero.minutes" },
  { key: "seconds", label: "hero.seconds" },
];

export function HeroCountdownCard({ event }: { event: EventDTO }) {
  const t = useT();
  const countdown = useCountdown(event.deadline);

  return (
    <div className="relative overflow-hidden rounded-lg border border-primary-container/15 bg-surface-container bg-gradient-to-b from-primary-container/5 to-transparent px-5 py-10 text-center sm:px-8">
      <h2 className="text-balance font-display text-2xl font-semibold text-on-surface sm:text-[32px]">
        {event.name}
      </h2>
      <p className="mt-2 font-mono text-xs tracking-[0.1em] text-text-muted uppercase">
        <LocalDate iso={event.deadline} kind="date" />, <LocalDate iso={event.deadline} kind="time" />
      </p>

      <div className="mt-8 flex items-start justify-center gap-1 sm:gap-3">
        {UNITS.map(({ key, label }, index) => (
          <div key={key} className="flex items-start">
            {index > 0 && (
              <span
                aria-hidden
                className="font-display text-5xl font-bold text-primary/30 sm:text-6xl lg:text-5xl"
              >
                :
              </span>
            )}
            <div className="flex flex-col items-center">
              <span className="font-display text-5xl font-bold tracking-tight tabular-nums text-primary sm:text-6xl lg:text-5xl">
                {countdown ? String(countdown[key]).padStart(2, "0") : "--"}
              </span>
              <span className="mt-1 font-mono text-xs tracking-[0.1em] text-text-muted uppercase">
                {t(label)}
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
