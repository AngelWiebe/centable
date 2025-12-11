import { FrequencyUnit } from "../types/frequency";

export const getNextOccurrenceDate = (
  date: Date,
  frequency: { value: number; unit: FrequencyUnit }
): Date => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const nextDate = new Date(date);
  nextDate.setHours(0, 0, 0, 0);

  while (nextDate <= today) {
    switch (frequency.unit) {
      case "days":
        nextDate.setDate(nextDate.getDate() + frequency.value);
        break;
      case "weeks":
        nextDate.setDate(nextDate.getDate() + frequency.value * 7);
        break;
      case "months":
        nextDate.setMonth(nextDate.getMonth() + frequency.value);
        break;
      case "semi-monthly":
        if (nextDate.getDate() <= 15) {
          nextDate.setDate(15);
        } else {
          nextDate.setMonth(nextDate.getMonth() + 1);
          nextDate.setDate(1);
        }
        break;
      default:
        throw new Error(`Unsupported frequency unit: ${frequency.unit}`);
    }
  }

  return nextDate;
};
