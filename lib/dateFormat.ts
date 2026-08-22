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

/** e.g. "15/11/2024" - dd/mm/yyyy, the app-wide date display format for viewing. */
export function formatEventDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** e.g. "14:30" - 24-hour hh:mm, the app-wide time display format for viewing. No
 * seconds: deadlines are only ever entered to minute precision (TimeField.tsx has no
 * seconds input), so a literal ":00" would just be noise, not information. */
export function formatEventTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** e.g. "T3, 18/08/2026, 14:30" - short Vietnamese weekday + dd/mm/yyyy + hh:mm, Timeline rows. */
export function formatTimelineDate(iso: string): string {
  const d = new Date(iso);
  const abbr = DAY_ABBR_VI[d.getDay() as DayOfWeek];

  return `${abbr}, ${formatEventDate(iso)}, ${formatEventTime(iso)}`;
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

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** e.g. "5 phút trước" - coarse relative time for the notification bell, not meant for
 * anything precision-sensitive (deadlines/countdowns still use the absolute formatters above). */
export function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();

  if (diffMs < MINUTE_MS) return "vừa xong";
  if (diffMs < HOUR_MS) return `${Math.floor(diffMs / MINUTE_MS)} phút trước`;
  if (diffMs < DAY_MS) return `${Math.floor(diffMs / HOUR_MS)} giờ trước`;
  return `${Math.floor(diffMs / DAY_MS)} ngày trước`;
}
