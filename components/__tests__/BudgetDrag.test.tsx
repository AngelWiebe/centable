import React, { useContext, useEffect } from "react";
import TestRenderer, { act } from "react-test-renderer";
import { AccessibilityInfo, Alert } from "react-native";
import { BudgetDragContext, BudgetDragListContext, BudgetDragProvider, BudgetDropTarget, type BudgetDragControls } from "../BudgetDragContext";
import DraggableExpenseRow from "../DraggableExpenseRow";
import { BudgetScrollContext } from "../BudgetScrollContext";
import useBudgetStore from "../../store/useBudgetStore";
import { makeExpense, makeIncome } from "../../test/fixtures";
import { useAnimatedStyle } from "react-native-reanimated";
import type { SharedValue } from "react-native-reanimated";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
jest.mock("../../store/useBudgetStore", () => ({ __esModule: true, default: Object.assign(jest.fn(), { getState: jest.fn() }) }));
jest.mock("react-native", () => ({
  AccessibilityInfo: { announceForAccessibility: jest.fn() }, Alert: { alert: jest.fn() },
  View: "View", Text: "Text", ActivityIndicator: "ActivityIndicator", StyleSheet: { create: (value: unknown) => value },
}));
jest.mock("react-native-gesture-handler", () => ({
  GestureDetector: "GestureDetector",
  Gesture: { Pan: () => {
    type MockHandler = (...args: never[]) => unknown;
    const gesture = {
      handlers: {} as Record<string, MockHandler>,
      enabled: () => gesture, activateAfterLongPress: () => gesture,
      shouldCancelWhenOutside: () => gesture, blocksExternalGesture: () => gesture,
      onStart: (handler: MockHandler) => { gesture.handlers.start = handler; return gesture; },
      onUpdate: (handler: MockHandler) => { gesture.handlers.update = handler; return gesture; },
      onEnd: (handler: MockHandler) => { gesture.handlers.end = handler; return gesture; },
      onFinalize: (handler: MockHandler) => { gesture.handlers.finalize = handler; return gesture; },
    };
    return gesture;
  } },
}));
jest.mock("react-native-reanimated", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  return { __esModule: true, default: { View: "AnimatedView" },
    useSharedValue: (initial: number) => React.useRef({ value: initial, set(value: number) { this.value = value; } }).current,
    useAnimatedStyle: jest.fn(() => ({})),
    runOnJS: (callback: unknown) => callback,
    withTiming: (value: number, _options: unknown, callback?: (finished: boolean) => void) => { callback?.(true); return value; },
  };
});
function Capture({ onReady }: { onReady: (value: BudgetDragControls) => void }) {
  const controls = useContext(BudgetDragContext)!;
  useEffect(() => onReady(controls), [controls, onReady]);
  return null;
}
const move = jest.fn();
const scrollToOffset = jest.fn();
const ready = jest.fn();
const reorder = jest.fn();
const setScrollEnabled = jest.fn();
const shared = (value: number): SharedValue<number> => ({
  value, get() { return this.value; },
  set(next) { this.value = typeof next === "function" ? next(this.value) : next; },
  addListener() {}, removeListener() {},
  modify(modifier) { if (modifier) this.value = modifier(this.value); },
});
let root: TestRenderer.ReactTestRenderer;
let state: ReturnType<typeof useBudgetStore.getState>;
let rowValues: { dragY: SharedValue<number>; activeIndex: SharedValue<number>; activeHeight: SharedValue<number>; settled: SharedValue<number> };
let destinationY: number;
let destinationMeasurable: boolean;
const expense = { budgetId: "source", rowId: "bill", name: "Rent", amount: 40 };
function controls() { return ready.mock.calls.at(-1)![0] as BudgetDragControls; }
async function start() {
  await act(async () => { controls().begin(expense, 50, 150, 20, 20, 280, 60); });
}
async function drop(x: number, y: number) {
  let result;
  await act(async () => { result = await controls().finish(x, y); });
  return result;
}
beforeEach(async () => {
  jest.useFakeTimers(); jest.clearAllMocks(); move.mockReset().mockResolvedValue(undefined);
  rowValues = { dragY: shared(0), activeIndex: shared(-1), activeHeight: shared(60), settled: shared(0) };
  destinationY = 300;
  destinationMeasurable = true;
  const bill = { id: "bill", amount: 45.67, paid: true, sort_order: 0, expense: makeExpense() };
  state = { settings: { currency: "CAD", theme: "dark" }, budgets: [{ id: "source", bills: [bill], income: makeIncome() }], moveExpenseBetweenBudgets: move } as unknown as typeof state;
  jest.mocked(useBudgetStore).mockImplementation(selector => selector(state));
  jest.mocked(useBudgetStore.getState).mockImplementation(() => state);
  await act(async () => {
    root = TestRenderer.create(<BudgetDragProvider listRef={{ current: { scrollToOffset } }}>
      <Capture onReady={ready} />
      <BudgetDropTarget budgetId="source">
        <BudgetScrollContext.Provider value={{ listRef: { current: null }, setScrollEnabled }}>
          <DraggableExpenseRow expense={expense} index={0} count={3} {...rowValues} onReorder={reorder} cardColor="#fff" dragColor="#eee" accentColor="#000" enabled>Rent</DraggableExpenseRow>
        </BudgetScrollContext.Provider>
      </BudgetDropTarget>
      <BudgetDropTarget budgetId="destination">Empty destination</BudgetDropTarget>
      <EventBridge />
    </BudgetDragProvider>, {
      createNodeMock: element => ({ measureInWindow: (callback: (x: number, y: number, width: number, height: number) => void) => {
        const id = (element.props as { testID?: string }).testID;
        if (id === "budget-drag-viewport") callback(10, 100, 300, 500);
        else if (id === "budget-drop-source") callback(10, 100, 300, 180);
        else if (id === "budget-drop-destination" && destinationMeasurable) callback(10, destinationY, 300, 200);
      } }),
    });
  });
  await act(async () => {
    root.root.find(node => node.props.testID === "budget-drag-viewport").props.onLayout();
    root.root.findByType(ViewForEvents).props.onContentSizeChange(300, 1000);
  });
});
function EventBridge() { const events = useContext(BudgetDragListContext)!; return <ViewForEvents {...events} />; }
function ViewForEvents(_props: { onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void; onContentSizeChange: (width: number, height: number) => void }) { return null; }
afterEach(async () => { await act(async () => root.unmount()); jest.useRealTimers(); });
it("moves an occurrence to an empty card using its latest saved amount and announces success", async () => {
  await start();
  expect(root.root.findAll(node => node.props.testID === "budget-drag-preview")).toHaveLength(1);
  expect(await drop(50, 350)).toEqual({ kind: "moved" });
  expect(move).toHaveBeenCalledWith("source", "destination", "rent", "bill", 45.67);
  expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(expect.stringContaining("Moved Rent"));
  expect(root.root.findAll(node => node.props.testID === "budget-drag-preview")).toHaveLength(0);
});
it("returns to same-budget reordering, including edge-scroll distance", async () => {
  await start();
  await act(async () => { root.root.findByType(ViewForEvents).props.onScroll({ nativeEvent: { contentOffset: { y: 30 } } }); });
  expect(await drop(50, 150)).toEqual({ kind: "reorder", scrollDelta: 30 });
  expect(move).not.toHaveBeenCalled();
});
it("cancels a drop in a gap or outside the viewport without saving", async () => {
  await start(); expect(await drop(50, 290)).toEqual({ kind: "cancel" });
  await start(); expect(await drop(50, 50)).toEqual({ kind: "cancel" });
  expect(move).not.toHaveBeenCalled();
});
it("shows failed saves and allows another drag", async () => {
  move.mockRejectedValueOnce(new Error("disk full"));
  await start(); await drop(50, 350);
  expect(Alert.alert).toHaveBeenCalledWith("Unable to move expense", expect.any(String));
  expect(AccessibilityInfo.announceForAccessibility).not.toHaveBeenCalled();
  await start(); await drop(50, 350);
  expect(move).toHaveBeenCalledTimes(2);
});
it("auto-scrolls near an edge and stops on cancellation", async () => {
  await start();
  await act(async () => { controls().update(50, 590); jest.advanceTimersByTime(16); });
  expect(scrollToOffset).toHaveBeenCalledWith({ offset: expect.any(Number), animated: false });
  await act(async () => controls().cancel());
  scrollToOffset.mockClear();
  await act(async () => jest.advanceTimersByTime(160));
  expect(scrollToOffset).not.toHaveBeenCalled();
});

