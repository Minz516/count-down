"use client";

import { useEffect, useState } from "react";

export interface Countdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isPast: boolean;
  /** The timestamp this countdown was computed against - reused by ElapsedProgress. */
  now: number;
}

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function computeCountdown(deadline: string, now: number): Countdown {
  const diff = new Date(deadline).getTime() - now;
  const isPast = diff <= 0;
  const remaining = Math.abs(diff);

  return {
    days: Math.floor(remaining / DAY),
    hours: Math.floor((remaining % DAY) / HOUR),
    minutes: Math.floor((remaining % HOUR) / MINUTE),
    seconds: Math.floor((remaining % MINUTE) / SECOND),
    isPast,
    now,
  };
}

/**
 * Live-ticking D:H:M:S countdown to `deadline`. Starts `null` - identically on
 * the server and the client - and only starts ticking once mounted, so the
 * server-rendered HTML always matches the client's first render (reading the
 * real clock during that first render would make the server's and client's
 * timestamps differ and break hydration). Intended for the Hero Card only
 * (the single nearest event); list items compute "days remaining" once per
 * render instead, to avoid every row re-rendering every second.
 */
export function useCountdown(deadline: string): Countdown | null {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    // Deferred (not called synchronously in the effect body) so the first real
    // value lands on the next tick of the event loop instead of waiting a full
    // second for the interval - still asynchronous, so it can't affect hydration.
    const timeout = setTimeout(tick, 0);
    const interval = setInterval(tick, 1000);
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [deadline]);

  return now === null ? null : computeCountdown(deadline, now);
}
