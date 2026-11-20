import { FrequencyUnit } from "../types/frequency";
import { firstOccurrenceOnOrAfter, toLocalDay } from "./occurrenceDates";

export const getNextOccurrenceDate = (
  date: Date,
  frequency: { value: number; unit: FrequencyUnit },
  now: Date = new Date()
): Date => {
  const afterToday = toLocalDay(now);
  afterToday.setDate(afterToday.getDate() + 1);
  return firstOccurrenceOnOrAfter(date, frequency, afterToday) ?? toLocalDay(date);
};
