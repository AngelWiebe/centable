import { FrequencyUnit } from "@/types/frequency";

export const getNextOccurrenceDate = (
    date: Date,
    frequency: { value: number; unit: FrequencyUnit }
  ): Date => {
    const currentDate = new Date();
    const nextDate = new Date(date);
  
    if (nextDate >= currentDate) {
      return nextDate; // Return the original date if it hasn't yet passed
    }
  
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
        break;
    }
  
    return nextDate;
  };
  