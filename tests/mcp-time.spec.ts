import { expect, test } from "@playwright/test";
import { formatLocal, nextWeeklyOccurrence, toUtcInstant, weekdayIn } from "@/lib/mcp/time";
import { ValidationError } from "@/modules/shared/errors";

// T4: turning "20 November" (and optionally a time and a zone) into the exact instant stored in the
// database. The owner is in Vietnam (UTC+7, no daylight saving) but the server runs in UTC, so every
// conversion names its zone explicitly and never relies on the runtime's own.

const HCM = "Asia/Ho_Chi_Minh";

test.describe("toUtcInstant", () => {
  test("a date alone becomes 23:59 Ho Chi Minh time, which is 16:59 UTC", () => {
    const result = toUtcInstant({ date: "2026-11-20" });
    expect(result.utc).toBe("2026-11-20T16:59:00.000Z");
    expect(result.local).toBe("2026-11-20 23:59");
    expect(result.timezone).toBe(HCM);
  });

  test("an explicit time is used as local time", () => {
    expect(toUtcInstant({ date: "2026-11-20", time: "09:30" }).utc).toBe("2026-11-20T02:30:00.000Z");
    expect(toUtcInstant({ date: "2026-11-20", time: "00:00" }).utc).toBe("2026-11-19T17:00:00.000Z");
  });

  test("another zone is honoured, including daylight saving", () => {
    expect(toUtcInstant({ date: "2026-12-01", time: "09:00", timezone: "America/New_York" }).utc).toBe("2026-12-01T14:00:00.000Z");
    expect(toUtcInstant({ date: "2026-07-01", time: "09:00", timezone: "America/New_York" }).utc).toBe("2026-07-01T13:00:00.000Z");
    expect(toUtcInstant({ date: "2026-07-01", time: "09:00", timezone: "UTC" }).utc).toBe("2026-07-01T09:00:00.000Z");
  });

  test("the server's own time zone has no influence", () => {
    const original = process.env.TZ;
    try {
      for (const zone of ["UTC", "America/Los_Angeles", "Asia/Tokyo"]) {
        process.env.TZ = zone;
        expect(toUtcInstant({ date: "2026-11-20" }).utc, zone).toBe("2026-11-20T16:59:00.000Z");
      }
    } finally {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    }
  });

  test("a local time that does not exist (daylight saving gap) is rejected", () => {
    expect(() => toUtcInstant({ date: "2026-03-08", time: "02:30", timezone: "America/New_York" })).toThrow("Invalid input: time");
  });

  test("a local time that happens twice (daylight saving overlap) uses the first occurrence", () => {
    expect(toUtcInstant({ date: "2026-11-01", time: "01:30", timezone: "America/New_York" }).utc).toBe("2026-11-01T05:30:00.000Z");
  });

  test("impossible or malformed dates are rejected with the field named", () => {
    for (const date of ["2026-02-31", "2026-13-01", "2026-00-10", "20-11-2026", "2026-2-3", "", "tomorrow", "2026-11-20T10:00"]) {
      expect(() => toUtcInstant({ date }), date).toThrow("Invalid input: date");
    }
    expect(() => toUtcInstant({ date: "2026-02-29" })).toThrow("Invalid input: date"); // 2026 is not a leap year
    expect(toUtcInstant({ date: "2028-02-29" }).utc).toBe("2028-02-29T16:59:00.000Z"); // 2028 is
  });

  test("malformed times are rejected", () => {
    for (const time of ["24:00", "9:30", "12:60", "abc", "", "12:5", "12:30:00"]) {
      expect(() => toUtcInstant({ date: "2026-11-20", time }), time).toThrow("Invalid input: time");
    }
  });

  test("unknown or empty zones are rejected", () => {
    for (const timezone of ["Mars/Phobos", "", "Vietnam", "UTC+7"]) {
      expect(() => toUtcInstant({ date: "2026-11-20", timezone }), timezone).toThrow("Invalid input: timezone");
    }
  });

  test("failures are ValidationError so the route can show them as input errors", () => {
    try {
      toUtcInstant({ date: "nope" });
      throw new Error("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
    }
  });
});

test.describe("formatLocal and weekdayIn", () => {
  test("show an instant as local wall time and weekday in the zone", () => {
    expect(formatLocal("2026-11-20T16:59:00.000Z", HCM)).toBe("2026-11-20 23:59");
    expect(formatLocal("2026-11-20T17:00:00.000Z", HCM)).toBe("2026-11-21 00:00");
    expect(weekdayIn("2026-11-20T16:59:00.000Z", HCM)).toBe(5); // Friday
    expect(weekdayIn("2026-11-20T17:00:00.000Z", HCM)).toBe(6); // Saturday, though still Friday in UTC
  });
});

test.describe("nextWeeklyOccurrence", () => {
  // Monday 5 October 2026, 17:00 in Ho Chi Minh (10:00 UTC).
  const mondayAfternoon = new Date("2026-10-05T10:00:00Z");

  test("later today when the weekday matches and the time is still ahead", () => {
    expect(nextWeeklyOccurrence({ dayOfWeek: 1, from: mondayAfternoon })).toBe("2026-10-05T16:59:00.000Z");
  });

  test("next week when the weekday matches but the time has passed", () => {
    expect(nextWeeklyOccurrence({ dayOfWeek: 1, time: "09:00", from: mondayAfternoon })).toBe("2026-10-12T02:00:00.000Z");
  });

  test("uses the LOCAL weekday, not the UTC one (the bug the existing browser helper would have on a UTC server)", () => {
    // 00:30 on Tuesday in Ho Chi Minh is still 17:30 UTC on Monday.
    const justAfterMidnightLocal = new Date("2026-10-05T17:30:00Z");
    expect(nextWeeklyOccurrence({ dayOfWeek: 1, from: justAfterMidnightLocal })).toBe("2026-10-12T16:59:00.000Z");
    expect(nextWeeklyOccurrence({ dayOfWeek: 2, from: justAfterMidnightLocal })).toBe("2026-10-06T16:59:00.000Z");
  });

  test("a Tuesday 03:00 event lands on Tuesday locally even though that is Monday in UTC", () => {
    const result = nextWeeklyOccurrence({ dayOfWeek: 2, time: "03:00", from: mondayAfternoon });
    expect(result).toBe("2026-10-05T20:00:00.000Z");
    expect(weekdayIn(result, HCM)).toBe(2);
    expect(new Date(result).getUTCDay()).toBe(1); // Monday in UTC: why a UTC-based helper would be wrong
  });

  test("every weekday resolves within the next 7 days and lands on that weekday locally", () => {
    for (let day = 0; day <= 6; day++) {
      const result = nextWeeklyOccurrence({ dayOfWeek: day as 0 | 1 | 2 | 3 | 4 | 5 | 6, time: "08:15", from: mondayAfternoon });
      const delta = new Date(result).getTime() - mondayAfternoon.getTime();
      expect(delta, `day ${day}`).toBeGreaterThan(0);
      expect(delta, `day ${day}`).toBeLessThanOrEqual(7 * 24 * 3600 * 1000);
      expect(weekdayIn(result, HCM), `day ${day}`).toBe(day);
      expect(formatLocal(result, HCM).slice(11), `day ${day}`).toBe("08:15");
    }
  });

  test("another zone is honoured", () => {
    // In October New York is on daylight saving time (UTC-4), so Monday 10:00 there is 14:00 UTC.
    const result = nextWeeklyOccurrence({ dayOfWeek: 1, time: "10:00", timezone: "America/New_York", from: new Date("2026-10-05T13:00:00Z") });
    expect(result).toBe("2026-10-05T14:00:00.000Z");
  });

  test("invalid weekdays, times and zones are rejected", () => {
    for (const dayOfWeek of [7, -1, 1.5, Number.NaN]) {
      expect(() => nextWeeklyOccurrence({ dayOfWeek: dayOfWeek as 0, from: mondayAfternoon }), String(dayOfWeek)).toThrow("Invalid input: day of week");
    }
    expect(() => nextWeeklyOccurrence({ dayOfWeek: 1, time: "25:00", from: mondayAfternoon })).toThrow("Invalid input: time");
    expect(() => nextWeeklyOccurrence({ dayOfWeek: 1, timezone: "Mars/Phobos", from: mondayAfternoon })).toThrow("Invalid input: timezone");
  });
});
