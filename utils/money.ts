/** Convert currency amounts to integer cents before doing arithmetic. */
export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

/** Public amounts remain in currency units; only the arithmetic uses cents. */
export function remainingBalance(amount: number, expenses: readonly number[]): number {
  return (toCents(amount) - expenses.reduce((sum, expense) => sum + toCents(expense), 0)) / 100;
}

/** Validate precision and return the canonical amount stored by the app. */
export function normalizeMoneyAmount(amount: number, decimals = 2): number {
  if (!Number.isFinite(amount) || amount < 0 || !Number.isInteger(decimals) || decimals < 0 || decimals > 2) {
    throw new Error("Enter a valid non-negative amount");
  }
  const units = Math.round(amount * 10 ** decimals);
  const normalized = units / 10 ** decimals;
  if (!Number.isSafeInteger(units) || !Number.isSafeInteger(toCents(normalized)) || Math.abs(amount - normalized) > Number.EPSILON * Math.max(1, amount) * 4) {
    throw new Error(`Use no more than ${decimals} decimal places`);
  }
  return normalized;
}

/** Parse the entire input; malformed or over-precision text is never truncated. */
export function parseMoneyInput(text: string, decimals = 2): number | null {
  const value = text.trim();
  const pattern = decimals === 0 ? /^\d+$/ : new RegExp(`^(?:\\d+(?:\\.\\d{0,${decimals}})?|\\.\\d{1,${decimals}})$`);
  if (!pattern.test(value)) return null;
  try { return normalizeMoneyAmount(Number(value), decimals); } catch { return null; }
}
