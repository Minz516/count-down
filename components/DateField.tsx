"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { CalendarBlank } from "@phosphor-icons/react/ssr";
import { clsx } from "clsx";
import { CalendarPopup } from "./CalendarPopup";

interface DateFieldProps {
  /** "" or yyyy-mm-dd */
  value: string;
  onChange: (value: string) => void;
}

interface DateParts {
  day: string;
  month: string;
  year: string;
}

function splitValue(value: string): DateParts {
  if (!value) return { day: "", month: "", year: "" };
  const [year, month, day] = value.split("-");
  return { day: day ?? "", month: month ?? "", year: year ?? "" };
}

/** Rejects e.g. 31/02 by round-tripping through Date and checking the parts survived. */
function composeIfValid({ day, month, year }: DateParts): string {
  if (day.length !== 2 || month.length !== 2 || year.length !== 4) return "";

  const dayNum = Number(day);
  const monthNum = Number(month);
  const yearNum = Number(year);
  const d = new Date(yearNum, monthNum - 1, dayNum);

  const isReal = d.getFullYear() === yearNum && d.getMonth() === monthNum - 1 && d.getDate() === dayNum;
  return isReal ? `${year}-${month}-${day}` : "";
}

const segmentClass =
  "bg-transparent text-center font-body text-base text-on-surface placeholder:text-text-muted focus:outline-none";

/** Two ways to set a deadline date: type dd/mm/yyyy directly, or open the calendar (docs/DESIGN.md §8.5). */
export function DateField({ value, onChange }: DateFieldProps) {
  const [parts, setParts] = useState<DateParts>(() => splitValue(value));
  const [open, setOpen] = useState(false);
  const lastEmitted = useRef(value);
  const dayRef = useRef<HTMLInputElement>(null);
  const monthRef = useRef<HTMLInputElement>(null);
  const yearRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (value !== lastEmitted.current) {
      setParts(splitValue(value));
      lastEmitted.current = value;
    }
  }, [value]);

  function update(next: DateParts) {
    setParts(next);
    const composed = composeIfValid(next);
    lastEmitted.current = composed;
    onChange(composed);
  }

  function handleSelect(iso: string) {
    lastEmitted.current = iso;
    setParts(splitValue(iso));
    onChange(iso);
    setOpen(false);
  }

  function backspaceToPrevious(event: KeyboardEvent<HTMLInputElement>, previous: HTMLInputElement | null) {
    if (event.key === "Backspace" && event.currentTarget.value === "") {
      previous?.focus();
      previous?.select();
    }
  }

  return (
    <div className="relative">
      <div className="flex w-full items-center gap-1 rounded border border-transparent bg-surface-container-lowest px-3 py-2 focus-within:border-primary">
        <input
          ref={dayRef}
          value={parts.day}
          onChange={(event) => {
            const day = event.target.value.replace(/\D/g, "").slice(0, 2);
            update({ ...parts, day });
            if (day.length === 2) monthRef.current?.focus();
          }}
          onBlur={(event) => {
            // Read the live DOM value, not `parts.day` - if this blur was triggered by the
            // auto-advance `.focus()` call above, it fires synchronously before React has
            // committed that same keystroke's state update, so the closed-over `parts` is
            // one keystroke stale (see docs/DESIGN.md §8.5).
            const raw = event.target.value;
            if (!raw) return;
            const day = String(Math.min(31, Math.max(1, Number(raw)))).padStart(2, "0");
            update({ ...parts, day });
          }}
          inputMode="numeric"
          placeholder="dd"
          aria-label="Ngày"
          maxLength={2}
          className={clsx(segmentClass, "min-w-0 flex-1")}
        />
        <span aria-hidden className="text-text-muted">
          /
        </span>
        <input
          ref={monthRef}
          value={parts.month}
          onChange={(event) => {
            const month = event.target.value.replace(/\D/g, "").slice(0, 2);
            update({ ...parts, month });
            if (month.length === 2) yearRef.current?.focus();
          }}
          onKeyDown={(event) => backspaceToPrevious(event, dayRef.current)}
          onBlur={(event) => {
            const raw = event.target.value;
            if (!raw) return;
            const month = String(Math.min(12, Math.max(1, Number(raw)))).padStart(2, "0");
            update({ ...parts, month });
          }}
          inputMode="numeric"
          placeholder="mm"
          aria-label="Tháng"
          maxLength={2}
          className={clsx(segmentClass, "min-w-0 flex-1")}
        />
        <span aria-hidden className="text-text-muted">
          /
        </span>
        <input
          ref={yearRef}
          value={parts.year}
          onChange={(event) => {
            const year = event.target.value.replace(/\D/g, "").slice(0, 4);
            update({ ...parts, year });
          }}
          onKeyDown={(event) => backspaceToPrevious(event, monthRef.current)}
          inputMode="numeric"
          placeholder="yyyy"
          aria-label="Năm"
          maxLength={4}
          className={clsx(segmentClass, "min-w-0 flex-[1.6]")}
        />

        <button
          type="button"
          aria-label="Open calendar"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="shrink-0 rounded p-1 text-text-muted hover:text-primary focus-visible:outline-2 focus-visible:outline-primary/50 focus-visible:outline-offset-2"
        >
          <CalendarBlank size={18} />
        </button>
      </div>

      {/* Plain conditional, not AnimatePresence - nested inside EventForm's own
          AnimatePresence, an exit animation here got stuck (opacity:0 but never
          unmounted). A mount-in fade still plays via motion's initial/animate
          without needing AnimatePresence, so only the exit fade is sacrificed. */}
      {open && <CalendarPopup selectedDate={value} onSelect={handleSelect} onClose={() => setOpen(false)} />}
    </div>
  );
}
