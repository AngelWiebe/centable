import { createSQLiteMock } from "../../test/sqliteMock";
import { Platform } from "react-native";
import { openDatabaseAsync } from "expo-sqlite";
import { setupDatabase, updateExpenseOrderInDB } from "../../database/database";
jest.mock("expo-sqlite", () => ({ openDatabaseAsync: jest.fn() }));
const { db, transaction, sqlite } = createSQLiteMock({ sharedStatements: true });
beforeAll(async () => {
  jest.mocked(openDatabaseAsync).mockResolvedValue(sqlite);
  db.getFirstAsync.mockResolvedValue({ id: "settings_id" });
  await setupDatabase();
});
beforeEach(() => {
  jest.clearAllMocks();
  transaction.getFirstAsync.mockImplementation(async sql => sql.includes("MAX") ? { maxOrder: 0 } : { amount: 1000 });
  transaction.runAsync.mockResolvedValue({ changes: 1 });
});
afterEach(() => jest.restoreAllMocks());
it("saves the complete reordered list in one transaction", async () => {
  jest.replaceProperty(Platform, "OS", "ios");
  transaction.getAllAsync.mockResolvedValueOnce([{ id: "A" }, { id: "B" }]);
  await updateExpenseOrderInDB("budget", [{ id: "B" }, { id: "A" }]);
  expect(db.withExclusiveTransactionAsync).toHaveBeenCalledTimes(1);
  expect(transaction.runAsync.mock.calls.map(([, args]) => args)).toEqual([[0, "budget", "B"], [1, "budget", "A"]]);
});
it("propagates a failure partway through saving an order to abort the transaction", async () => {
  jest.replaceProperty(Platform, "OS", "ios");
  transaction.getAllAsync.mockResolvedValueOnce([{ id: "A" }, { id: "B" }]);
  const failure = new Error("disk full");
  transaction.runAsync.mockImplementation(async (_sql, args) => {
    if (args[2] === "A") throw failure;
    return { changes: 1 };
  });
  await expect(updateExpenseOrderInDB("budget", [{ id: "B" }, { id: "A" }])).rejects.toBe(failure);
});
it("rejects an incomplete order before any row updates", async () => {
  transaction.getAllAsync.mockResolvedValueOnce([{ id: "A" }, { id: "B" }]);
  await expect(updateExpenseOrderInDB("budget", [{ id: "A" }])).rejects.toThrow("stale");
  expect(transaction.runAsync).not.toHaveBeenCalled();
});
