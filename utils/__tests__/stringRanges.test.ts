import { generateOccurrences } from "../generateOccurrences";
import { dayKey } from "../occurrenceDates";
const daily = (date: string) => ({ id: "daily", date, frequency: { value: 1, unit: "days" as const } });
it("includes both date-only boundary days in the local calendar", () => {
  expect(generateOccurrences([daily("2026-11-01")], "2026-11-02", "2026-11-01").map(item => dayKey(item.date))).toEqual(["2026-11-01", "2026-11-02"]);
});
it("excludes the day before a date-only start and includes a one-time item on the end", () => {
  const items = [{ id: "before", date: "2026-10-31" }, { id: "end", date: "2026-11-02" }];
  expect(generateOccurrences(items, "2026-11-02", "2026-11-01").map(item => item.id)).toEqual(["end"]);
});
it.each([
  ["2028-02-28", "2028-03-01", ["2028-02-28", "2028-02-29", "2028-03-01"]],
  ["2026-03-07", "2026-03-09", ["2026-03-07", "2026-03-08", "2026-03-09"]],
] as const)("preserves calendar days from %s through %s", (start, end, expected) => {
  expect(generateOccurrences([daily(start)], end, start).map(item => dayKey(item.date))).toEqual(expected);
});
it("uses the same dates for Date objects and date-only strings", () => {
  const item = daily("2026-11-01");
  const start = new Date(2026, 10, 1), end = new Date(2026, 10, 2);
  const before = [start.getTime(), end.getTime()];
  expect(generateOccurrences([item], end, start)).toEqual(generateOccurrences([item], "2026-11-02", "2026-11-01"));
  expect([start.getTime(), end.getTime()]).toEqual(before);
});
it("handles an omitted start without shifting the date-only end", () => {
  const dates = generateOccurrences([daily("2026-10-01")], "2026-11-02").map(item => dayKey(item.date));
  expect(dates[0]).toBe("2026-10-01"); expect(dates[dates.length - 1]).toBe("2026-11-02");
});