function gesture() { return root.root.find(node => String(node.type) === "GestureDetector").props.gesture.handlers; }
const touch = { absoluteX: 50, absoluteY: 150, x: 20, y: 20, translationY: 0 };
it("routes a row gesture onto another card without also reordering", async () => {
  await act(async () => { gesture().start(touch); });
  expect(setScrollEnabled).toHaveBeenLastCalledWith(false);
  await act(async () => {
    gesture().update({ ...touch, absoluteY: 350, translationY: 200 });
    gesture().end({ ...touch, absoluteY: 350, translationY: 200 });
    gesture().finalize({}, true);
  });
  expect(move).toHaveBeenCalledWith("source", "destination", "rent", "bill", 45.67);
  expect(reorder).not.toHaveBeenCalled();
  expect(setScrollEnabled).toHaveBeenLastCalledWith(true);
});
it("keeps same-budget row reordering through the drag coordinator", async () => {
  await act(async () => { gesture().start(touch); });
  await act(async () => {
    gesture().end({ ...touch, absoluteY: 250, translationY: 100 });
    gesture().finalize({}, true);
  });
  expect(reorder).toHaveBeenCalledWith(0, 1);
  expect(move).not.toHaveBeenCalled();
});
it("cleans up a cancelled row gesture without saving", async () => {
  await act(async () => { gesture().start(touch); });
  await act(async () => { gesture().finalize({}, false); });
  expect(root.root.findAll(node => node.props.testID === "budget-drag-preview")).toHaveLength(0);
  expect(move).not.toHaveBeenCalled();
  expect(reorder).not.toHaveBeenCalled();
  expect(setScrollEnabled).toHaveBeenLastCalledWith(true);
});

