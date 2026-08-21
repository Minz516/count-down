import type { DayOfWeek } from "@/types/event";

const DAY_NAMES_VI: Record<DayOfWeek, string> = {
  0: "Chủ Nhật",
  1: "Thứ Hai",
  2: "Thứ Ba",
  3: "Thứ Tư",
  4: "Thứ Năm",
  5: "Thứ Sáu",
  6: "Thứ Bảy",
};

const DAY_ABBR_VI: Record<DayOfWeek, string> = {
  0: "CN",
  1: "T2",
  2: "T3",
  3: "T4",
  4: "T5",
  5: "T6",
  6: "T7",
};

export function dayOfWeekLabel(day: DayOfWeek): string {
  return DAY_NAMES_VI[day];
}

/** e.g. "November 15, 2024" - used on the Hero Card only. */
export function formatEventDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "2-digit",
    year: "numeric",
  });
}

/** e.g. "T3, 18/08/2026" - short Vietnamese weekday + dd/mm/yyyy, Timeline rows only. */
export function formatTimelineDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  const abbr = DAY_ABBR_VI[d.getDay() as DayOfWeek];

  return `${abbr}, ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

interface DateParts {
  date: string; // yyyy-mm-dd, for an <input type="date">
  time: string; // HH:mm, for an <input type="time">
}

/** Splits an ISO deadline into local date/time parts for the edit form's inputs. */
export function toDateTimeParts(iso: string): DateParts {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");

  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

/** Combines the form's local date + time inputs back into an ISO timestamp. */
export function fromDateTimeParts(date: string, time: string): string {
  return new Date(`${date}T${time}`).toISOString();
}
