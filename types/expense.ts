import { FrequencyInterface } from "./frequency";

export interface ExpenseInterface {
  id: string;
  name: string;
  date: Date;
  frequency: FrequencyInterface | undefined;
  amount: number;
}
