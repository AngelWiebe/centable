import { FrequencyInterface } from "../types/frequency";

export const generateOccurrences = <
  T extends { id: string; date: string | Date; frequency?: FrequencyInterface }
>(
  items: T[],
  endDate: string | Date
): T[] => {
  const startOfPrevMonth = new Date();
  startOfPrevMonth.setDate(1);
  startOfPrevMonth.setMonth(startOfPrevMonth.getMonth() - 1);
  startOfPrevMonth.setHours(0, 0, 0, 0);

  const end = new Date(endDate);

  return items.flatMap((item) => {
    const occurrences: T[] = [];

    const baseDate = new Date(item.date);
    const startDate = baseDate > startOfPrevMonth ? baseDate : startOfPrevMonth;

    let currentDate = new Date(startDate);

    while (currentDate <= end) {
      const occurrenceDate = new Date(currentDate); // clone

      occurrences.push({
        ...item,
        id: `${item.id}-${occurrenceDate.toISOString()}`, // unique occurrence ID
        date: occurrenceDate,
      });

      if (!item.frequency) break;

      // advance date for next occurrence
      switch (item.frequency.unit) {
        case "days":
          currentDate.setDate(currentDate.getDate() + item.frequency.value);
          break;
        case "weeks":
          currentDate.setDate(currentDate.getDate() + item.frequency.value * 7);
          break;
        case "months":
          currentDate.setMonth(currentDate.getMonth() + item.frequency.value);
          break;
        case "semi-monthly":
          if (currentDate.getDate() <= 15) {
            currentDate.setDate(15);
          } else {
            currentDate.setMonth(currentDate.getMonth() + 1);
            currentDate.setDate(1);
          }
          break;
        default:
          console.warn(`Unknown frequency unit:`, item.frequency.unit);
          return occurrences;
      }
    }

    return occurrences;
  });
};
