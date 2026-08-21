"use client";

import { useEffect, useRef, useState } from "react";
import { CaretLeft, CaretRight } from "@phosphor-icons/react/ssr";
import { clsx } from "clsx";
import { motion, useReducedMotion } from "motion/react";

interface CalendarPopupProps {
  /** "" or yyyy-mm-dd */
  selectedDate: string;
  onSelect: (date: string) => void;
  onClose: () => void;
}

const WEEKDAY_HEADER = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

function parseSelected(selectedDate: string): Date | null {
  if (!selectedDate) return null;
  const d = new Date(`${selectedDate}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toIsoDate(year: number, month: number, day: number): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

/** Month-grid date picker, one visual step brighter than its surrounding surface
 * since this app uses tonal layering instead of shadows to separate it (docs/DESIGN.md §5). */
export function CalendarPopup({ selectedDate, onSelect, onClose }: CalendarPopupProps) {
  const selected = parseSelected(selectedDate);
  const today = new Date();
  const [viewMonth, setViewMonth] = useState(() => selected ?? today);
  const containerRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingBlanks = (new Date(year, month, 1).getDay() + 6) % 7; // Monday-start offset
  const monthLabel = viewMonth.toLocaleDateString("vi-VN", { month: "long", year: "numeric" });

  return (
    <motion.div
      ref={containerRef}
      role="dialog"
      aria-label="Choose date"
      initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.15 }}
      className="absolute top-full left-0 z-20 mt-2 w-64 rounded-lg border border-primary-container/15 bg-surface-container-high p-3"
    >
      <div className="flex items-center justify-between">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => setViewMonth(new Date(year, month - 1, 1))}
          className="rounded p-1 text-text-muted hover:text-on-surface focus-visible:outline-2 focus-visible:outline-primary/50 focus-visible:outline-offset-2"
        >
          <CaretLeft size={16} />
        </button>
        <span className="font-mono text-xs tracking-[0.1em] text-on-surface capitalize">
          {monthLabel}
        </span>
        <button
          type="button"
          aria-label="Next month"
          onClick={() => setViewMonth(new Date(year, month + 1, 1))}
          className="rounded p-1 text-text-muted hover:text-on-surface focus-visible:outline-2 focus-visible:outline-primary/50 focus-visible:outline-offset-2"
        >
          <CaretRight size={16} />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1">
        {WEEKDAY_HEADER.map((label) => (
          <span
            key={label}
            className="flex size-8 items-center justify-center font-mono text-[10px] tracking-[0.05em] text-text-muted uppercase"
          >
            {label}
          </span>
        ))}

        {Array.from({ length: leadingBlanks }, (_, i) => (
          <span key={`blank-${i}`} aria-hidden />
        ))}

        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const iso = toIsoDate(year, month, day);
          const isToday =
            today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
          const isSelected = selectedDate === iso;

          return (
            <button
              key={iso}
              type="button"
              onClick={() => onSelect(iso)}
              className={clsx(
                "size-8 rounded-full font-body text-sm transition-colors",
                "focus-visible:outline-2 focus-visible:outline-primary/50 focus-visible:outline-offset-2",
                isSelected
                  ? "bg-primary-container text-on-surface"
                  : "text-on-surface hover:bg-surface-elevated",
                isToday && !isSelected && "border border-primary/50",
              )}
            >
              {day}
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}