it("highlights only the card under the pointer without saving before release", async () => {
  await start();
  await act(async () => { controls().update(50, 350); });
  const target = () => root.root.find(node => node.props.testID === "budget-drop-destination");
  expect(target().props.style).toEqual(expect.arrayContaining([expect.objectContaining({ outlineWidth: 3 })]));
  expect(move).not.toHaveBeenCalled();
  await act(async () => { controls().update(50, 290); });
  expect(target().props.style).not.toEqual(expect.arrayContaining([expect.objectContaining({ outlineWidth: 3 })]));
});

it("saves once and waits for success before announcing a pending move", async () => {
  let resolveSave!: () => void;
  move.mockImplementationOnce(() => new Promise<void>(resolve => { resolveSave = resolve; }));
  await start();
  let pending!: ReturnType<BudgetDragControls["finish"]>;
  await act(async () => { pending = controls().finish(50, 350); });
  expect(move).toHaveBeenCalledTimes(1);
  expect(AccessibilityInfo.announceForAccessibility).not.toHaveBeenCalled();
  expect(root.root.findAll(node => node.props.accessibilityLabel === "Moving expense")).toHaveLength(1);
  expect(await drop(50, 350)).toEqual({ kind: "cancel" });
  await act(async () => { controls().begin({ ...expense, rowId: "other" }, 50, 150, 20, 20, 280, 60); controls().cancel(); });
  expect(move).toHaveBeenCalledTimes(1);
  expect(root.root.findAll(node => node.props.testID === "budget-drag-preview")).toHaveLength(1);
  await act(async () => { resolveSave(); await pending; });
  expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledTimes(1);
  expect(root.root.findAll(node => node.props.testID === "budget-drag-preview")).toHaveLength(0);
});

it("rejects an expense removed during the drag without issuing a stale save", async () => {
  await start();
  state = { ...state, budgets: [] };
  await drop(50, 350);
  expect(move).not.toHaveBeenCalled();
  expect(Alert.alert).toHaveBeenCalledWith("Unable to move expense", expect.any(String));
  expect(AccessibilityInfo.announceForAccessibility).not.toHaveBeenCalled();
  expect(root.root.findAll(node => node.props.testID === "budget-drag-preview")).toHaveLength(0);
});

