export type DropRect = { x: number; y: number; width: number; height: number };
export type BudgetDropRect = DropRect & { budgetId: string };

export function budgetAtPoint(targets: BudgetDropRect[], x: number, y: number, viewport: DropRect): string | null {
  const contains = (rect: DropRect) => x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
  if (!contains(viewport)) return null;
  return targets.find(contains)?.budgetId ?? null;
}

/** Scroll speed ramps up near the viewport edges; outside touches cannot scroll. */
export function budgetDragScroll(y: number, viewport: DropRect, offset: number, contentHeight: number): number {
  if (y < viewport.y || y > viewport.y + viewport.height) return offset;
  const edge = Math.min(70, viewport.height / 3);
  const top = Math.max(0, 1 - (y - viewport.y) / edge);
  const bottom = Math.max(0, 1 - (viewport.y + viewport.height - y) / edge);
  return Math.max(0, Math.min(Math.max(0, contentHeight - viewport.height), offset + (bottom - top) * 14));
}
