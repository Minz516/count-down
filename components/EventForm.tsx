"use client";

import { useId, useState, type FormEvent, type ReactNode } from "react";
import { X } from "@phosphor-icons/react/ssr";
import { motion } from "motion/react";
import { Button } from "./Button";
import { DateField } from "./DateField";
import { TimeField } from "./TimeField";
import {
  dayOfWeekLabel,
  fromDateTimeParts,
  nextDeadlineForDayOfWeek,
  toDateTimeParts,
} from "@/lib/dateFormat";
import type { DayOfWeek, EventDTO, EventInput } from "@/modules/events/events.interface";
import { useDialog } from "@/lib/useDialog";
import { useLocale, useT } from "./LocaleProvider";

interface EventFormProps {
  initialEvent?: EventDTO;
  onSubmit: (input: EventInput) => Promise<void>;
  onCancel: () => void;
}

const inputClass =
  "w-full rounded border border-transparent bg-surface-container-lowest px-3 py-2 font-body text-base text-on-surface placeholder:text-text-muted focus:border-primary focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary/50";

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
  const t = useT();
  const locale = useLocale();
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
  // A weekly event has no calendar date - its deadline is the next occurrence of the chosen
  // weekday + time, always computed forward, so it can never land in the past.
  const deadlineIso = isRecurring
    ? time
      ? nextDeadlineForDayOfWeek(dayOfWeek, time)
      : null
    : date && time
      ? fromDateTimeParts(date, time)
      : null;
  const isPastDeadline =
    !isRecurring && deadlineIso !== null && new Date(deadlineIso).getTime() < now;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (!name.trim() || !deadlineIso) {
      setError(isRecurring ? t("event.errorNameTime") : t("event.errorNameDeadline"));
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
      setError(err instanceof Error ? t.text(err.message) : t("error.generic"));
      setSubmitting(false);
    }
  }

  const titleId = useId();
  const dialogRef = useDialog<HTMLDivElement>(onCancel);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overscroll-contain bg-surface-deep/70 px-4">
      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.15 }}
        className="w-full max-w-md rounded-lg border border-primary-container/15 bg-surface-container p-6"
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 id={titleId} className="text-balance font-display text-xl font-semibold text-on-surface">
              {initialEvent ? t("event.editTitle") : t("event.new")}
            </h2>
            <p className="mt-1 font-body text-sm text-text-muted">{t("event.subtitle")}</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label={t("common.close")}
            className="rounded p-3 text-text-muted hover:text-on-surface focus-visible:outline-2 focus-visible:outline-primary/50 focus-visible:outline-offset-2"
          >
            <X aria-hidden="true" size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <Field label={t("event.name")}>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t("event.namePlaceholder")}
              name="name"
              autoComplete="off"
              required
              maxLength={200}
              className={inputClass}
            />
          </Field>

          <label className="flex items-center gap-2 font-body text-sm text-on-surface">
            <input
              type="checkbox"
              name="is_recurring"
              checked={isRecurring}
              onChange={(event) => setIsRecurring(event.target.checked)}
              className="size-4 rounded border-outline-variant bg-surface-container-lowest accent-primary-container"
            />
            {t("event.repeatsWeekly")}
          </label>

          <div className="grid grid-cols-2 gap-4">
            {/* A weekly event repeats on a weekday, so it collects a Day of week instead of a
                calendar date - the deadline date is derived from it (see deadlineIso above). */}
            <Field label={isRecurring ? t("event.dayOfWeek") : t("event.deadlineDate")}>
              {isRecurring ? (
                <select
                  name="recurrence_day_of_week"
                  value={dayOfWeek}
                  onChange={(event) => setDayOfWeek(Number(event.target.value) as DayOfWeek)}
                  className={`${inputClass} [&>option]:bg-surface-container [&>option]:text-on-surface`}
                >
                  {([0, 1, 2, 3, 4, 5, 6] as const).map((day) => (
                    <option key={day} value={day}>
                      {dayOfWeekLabel(day, locale)}
                    </option>
                  ))}
                </select>
              ) : (
                <DateField value={date} onChange={setDate} />
              )}
            </Field>
            <Field label={t("event.deadlineTime")}>
              <TimeField value={time} onChange={setTime} />
            </Field>
          </div>

          {isPastDeadline && (
            <p className="font-body text-sm text-accent-warning">
              {t("event.pastWarning")}
            </p>
          )}

          <Field label={t("event.description")}>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={t("event.descriptionPlaceholder")}
              name="description"
              autoComplete="off"
              rows={3}
              maxLength={2000}
              className={inputClass}
            />
          </Field>

          {error && <p role="alert" className="font-body text-sm text-error">{error}</p>}

          <div className="mt-2 flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={onCancel}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? t("common.saving") : initialEvent ? t("event.saveChanges") : t("event.save")}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
