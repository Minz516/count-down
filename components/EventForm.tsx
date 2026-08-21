"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { X } from "@phosphor-icons/react/ssr";
import { motion } from "motion/react";
import { Button } from "./Button";
import { DateField } from "./DateField";
import { TimeField } from "./TimeField";
import { dayOfWeekLabel, fromDateTimeParts, toDateTimeParts } from "@/lib/dateFormat";
import type { DayOfWeek, EventInput, EventRecord } from "@/types/event";

interface EventFormProps {
  initialEvent?: EventRecord;
  onSubmit: (input: EventInput) => Promise<void>;
  onCancel: () => void;
}

const inputClass =
  "w-full rounded border border-transparent bg-surface-container-lowest px-3 py-2 font-body text-base text-on-surface placeholder:text-text-muted focus:border-primary focus:outline-none";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-mono text-xs font-medium tracking-[0.1em] text-text-muted uppercase">
        {label}
      </span>
      {children}
    </label>
  );
}

export function EventForm({ initialEvent, onSubmit, onCancel }: EventFormProps) {
  const initialParts = initialEvent ? toDateTimeParts(initialEvent.deadline) : { date: "", time: "" };

  const [name, setName] = useState(initialEvent?.name ?? "");
  const [date, setDate] = useState(initialParts.date);
  const [time, setTime] = useState(initialParts.time);
  const [description, setDescription] = useState(initialEvent?.description ?? "");
  const [isRecurring, setIsRecurring] = useState(initialEvent?.is_recurring ?? false);
  const [dayOfWeek, setDayOfWeek] = useState<DayOfWeek>(initialEvent?.recurrence_day_of_week ?? 0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A one-time reference is enough here - this warning doesn't need to tick while the form is open.
  const [now] = useState(() => Date.now());
  const deadlineIso = date && time ? fromDateTimeParts(date, time) : null;
  const isPastDeadline = deadlineIso !== null && new Date(deadlineIso).getTime() < now;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (!name.trim() || !deadlineIso) {
      setError("Name and deadline are required.");
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      await onSubmit({
        name: name.trim(),
        deadline: deadlineIso,
        description: description.trim() || null,
        is_recurring: isRecurring,
        recurrence_day_of_week: isRecurring ? dayOfWeek : null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-deep/70 px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.15 }}
        className="w-full max-w-md rounded-lg border border-primary-container/15 bg-surface-container p-6"
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-display text-xl font-semibold text-on-surface">
              {initialEvent ? "Edit Event" : "New Event"}
            </h2>
            <p className="mt-1 font-body text-sm text-text-muted">Define your next milestone.</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close"
            className="rounded p-1 text-text-muted hover:text-on-surface focus-visible:outline-2 focus-visible:outline-primary/50 focus-visible:outline-offset-2"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <Field label="Event Name">
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Project Launch"
              required
              className={inputClass}
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Deadline Date">
              <DateField value={date} onChange={setDate} />
            </Field>
            <Field label="Deadline Time">
              <TimeField value={time} onChange={setTime} />
            </Field>
          </div>

          {isPastDeadline && (
            <p className="font-body text-sm text-accent-warning">
              This deadline is in the past. You can still save it.
            </p>
          )}

          <Field label="Description (optional)">
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Add some context..."
              rows={3}
              className={inputClass}
            />
          </Field>

          <label className="flex items-center gap-2 font-body text-sm text-on-surface">
            <input
              type="checkbox"
              checked={isRecurring}
              onChange={(event) => setIsRecurring(event.target.checked)}
              className="size-4 rounded border-outline-variant bg-surface-container-lowest accent-primary-container"
            />
            Repeats weekly
          </label>

          {isRecurring && (
            <Field label="Day of week">
              <select
                value={dayOfWeek}
                onChange={(event) => setDayOfWeek(Number(event.target.value) as DayOfWeek)}
                className={inputClass}
              >
                {([0, 1, 2, 3, 4, 5, 6] as const).map((day) => (
                  <option key={day} value={day}>
                    {dayOfWeekLabel(day)}
                  </option>
                ))}
              </select>
            </Field>
          )}

          {error && <p className="font-body text-sm text-error">{error}</p>}

          <div className="mt-2 flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
