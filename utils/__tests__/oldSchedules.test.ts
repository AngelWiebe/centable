import { getNextOccurrenceDate } from "../getNext";
import { dayKey, iterateOccurrences } from "../occurrenceDates";
import { FrequencyInterface } from "../../types/frequency";

const cases: [string, FrequencyInterface, string][] = [
  ["2010-01-01", { value: 1, unit: "days" }, "2026-11-18"],
  ["1800-01-01", { value: 2, unit: "weeks" }, "2026-11-18"],
  ["1600-01-31", { value: 1, unit: "months" }, "2026-11-30"],
  ["1800-01-31", { value: 1, unit: "semi-monthly" }, "2026-12-01"],
];

it.each(cases)("finds the next occurrence of an old %s schedule (%j)", (anchor, frequency, expected) => {
  const now = new Date(2026, 10, 17, 23);
  const date = new Date(`${anchor}T12:00:00`);
  const before = [date.getTime(), now.getTime()];
  const next = getNextOccurrenceDate(date, frequency, now);
  expect(dayKey(next)).toBe(expected);
  expect([date.getTime(), now.getTime()]).toEqual(before);
});

it.each(cases)("generates old %s schedules in the requested range without consuming a historical step limit", (anchor, frequency, expected) => {
  const dates = iterateOccurrences(anchor, frequency, new Date(2026, 10, 18), new Date(2026, 11, 1));
  expect(dayKey(dates[0])).toBe(expected);
});

it("includes today's occurrence in a range but skips it when asking for the next date", () => {
  const frequency: FrequencyInterface = { value: 1, unit: "days" };
  expect(iterateOccurrences("2010-01-01", frequency, new Date(2026, 10, 17), new Date(2026, 10, 17)).map(dayKey)).toEqual(["2026-11-17"]);
  expect(dayKey(getNextOccurrenceDate(new Date(2010, 0, 1), frequency, new Date(2026, 10, 17)))).toBe("2026-11-18");
});

it("keeps a quarterly month-end anchor aligned after skipping centuries", () => {
  const dates = iterateOccurrences("1600-01-31", { value: 3, unit: "months" }, new Date(2026, 10, 1), new Date(2027, 3, 30));
  expect(dates.map(dayKey)).toEqual(["2027-01-31", "2027-04-30"]);
});

it.each([0, -1, NaN, Infinity])("safely retains the anchor for invalid interval %s", value => {
  const anchor = new Date(2010, 0, 1);
  expect(dayKey(getNextOccurrenceDate(anchor, { value, unit: "days" }, new Date(2026, 10, 17)))).toBe("2010-01-01");
});
