import { state, CATEGORIES } from './state.js';
import { $, fmtMoney, fmtPct, esc, markDirty } from './utils.js';
import { ytdRevenue, ytdExpenses, ytdExpenseByCategory, computedImprovements, documentedImprovements, undocumentedImprovements } from './overview.js';

/* ── Render: Budget ───────────────────────────────────────────────── */
export function renderBudget() {
  const totalBudget = Object.values(state.budgets).reduce((s, v) => s + v, 0);
  const totalActual = ytdExpenses();

  $('budget-body').innerHTML = CATEGORIES.map(cat => {
    const budget = state.budgets[cat] || 0;
    const actual = ytdExpenseByCategory(cat);
    const variance = budget - actual;
    const pctUsed = budget > 0 ? actual / budget : 0;
    return `<tr>
      <td>${cat}</td>
      <td><input type="number" value="${budget || ''}" step="100" onchange="updBudget('${esc(cat)}',this.value)" style="width:110px" placeholder="0"></td>
      <td class="money computed">${budget > 0 ? fmtMoney(budget / 12) : ''}</td>
      <td class="money">${actual ? fmtMoney(actual) : '<span style="color:var(--text-dim)">—</span>'}</td>
      <td class="money" style="color:${variance >= 0 ? 'var(--positive)' : 'var(--negative)'}">${budget > 0 ? fmtMoney(variance) : ''}</td>
      <td class="center" style="color:${pctUsed > 1 ? 'var(--negative)' : pctUsed > 0.8 ? 'var(--warning)' : 'var(--text)'}">${budget > 0 ? fmtPct(pctUsed) : ''}</td>
    </tr>`;
  }).join('');

  const totalVariance = totalBudget - totalActual;
  $('budget-foot').innerHTML = `<tr>
    <td>TOTAL</td>
    <td class="money">${fmtMoney(totalBudget)}</td>
    <td class="money computed">${fmtMoney(totalBudget / 12)}</td>
    <td class="money">${fmtMoney(totalActual)}</td>
    <td class="money" style="color:${totalVariance >= 0 ? 'var(--positive)' : 'var(--negative)'}">${totalBudget > 0 ? fmtMoney(totalVariance) : ''}</td>
    <td class="center">${totalBudget > 0 ? fmtPct(totalActual / totalBudget) : ''}</td>
  </tr>`;

  // ROI sidebar
  const inv = state.investment;
  const improv = computedImprovements();
  const documented = documentedImprovements();
  const pending = undocumentedImprovements();
  const totalInv = inv.propertyPurchase + improv;
  const netProfit = ytdRevenue() - ytdExpenses();
  const reqMonthly = totalInv / inv.targetYears / 12;

  $('budget-roi').innerHTML = `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:20px">
      <h3 style="margin-bottom:16px;color:var(--accent-light)">Investment Quick View</h3>
      <table style="width:100%"><tbody>
        <tr><td style="color:var(--text-muted);padding:6px 0">Property purchase</td><td class="money">${fmtMoney(inv.propertyPurchase)}</td></tr>
        <tr><td style="color:var(--text-muted);padding:6px 0">Improvements (documented)</td><td class="money">${fmtMoney(documented)}</td></tr>
        ${pending > 0 ? `<tr><td style="color:var(--warning);padding:6px 0">⚠ Pending docs</td><td class="money" style="color:var(--warning)">${fmtMoney(pending)}</td></tr>` : ''}
        <tr style="font-weight:700"><td style="padding:6px 0">Total Investment</td><td class="money">${fmtMoney(totalInv)}</td></tr>
        <tr><td colspan="2" style="padding:12px 0 6px;border-top:1px solid var(--border)"></td></tr>
        <tr><td style="color:var(--text-muted);padding:6px 0">Target payback</td><td class="money">${inv.targetYears} years</td></tr>
        <tr><td style="color:var(--text-muted);padding:6px 0">Required monthly net</td><td class="money">${fmtMoney(reqMonthly)}</td></tr>
        <tr><td style="color:var(--text-muted);padding:6px 0">Net profit to date</td><td class="money" style="color:${netProfit >= 0 ? 'var(--positive)' : 'var(--negative)'}">${fmtMoney(netProfit)}</td></tr>
      </tbody></table>
    </div>
  `;
}

export function updBudget(cat, val) {
  state.budgets[cat] = parseFloat(val) || 0;
  markDirty();
  renderBudget();
}

window.updBudget = updBudget;
