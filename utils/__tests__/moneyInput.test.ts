import { normalizeMoneyAmount, parseMoneyInput } from "../money";
it.each(["12.3.4", "1.234", "0.004", "", ".", "-1", "1e3", "Infinity", "NaN", "12 dollars", "9".repeat(400)])("rejects malformed or over-precision input %s", value => {
  expect(parseMoneyInput(value)).toBeNull();
});
it.each([["12.30", 12.3], [".5", 0.5], ["12.", 12], [" 0.00 ", 0], ["001.20", 1.2]] as const)("parses the complete valid amount %s", (value, expected) => {
  expect(parseMoneyInput(value)).toBe(expected);
});
it("normalizes representational noise without accepting hidden fractional cents", () => {
  expect(normalizeMoneyAmount(0.1 + 0.2)).toBe(0.3);
  expect(() => normalizeMoneyAmount(12.345)).toThrow();
  expect(() => normalizeMoneyAmount(Infinity)).toThrow();
  expect(() => normalizeMoneyAmount(-1)).toThrow();
});
it("honors currencies that have no decimal places", () => {
  expect(parseMoneyInput("100", 0)).toBe(100);
  expect(parseMoneyInput("100.5", 0)).toBeNull();
  expect(() => normalizeMoneyAmount(100.5, 0)).toThrow();
});
