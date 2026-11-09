import { FrequencyInterface } from "../types/frequency";

/** A missing or zero interval still repeats; semi-monthly does not use the number. */
export function normalizeFrequency(
  frequency?: FrequencyInterface | null
): FrequencyInterface | undefined {
  if (!frequency?.unit) return undefined;

  if (frequency.unit === "semi-monthly") {
    return { value: 1, unit: "semi-monthly" };
  }

  const value = frequency.value;
  if (!Number.isFinite(value) || value <= 0) {
    return { value: 1, unit: frequency.unit };
  }

  return { value, unit: frequency.unit };
}
