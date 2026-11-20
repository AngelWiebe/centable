import { StoredBudget, UnfundedExpense } from "../types/budget";

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]!));
}

export interface ReportHtmlInput {
  formattedStartDate: string; formattedEndDate: string; symbol: string; decimals: number;
  totalIncome: number; incomeBreakdown: Record<string, number>;
  totalExpenses: number; totalUnfunded: number; unfunded: UnfundedExpense[];
  groupedExpenseBreakdown: Record<string, number>;
  totalRemainingBalance: number; filteredBudgets: StoredBudget[];
}

export function buildReportHtml(data: ReportHtmlInput): string {
  const { formattedStartDate, formattedEndDate, symbol, decimals, totalIncome, incomeBreakdown,
    totalExpenses, totalUnfunded, unfunded, groupedExpenseBreakdown, totalRemainingBalance, filteredBudgets } = data;
  const html = `
        <html>
          <head>
            <style>
              body { font-family: Arial; padding: 24px; color: #333; }
              h2, h3 { color: #222; }
              .section { margin-bottom: 24px; }
              .item-row { display: flex; justify-content: space-between; padding: 4px 0; }
              .label { font-weight: bold; }
              img { max-width: 100%; margin-top: 10px; }
            </style>
          </head>
          <body>
            <h2>Budget Report</h2>
            <p><strong>Start:</strong> ${escapeHtml(formattedStartDate)}</p>
            <p><strong>End:</strong> ${escapeHtml(formattedEndDate)}</p>

            <div class="section">
              <h3>Income Summary</h3>
              <p>Total Income: ${escapeHtml(symbol)}${totalIncome.toFixed(decimals)}</p>
              ${Object.entries(incomeBreakdown)
                .map(
                  ([name, amount]) =>
                    `<div class="item-row"><span>${escapeHtml(name)}</span><span>${escapeHtml(symbol)}${amount.toFixed(
                      decimals
                    )}</span></div>`
                )
                .join("")}
            </div>

            <div class="section">
              <h3>Expense Summary</h3>
              <p>Total Expenses: ${escapeHtml(symbol)}${totalExpenses.toFixed(decimals)}</p>
              <p>Unfunded expenses: ${escapeHtml(symbol)}${totalUnfunded.toFixed(decimals)}</p>
              ${unfunded.map(item => `<p>${escapeHtml(item.expense.name)}: ${escapeHtml(symbol)}${item.amount.toFixed(decimals)} — needs ${escapeHtml(symbol)}${item.shortfall.toFixed(decimals)} more in one earlier budget.</p>`).join("")}
              ${Object.entries(groupedExpenseBreakdown)
                .map(
                  ([name, amount]) =>
                    `<div class="item-row"><span>${escapeHtml(name)}</span><span>${escapeHtml(symbol)}${amount.toFixed(
                      decimals
                    )}</span></div>`
                )
                .join("")}
            </div>

            <div class="section">
              <h3>Remaining in Allocated Budgets</h3>
              <p>Total: ${escapeHtml(symbol)}${totalRemainingBalance.toFixed(decimals)}</p>
              ${filteredBudgets
                .map(
                  (b) =>
                    `<div class="item-row"><span>${
                      escapeHtml(b.income.name)
                    }</span><span>${escapeHtml(symbol)}${b.remainingBalance.toFixed(
                      decimals
                    )}</span></div>`
                )
                .join("")}
            </div>
          </body>
        </html>
      `;

  return html;
}
