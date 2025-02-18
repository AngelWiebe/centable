import { FrequencyInterface } from "./frequency";

export interface IncomeInterface {
  id: string;
  name: string;
  date: Date;
  amount: number;
  frequency: FrequencyInterface | undefined;
}
