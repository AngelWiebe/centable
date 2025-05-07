export interface SettingsInterface {
  theme: "dark" | "light";
  currency: string;
}

export const currencySettings: Record<string, { symbol: string; decimals: number }> = {
  USD: { symbol: "$", decimals: 2 },
  EUR: { symbol: "€", decimals: 2 },
  GBP: { symbol: "£", decimals: 2 },
  JPY: { symbol: "¥", decimals: 0 },
  CAD: { symbol: "$", decimals: 2 },
};