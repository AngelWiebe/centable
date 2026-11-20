import { budgetAtPoint, budgetDragScroll } from "../budgetDrop";
const viewport = { x: 10, y: 100, width: 300, height: 500 };
const targets = [
  { budgetId: "source", x: 10, y: 50, width: 300, height: 200 },
  { budgetId: "empty", x: 10, y: 270, width: 300, height: 150 },
];
it("hits budget cards, including empty ones, but excludes gaps and clipped portions", () => {
  expect(budgetAtPoint(targets, 50, 150, viewport)).toBe("source");
  expect(budgetAtPoint(targets, 50, 300, viewport)).toBe("empty");
  expect(budgetAtPoint(targets, 50, 260, viewport)).toBeNull();
  expect(budgetAtPoint(targets, 50, 80, viewport)).toBeNull();
  expect(budgetAtPoint(targets, 500, 300, viewport)).toBeNull();
});
it("scrolls toward either edge with bounds and leaves central or outside touches alone", () => {
  expect(budgetDragScroll(105, viewport, 100, 1000)).toBeLessThan(100);
  expect(budgetDragScroll(595, viewport, 100, 1000)).toBeGreaterThan(100);
  expect(budgetDragScroll(350, viewport, 100, 1000)).toBe(100);
  expect(budgetDragScroll(90, viewport, 100, 1000)).toBe(100);
  expect(budgetDragScroll(100, viewport, 0, 1000)).toBe(0);
  expect(budgetDragScroll(600, viewport, 500, 1000)).toBe(500);
  expect(budgetDragScroll(600, viewport, 0, 200)).toBe(0);
});
