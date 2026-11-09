import { FrequencyInterface } from "../types/frequency";
import { iterateOccurrences } from "./occurrenceDates";

export const generateOccurrences = <
  T extends { id: string; date: string | Date; frequency?: FrequencyInterface }
>(
  items: T[],
  endDate: string | Date,
  startDate?: string | Date
): T[] => {
  const rangeEnd = new Date(endDate);
  const rangeStart = startDate
    ? new Date(startDate)
    : new Date(rangeEnd.getFullYear(), rangeEnd.getMonth() - 1, 1);

  return items.flatMap((item) =>
    iterateOccurrences(item.date, item.frequency, rangeStart, rangeEnd).map(
      (occurrenceDate) => ({
        ...item,
        date: occurrenceDate,
      })
    )
  );
};
