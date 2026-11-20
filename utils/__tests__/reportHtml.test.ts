import { buildReportHtml, escapeHtml } from "../reportHtml";
import { buildBudgetForecast } from "../buildBudgets";
it("escapes every user label in report HTML without changing numeric amounts", () => {
  const start = new Date(2026, 10, 1), end = new Date(2026, 10, 30);
  const income = { id: "pay", name: "Income <Salary>", amount: 1000, date: start, frequency: undefined };
  const forecast = buildBudgetForecast([income], [], start, end);
  const html = buildReportHtml({
    formattedStartDate: "Nov <1>", formattedEndDate: "Nov & 30", symbol: "$", decimals: 2,
    totalIncome: 1000, incomeBreakdown: { [income.name]: 1000 }, totalExpenses: 525, totalUnfunded: 25,
    groupedExpenseBreakdown: { 'Rent <Utilities> & "Bills"': 500 },
    totalRemainingBalance: 500, filteredBudgets: forecast.budgets,
    unfunded: [{ id: "bill", amount: 25, paid: false, shortfall: 25, expense: { id: "bill", name: "<script>alert('x')</script>", amount: 25, date: start, frequency: undefined } }],
  });
  expect(html).not.toContain("<Salary>"); expect(html).not.toContain("<Utilities>"); expect(html).not.toContain("<script>");
  expect(html.match(/Income &lt;Salary&gt;/g)).toHaveLength(2);
  expect(html).toContain("Rent &lt;Utilities&gt; &amp; &quot;Bills&quot;");
  expect(html).toContain("Nov &lt;1&gt;"); expect(html).toContain("$1000.00");
});
it("preserves literal entity-looking text and all HTML punctuation", () => {
  expect(escapeHtml("&amp; < > \" '")).toBe("&amp;amp; &lt; &gt; &quot; &#39;");
});
