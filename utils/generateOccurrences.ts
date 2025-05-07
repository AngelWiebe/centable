import { FrequencyInterface } from "@/types/frequency";

export const generateOccurrences = <T extends { id: string, date: string | Date; frequency?: FrequencyInterface }>(
    items: T[],
    endDate: string | Date
  ): T[] => {
    return items.flatMap((item) => {
      const occurrences: T[] = [];
      let occurrenceDate = new Date(item.date);

      while (occurrenceDate <= endDate) {
        occurrences.push({
          ...item,
          id: `${item.id}-${occurrenceDate.toISOString()}`,
          date: new Date(occurrenceDate.getTime()),
        });

        if (!item.frequency) break;

        switch (item.frequency.unit) {
          case "days":
            occurrenceDate.setDate(occurrenceDate.getDate() + item.frequency.value);
            break;
          case "weeks":
            occurrenceDate.setDate(occurrenceDate.getDate() + item.frequency.value * 7);
            break;
          case "months":
            occurrenceDate.setMonth(occurrenceDate.getMonth() + item.frequency.value);
            break;
          case "semi-monthly":
            if (occurrenceDate.getDate() <= 15) {
              occurrenceDate.setDate(15);
            } else {
              occurrenceDate.setDate(1);
              occurrenceDate.setMonth(occurrenceDate.getMonth() + 1);
            }
            break;
          default:
            console.warn(`Unknown frequency unit:`, item.frequency.unit);
            break;
        }
      }

      return occurrences;
    });
  };