"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Clock } from "@phosphor-icons/react/ssr";

interface TimeFieldProps {
  /** "" or HH:mm, always 24h. */
  value: string;
  onChange: (value: string) => void;
}

interface TimeParts {
  hour: string;
  minute: string;
}

function splitValue(value: string): TimeParts {
  if (!value) return { hour: "", minute: "" };
  const [hour, minute] = value.split(":");
  return { hour: hour ?? "", minute: minute ?? "" };
}

function composeIfValid({ hour, minute }: TimeParts): string {
  if (hour.length !== 2 || minute.length !== 2) return "";
  return `${hour}:${minute}`;
}

const segmentClass =
  "min-w-0 flex-1 bg-transparent text-center font-body text-base text-on-surface placeholder:text-text-muted focus:outline-none";

/** 24-hour only, no AM/PM control anywhere - bypasses the browser's locale-dependent native time input. */
export function TimeField({ value, onChange }: TimeFieldProps) {
  const [parts, setParts] = useState<TimeParts>(() => splitValue(value));
  const lastEmitted = useRef(value);
  const hourRef = useRef<HTMLInputElement>(null);
  const minuteRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (value !== lastEmitted.current) {
      setParts(splitValue(value));
      lastEmitted.current = value;
    }
  }, [value]);

  function update(next: TimeParts) {
    setParts(next);
    const composed = composeIfValid(next);
    lastEmitted.current = composed;
    onChange(composed);
  }

  function backspaceToPrevious(event: KeyboardEvent<HTMLInputElement>, previous: HTMLInputElement | null) {
    if (event.key === "Backspace" && event.currentTarget.value === "") {
      previous?.focus();
      previous?.select();
    }
  }

  return (
    <div className="flex w-full items-center gap-1.5 rounded border border-transparent bg-surface-container-lowest px-3 py-2 focus-within:border-primary">
      <Clock size={16} className="shrink-0 text-text-muted" aria-hidden />
      <input
        ref={hourRef}
        value={parts.hour}
        onChange={(event) => {
          const hour = event.target.value.replace(/\D/g, "").slice(0, 2);
          update({ ...parts, hour });
          if (hour.length === 2) minuteRef.current?.focus();
        }}
        onBlur={(event) => {
          // Live DOM value, not `parts.hour` - see DateField's onBlur comment for why.
          const raw = event.target.value;
          if (!raw) return;
          const hour = String(Math.min(23, Number(raw))).padStart(2, "0");
          update({ ...parts, hour });
        }}
        inputMode="numeric"
        placeholder="hh"
        aria-label="Giờ"
        maxLength={2}
        className={segmentClass}
      />
      <span aria-hidden className="text-text-muted">
        :
      </span>
      <input
        ref={minuteRef}
        value={parts.minute}
        onChange={(event) => {
          const minute = event.target.value.replace(/\D/g, "").slice(0, 2);
          update({ ...parts, minute });
        }}
        onKeyDown={(event) => backspaceToPrevious(event, hourRef.current)}
        onBlur={(event) => {
          const raw = event.target.value;
          if (!raw) return;
          const minute = String(Math.min(59, Number(raw))).padStart(2, "0");
          update({ ...parts, minute });
        }}
        inputMode="numeric"
        placeholder="mm"
        aria-label="Phút"
        maxLength={2}
        className={segmentClass}
      />
    </div>
  );
}
