import { state, CATEGORIES, PAYMENTS, RECEIPT_VALUES } from './state.js';
import { $, fmtMoney, esc, makeOptions, dateToMonth, markDirty } from './utils.js';
import { ytdExpenses } from './overview.js';

/* ── Filter State ─────────────────────────────────────────────────── */
const filters = {
  search: '',
  category: '',
  dateFrom: '',
  dateTo: '',
  status: '',
  sortField: 'date',
  sortDir: 'desc',
};

/* ── Filtering & Sorting ──────────────────────────────────────────── */
function getFilteredExpenses() {
  let items = state.expenses.map((e, i) => ({ ...e, _idx: i }));

  if (filters.search) {
    const q = filters.search.toLowerCase();
    items = items.filter(e =>
      (e.vendor || '').toLowerCase().includes(q) ||
      (e.description || '').toLowerCase().includes(q) ||
      (e.category || '').toLowerCase().includes(q)
    );
  }

  if (filters.category) {
    items = items.filter(e => e.category === filters.category);
  }

  if (filters.status) {
    items = items.filter(e => e.status === filters.status);
  }

  if (filters.dateFrom) {
    items = items.filter(e => e.date >= filters.dateFrom);
  }

  if (filters.dateTo) {
    items = items.filter(e => e.date <= filters.dateTo);
  }

  items.sort((a, b) => {
    let valA = a[filters.sortField];
    let valB = b[filters.sortField];
    if (filters.sortField === 'amount') {
      valA = Number(valA) || 0;
      valB = Number(valB) || 0;
    }
    if (valA < valB) return filters.sortDir === 'asc' ? -1 : 1;
    if (valA > valB) return filters.sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  return items;
}

function sortHeader(label, field) {
  const arrow = filters.sortField === field
    ? (filters.sortDir === 'asc' ? ' ↑' : ' ↓')
    : '';
  return `<th class="sortable" onclick="sortExpenses('${field}')" style="cursor:pointer">${label}${arrow}</th>`;
}

/* ── Render: Expenses ─────────────────────────────────────────────── */
export function renderExpenses() {
  // Populate category dropdown once
  const catFilter = $('expense-cat-filter');
  if (catFilter && catFilter.options.length <= 1) {
    const usedCats = [...new Set(state.expenses.map(e => e.category).filter(Boolean))].sort();
    usedCats.forEach(c => {
      catFilter.add(new Option(c, c));
    });
  }

  // Build sortable header
  $('expenses-head').innerHTML = `<tr>
    ${sortHeader('Date', 'date')}
    ${sortHeader('Category', 'category')}
    ${sortHeader('Vendor', 'vendor')}
    ${sortHeader('Description', 'description')}
    ${sortHeader('Amount', 'amount')}
    <th>Payment</th>
    <th>Receipt</th>
    ${sortHeader('Status', 'status')}
    <th>Period</th>
    <th style="width:36px"></th>
  </tr>`;

  const filtered = getFilteredExpenses();

  $('expense-count').textContent = filtered.length < state.expenses.length
    ? `(${filtered.length} of ${state.expenses.length})`
    : `(${state.expenses.length})`;

  $('expenses-body').innerHTML = filtered.map(e => {
    const i = e._idx;
    return `<tr>
    <td data-label="Date"><input type="date" value="${e.date}" onchange="updEx(${i},'date',this.value)"></td>
    <td data-label="Category"><select onchange="updEx(${i},'category',this.value)"><option value="">—</option>${makeOptions(CATEGORIES, e.category)}</select></td>
    <td data-label="Vendor"><input type="text" value="${esc(e.vendor)}" onchange="updEx(${i},'vendor',this.value)" placeholder="Vendor"></td>
    <td data-label="Description"><input type="text" value="${esc(e.description)}" onchange="updEx(${i},'description',this.value)" placeholder="Description" style="min-width:140px"></td>
    <td data-label="Amount"><input type="number" value="${e.amount || ''}" step="0.01" onchange="updExNum(${i},'amount',this.value)" placeholder="0.00"></td>
    <td data-label="Payment"><select onchange="updEx(${i},'paymentMethod',this.value)"><option value="">—</option>${makeOptions(PAYMENTS, e.paymentMethod)}</select></td>
    <td data-label="Receipt"><select onchange="updEx(${i},'receipt',this.value)" style="min-width:60px"><option value="">—</option>${makeOptions(RECEIPT_VALUES, e.receipt)}</select></td>
    <td data-label="Status"><span class="badge ${e.status==='Review'?'badge-review':e.status==='Personal'?'badge-personal':'badge-business'}">${e.status||'Business'}</span></td>
    <td data-label="Period"><span class="badge" style="background:${e.taxPeriod==='Pre-Service' ? 'rgba(96,165,250,.15)' : 'rgba(74,222,128,.15)'};color:${e.taxPeriod==='Pre-Service' ? 'var(--info)' : 'var(--positive)'};font-size:0.7rem">${e.taxPeriod||'—'}</span></td>
    <td><button class="btn btn-danger btn-sm" onclick="delEx(${i})" title="Delete">✕</button></td>
  </tr>`;
  }).join('');

  const filteredTotal = filtered.reduce((s, e) => s + (e.amount || 0), 0);
  const preServiceTotal = filtered.filter(e => e.taxPeriod === 'Pre-Service' && e.status !== 'Personal').reduce((s, e) => s + (e.amount || 0), 0);
  const operationalTotal = filtered.filter(e => e.taxPeriod === 'Operational' && e.status !== 'Personal').reduce((s, e) => s + (e.amount || 0), 0);
  $('expenses-foot').innerHTML = filtered.length ? `<tr>
    <td colspan="4" style="text-align:right">Total</td>
    <td class="money">${fmtMoney(filteredTotal)}</td>
    <td colspan="2"></td>
    <td colspan="2" style="font-size:0.8rem;color:var(--text-muted)">Pre: ${fmtMoney(preServiceTotal)} · Op: ${fmtMoney(operationalTotal)}</td>
  </tr>` : '';

  // Filter count indicator
  $('filter-count').textContent = filtered.length < state.expenses.length
    ? `Showing ${filtered.length} of ${state.expenses.length}`
    : '';
}

export function addExpense() {
  state.expenses.unshift({
    date: new Date().toISOString().slice(0, 10), month: dateToMonth(new Date().toISOString().slice(0, 10)),
    category: '', vendor: '', description: '', amount: 0, paymentMethod: '', receipt: '', status: 'Business', taxPeriod: 'Operational'
  });
  markDirty();
  renderExpenses();
}

export function updEx(i, field, val) {
  state.expenses[i][field] = val;
  if (field === 'date') {
    state.expenses[i].month = dateToMonth(val);
    state.expenses[i].taxPeriod = val < '2026-03-01' ? 'Pre-Service' : 'Operational';
  }
  markDirty();
}

export function updExNum(i, field, val) {
  state.expenses[i][field] = parseFloat(val) || 0;
  markDirty();
  const total = ytdExpenses();
  const foot = $('expenses-foot');
  if (foot.querySelector('td.money')) foot.querySelector('td.money').textContent = fmtMoney(total);
}

export function delEx(i) {
  state.expenses.splice(i, 1);
  markDirty();
  renderExpenses();
}

export function sortExpenses(field) {
  if (filters.sortField === field) {
    filters.sortDir = filters.sortDir === 'asc' ? 'desc' : 'asc';
  } else {
    filters.sortField = field;
    filters.sortDir = field === 'amount' ? 'desc' : 'asc';
  }
  renderExpenses();
}

export function filterExpenses() {
  filters.search = $('expense-search').value;
  filters.category = $('expense-cat-filter').value;
  filters.status = $('expense-status-filter').value;
  filters.dateFrom = $('expense-date-from').value;
  filters.dateTo = $('expense-date-to').value;
  renderExpenses();
}

export function clearExpenseFilters() {
  filters.search = '';
  filters.category = '';
  filters.status = '';
  filters.dateFrom = '';
  filters.dateTo = '';
  $('expense-search').value = '';
  $('expense-cat-filter').value = '';
  $('expense-status-filter').value = '';
  $('expense-date-from').value = '';
  $('expense-date-to').value = '';
  renderExpenses();
}

window.addExpense = addExpense;
window.updEx = updEx;
window.updExNum = updExNum;
window.delEx = delEx;
window.sortExpenses = sortExpenses;
window.filterExpenses = filterExpenses;
window.clearExpenseFilters = clearExpenseFilters;
