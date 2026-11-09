import { FrequencyUnit } from "../types/frequency";
import { advanceOccurrence, toLocalDay } from "./occurrenceDates";

export const getNextOccurrenceDate = (
  date: Date,
  frequency: { value: number; unit: FrequencyUnit },
  now: Date = new Date()
): Date => {
  const today = toLocalDay(now);
  const anchor = toLocalDay(date);
  let current = anchor;
  let steps = 0;

  while (current.getTime() <= today.getTime() && steps < 5000) {
    const next = advanceOccurrence(current, frequency, anchor);
    if (!next || next.getTime() <= current.getTime()) break;
    current = next;
    steps += 1;
  }

  return current;
};
