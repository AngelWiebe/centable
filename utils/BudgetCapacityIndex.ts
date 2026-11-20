/** Maximum remaining cents per income, with a rightmost-affordable lookup. */
export class BudgetCapacityIndex {
  private readonly size: number;
  private readonly values: number[];
  constructor(amounts: number[]) {
    let size = 1;
    while (size < amounts.length) size *= 2;
    this.size = size;
    this.values = Array(size * 2).fill(-Infinity);
    amounts.forEach((amount, index) => { this.values[size + index] = amount; });
    for (let index = size - 1; index > 0; index--) this.values[index] = Math.max(this.values[index * 2], this.values[index * 2 + 1]);
  }
  update(index: number, amount: number): void {
    let position = this.size + index;
    this.values[position] = amount;
    while (position > 1) {
      position = Math.floor(position / 2);
      this.values[position] = Math.max(this.values[position * 2], this.values[position * 2 + 1]);
    }
  }
  findLastAffordable(last: number, amount: number): number {
    const visit = (node: number, left: number, right: number): number => {
      if (left > last || this.values[node] < amount) return -1;
      if (left === right) return left;
      const middle = Math.floor((left + right) / 2);
      const later = visit(node * 2 + 1, middle + 1, right);
      return later >= 0 ? later : visit(node * 2, left, middle);
    };
    return last < 0 ? -1 : visit(1, 0, this.size - 1);
  }
  maxThrough(last: number): number {
    const visit = (node: number, left: number, right: number): number => {
      if (left > last) return -Infinity;
      if (right <= last) return this.values[node];
      const middle = Math.floor((left + right) / 2);
      return Math.max(visit(node * 2, left, middle), visit(node * 2 + 1, middle + 1, right));
    };
    return last < 0 ? -Infinity : visit(1, 0, this.size - 1);
  }
}
