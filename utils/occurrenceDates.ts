import { FrequencyInterface } from "../types/frequency";

/** Calendar day in the local timezone, at local midnight. */
export function toLocalDay(value: Date | string): Date {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  const date = value instanceof Date ? value : new Date(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Local noon, so the calendar day survives UTC conversion. */
export function atLocalNoon(value: Date | string): Date {
  const day = toLocalDay(value);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), 12, 0, 0, 0);
}

export function dayKey(value: Date | string): string {
  const day = toLocalDay(value);
  const month = String(day.getMonth() + 1).padStart(2, "0");
  const date = String(day.getDate()).padStart(2, "0");
  return `${day.getFullYear()}-${month}-${date}`;
}

function addMonthsKeepingAnchorDay(
  current: Date,
  months: number,
  anchorDay: number
): Date {
  const monthIndex = current.getMonth() + months;
  const year = current.getFullYear() + Math.floor(monthIndex / 12);
  const month = ((monthIndex % 12) + 12) % 12;
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(anchorDay, lastDay));
}

/**
 * The date of the next occurrence after `current`.
 * Monthly steps keep the anchor day (Jan 31 -> Feb 28 -> Mar 31).
 * Semi-monthly alternates the 1st and the 15th after the anchor date.
 */
export function advanceOccurrence(
  current: Date,
  frequency: FrequencyInterface,
  anchor: Date
): Date | null {
  const value = frequency.value;

  switch (frequency.unit) {
    case "days": {
      if (!Number.isFinite(value) || value <= 0) return null;
      const next = new Date(current);
      next.setDate(next.getDate() + value);
      return toLocalDay(next);
    }
    case "weeks": {
      if (!Number.isFinite(value) || value <= 0) return null;
      const next = new Date(current);
      next.setDate(next.getDate() + value * 7);
      return toLocalDay(next);
    }
    case "months": {
      if (!Number.isFinite(value) || value <= 0) return null;
      return addMonthsKeepingAnchorDay(current, value, anchor.getDate());
    }
    case "semi-monthly": {
      if (current.getDate() < 15) {
        return new Date(current.getFullYear(), current.getMonth(), 15);
      }
      return new Date(current.getFullYear(), current.getMonth() + 1, 1);
    }
    default:
      return null;
  }
}

function calendarDaysBetween(from: Date, to: Date): number {
  const utcFrom = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const utcTo = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((utcTo - utcFrom) / 86400000);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return toLocalDay(next);
}

/** Seek directly to a calendar occurrence without stepping through its history. */
export function firstOccurrenceOnOrAfter(
  anchorInput: Date | string,
  frequency: FrequencyInterface | undefined,
  startInput: Date
): Date | null {
  const anchor = toLocalDay(anchorInput);
  const start = toLocalDay(startInput);
  if (!Number.isFinite(anchor.getTime()) || !Number.isFinite(start.getTime())) return null;
  if (anchor.getTime() >= start.getTime()) return anchor;
  if (!frequency) return null;

  if (frequency.unit === "semi-monthly") {
    if (start.getDate() === 1) return start;
    if (start.getDate() <= 15) return new Date(start.getFullYear(), start.getMonth(), 15);
    return new Date(start.getFullYear(), start.getMonth() + 1, 1);
  }
  if (!Number.isFinite(frequency.value) || frequency.value <= 0) return null;

  if (frequency.unit === "days" || frequency.unit === "weeks") {
    const interval = Math.floor(frequency.value * (frequency.unit === "weeks" ? 7 : 1));
    if (interval < 1) return null;
    const steps = Math.ceil(calendarDaysBetween(anchor, start) / interval);
    return addDays(anchor, steps * interval);
  }
  if (frequency.unit === "months") {
    const interval = Math.floor(frequency.value);
    if (interval < 1) return null;
    const months = (start.getFullYear() - anchor.getFullYear()) * 12 + start.getMonth() - anchor.getMonth();
    const steps = Math.floor(months / interval);
    let current = addMonthsKeepingAnchorDay(anchor, steps * interval, anchor.getDate());
    if (current.getTime() < start.getTime()) {
      current = addMonthsKeepingAnchorDay(current, interval, anchor.getDate());
    }
    return current;
  }
  return null;
}

export function iterateOccurrences(
  anchorInput: Date | string,
  frequency: FrequencyInterface | undefined,
  rangeStart: Date,
  rangeEnd: Date
): Date[] {
  const anchor = toLocalDay(anchorInput);
  const start = toLocalDay(rangeStart);
  const end = toLocalDay(rangeEnd);
  const dates: Date[] = [];

  let current = firstOccurrenceOnOrAfter(anchor, frequency, start);
  if (!current) return dates;

  while (current.getTime() <= end.getTime()) {
    if (current.getTime() >= start.getTime()) {
      dates.push(atLocalNoon(current));
    }

    if (!frequency) break;

    const next = advanceOccurrence(current, frequency, anchor);
    if (!next || next.getTime() <= current.getTime()) break;

    current = next;
  }

  return dates;
}
