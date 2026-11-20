import { BudgetCapacityIndex } from "../BudgetCapacityIndex";
it("matches a backward scan across updates, zero balances, and date prefixes", () => {
  let seed = 42;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed; };
  const amounts = Array.from({ length: 73 }, () => random() % 1000 - 100);
  const index = new BudgetCapacityIndex(amounts);
  for (let step = 0; step < 1000; step++) {
    const changed = random() % amounts.length;
    amounts[changed] = random() % 1000 - 100;
    index.update(changed, amounts[changed]);
    const last = random() % (amounts.length + 1) - 1;
    const needed = random() % 1100;
    let expected = last;
    while (expected >= 0 && amounts[expected] < needed) expected--;
    expect(index.findLastAffordable(last, needed)).toBe(expected);
    expect(index.maxThrough(last)).toBe(Math.max(-Infinity, ...amounts.slice(0, last + 1)));
  }
});
it("handles empty income sets", () => {
  const index = new BudgetCapacityIndex([]);
  expect(index.findLastAffordable(-1, 0)).toBe(-1);
  expect(index.maxThrough(-1)).toBe(-Infinity);
});