it("uses fresh card measurements on release instead of a stale hover target", async () => {
  await start();
  await act(async () => { controls().update(50, 350); });
  destinationY = 450;
  expect(await drop(50, 350)).toEqual({ kind: "cancel" });
  expect(move).not.toHaveBeenCalled();
});

it("cancels safely when a destination stops measuring and allows retry", async () => {
  await start();
  destinationMeasurable = false;
  let pending!: ReturnType<BudgetDragControls["finish"]>;
  await act(async () => { pending = controls().finish(50, 350); });
  await act(async () => { jest.advanceTimersByTime(150); await pending; });
  await expect(pending).resolves.toEqual({ kind: "cancel" });
  expect(move).not.toHaveBeenCalled();
  expect(root.root.findAll(node => node.props.testID === "budget-drag-preview")).toHaveLength(0);
  destinationMeasurable = true;
  await start(); await drop(50, 350);
  expect(move).toHaveBeenCalledTimes(1);
});

it("stops edge scrolling when the list unmounts during a drag", async () => {
  await start();
  await act(async () => { controls().update(50, 590); jest.advanceTimersByTime(16); });
  expect(scrollToOffset).toHaveBeenCalled();
  await act(async () => root.unmount());
  scrollToOffset.mockClear();
  await act(async () => jest.advanceTimersByTime(160));
  expect(scrollToOffset).not.toHaveBeenCalled();
  expect(move).not.toHaveBeenCalled();
});

function rowAnimation() {
  const row = root.root.find(node => String(node.type) === "AnimatedView" && !!node.props.onLayout);
  const hook = jest.mocked(useAnimatedStyle);
  const callIndex = hook.mock.results.findIndex(result => result.value === row.props.style[1]);
  const callback = hook.mock.calls[callIndex][0];
  return callback() as { transform: { translateY: number }[]; opacity: number; zIndex: number };
}
it("keeps the active row under the floating preview and resets after cancellation", async () => {
  await act(async () => { gesture().start(touch); });
  await act(async () => { gesture().update({ ...touch, translationY: 100, absoluteY: 250 }); });
  expect(rowAnimation()).toMatchObject({ opacity: 0, zIndex: 20, transform: [{ translateY: 100 }] });
  await act(async () => { gesture().finalize({}, false); });
  expect(rowAnimation()).toMatchObject({ opacity: 1, zIndex: 0, transform: [{ translateY: 0 }] });
});
it("shifts a sibling down when a row dragged upward passes it", () => {
  rowAnimation();
  // The fixture row occupies slot zero; a sibling dragged upward from slot two passes it.
  rowValues.activeIndex.set(2); rowValues.dragY.set(-160);
  expect(rowAnimation().transform).toEqual([{ translateY: 76 }]);
});
it("does not shift a sibling when the pointer remains within the source slot", () => {
  rowValues.activeIndex.set(2); rowValues.dragY.set(-10);
  expect(rowAnimation().transform).toEqual([{ translateY: 0 }]);
});

it("shifts a sibling up when a row dragged downward passes it", async () => {
  const props = root.root.findByType(DraggableExpenseRow).props as React.ComponentProps<typeof DraggableExpenseRow>;
  await act(async () => root.update(<DraggableExpenseRow {...props} index={1} />));
  rowValues.activeIndex.set(0); rowValues.dragY.set(100);
  expect(rowAnimation().transform).toEqual([{ translateY: -76 }]);
});
it("compensates for the new layout slot after a successful local reorder", async () => {
  const props = root.root.findByType(DraggableExpenseRow).props as React.ComponentProps<typeof DraggableExpenseRow>;
  await act(async () => root.update(<DraggableExpenseRow {...props} />));
  await act(async () => { gesture().start(touch); gesture().update({ ...touch, translationY: 100 }); });
  rowAnimation();
  await act(async () => { gesture().end({ ...touch, translationY: 100 }); });
  expect(reorder).toHaveBeenCalledWith(0, 1);
  await act(async () => root.update(<DraggableExpenseRow {...props} index={1} />));
  expect(rowAnimation().transform).toEqual([{ translateY: 0 }]);
});
