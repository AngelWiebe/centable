import { normalizeFrequency } from "../normalizeFrequency";
import { atLocalNoon, dayKey, iterateOccurrences, toLocalDay } from "../occurrenceDates";
import { getNextOccurrenceDate } from "../getNext";
import { generateOccurrences } from "../generateOccurrences";

describe("normalizeFrequency", () => {
  it.each([undefined, null])("keeps a one-time item non-recurring (%s)", (value) => {
    expect(normalizeFrequency(value)).toBeUndefined();
  });

  it.each([0, -1, NaN, Infinity, -Infinity])("defaults invalid interval %s to one", (value) => {
    expect(normalizeFrequency({ value, unit: "weeks" })).toEqual({ value: 1, unit: "weeks" });
  });

  it("normalizes semi-monthly intervals independently of their numeric value", () => {
    expect(normalizeFrequency({ value: 9, unit: "semi-monthly" })).toEqual({ value: 1, unit: "semi-monthly" });
  });

  it("preserves valid intervals without mutating the input", () => {
    const frequency = Object.freeze({ value: 2, unit: "months" as const });
    expect(normalizeFrequency(frequency)).toEqual(frequency);
    expect(normalizeFrequency(frequency)).not.toBe(frequency);
  });
});

describe("calendar occurrence ranges", () => {
  it("reads a date-only string as a local calendar day", () => {
    const date = toLocalDay("2026-11-17");
    expect([date.getFullYear(), date.getMonth(), date.getDate(), date.getHours()]).toEqual([2026, 10, 17, 0]);
    expect(atLocalNoon(date).getHours()).toBe(12);
    expect(dayKey(atLocalNoon(date))).toBe("2026-11-17");
  });

  it("includes both boundary days regardless of their time of day", () => {
    const dates = iterateOccurrences("2026-09-01", { value: 1, unit: "days" }, new Date(2026, 8, 1, 23), new Date(2026, 8, 3));
    expect(dates.map(dayKey)).toEqual(["2026-09-01", "2026-09-02", "2026-09-03"]);
    expect(dates.map(date => date.getHours())).toEqual([12, 12, 12]);
  });

  it("restores a month-end anchor after leap February", () => {
    expect(iterateOccurrences("2028-01-31", { value: 1, unit: "months" }, new Date(2028, 0, 1), new Date(2028, 2, 31)).map(dayKey)).toEqual(["2028-01-31", "2028-02-29", "2028-03-31"]);
  });

  it("keeps two-month intervals aligned across a year boundary", () => {
    expect(iterateOccurrences("2025-11-30", { value: 2, unit: "months" }, new Date(2026, 0, 1), new Date(2026, 4, 31)).map(dayKey)).toEqual(["2026-01-30", "2026-03-30", "2026-05-30"]);
  });

  it("fast-forwards a decades-old daily series without exhausting the step limit", () => {
    expect(iterateOccurrences("1990-01-01", { value: 1, unit: "days" }, new Date(2026, 10, 16), new Date(2026, 10, 18)).map(dayKey)).toEqual(["2026-11-16", "2026-11-17", "2026-11-18"]);
  });

  it.each([[2, 7, "2026-03-07", "2026-03-08", "2026-03-09"], [9, 31, "2026-10-31", "2026-11-01", "2026-11-02"]] as const)("keeps daily dates aligned across daylight saving changes (month %s)", (month, day, first, second, third) => {
    expect(iterateOccurrences(new Date(2026, month, day), { value: 1, unit: "days" }, new Date(2026, month, day), new Date(2026, month, day + 2)).map(dayKey)).toEqual([first, second, third]);
  });

  it("returns no dates for a reversed range or an anchor after the range", () => {
    expect(iterateOccurrences("2026-09-01", undefined, new Date(2026, 8, 2), new Date(2026, 8, 1))).toEqual([]);
    expect(iterateOccurrences("2026-10-01", { value: 1, unit: "weeks" }, new Date(2026, 8, 1), new Date(2026, 8, 30))).toEqual([]);
  });

  it.each([0, -1, NaN, Infinity])("terminates safely for an invalid recurring interval %s", value => {
    expect(iterateOccurrences("2026-09-01", { value, unit: "days" }, new Date(2026, 8, 1), new Date(2026, 8, 30)).map(dayKey)).toEqual(["2026-09-01"]);
  });
});

describe("getNextOccurrenceDate boundaries", () => {
  it("returns the next occurrence strictly after today, restoring the monthly anchor", () => {
    expect(dayKey(getNextOccurrenceDate(new Date(2028, 0, 31), { value: 1, unit: "months" }, new Date(2028, 1, 29, 23)))).toBe("2028-03-31");
  });

  it("keeps a future anchor and does not mutate either input date", () => {
    const anchor = new Date(2026, 11, 31, 16);
    const now = new Date(2026, 10, 17, 10);
    const before = [anchor.getTime(), now.getTime()];
    expect(dayKey(getNextOccurrenceDate(anchor, { value: 1, unit: "months" }, now))).toBe("2026-12-31");
    expect([anchor.getTime(), now.getTime()]).toEqual(before);
  });
});

describe("generateOccurrences inputs", () => {
  it("preserves item metadata and leaves source dates untouched", () => {
    const date = new Date(2026, 8, 1, 9);
    const item = Object.freeze({ id: "pay", date, amount: 123, frequency: { value: 1, unit: "months" as const } });
    const results = generateOccurrences([item], new Date(2026, 9, 1), new Date(2026, 8, 1));
    expect(results.map(result => [result.id, result.amount, dayKey(result.date)])).toEqual([["pay", 123, "2026-09-01"], ["pay", 123, "2026-10-01"]]);
    expect(item.date).toBe(date);
    expect(date.getHours()).toBe(9);
    expect(results[0]).not.toBe(item);
  });
});
