export type FrequencyUnit = "days" | "weeks" | "months" | "semi-monthly";

export interface FrequencyInterface {
  value: number;
  unit: FrequencyUnit;
}
