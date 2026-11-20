import { FrequencyInterface } from "./frequency";

export interface FinancialEntry {
  id: string;
  name: string;
  date: Date;
  amount: number;
  frequency: FrequencyInterface | undefined;
}

/** Form input can temporarily contain an incomplete recurrence interval. */
export type FinancialEntryDraft = Omit<Partial<FinancialEntry>, "frequency"> & {
  frequency?: Partial<FrequencyInterface>;
};
