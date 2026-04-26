import { state, CATEGORIES, MONTHS, DAYS_IN_MONTH } from './state.js';
import { $, fmtMoney, fmtPct } from './utils.js';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

/* ── Chart.js dark theme defaults ─────────────────────────────────── */
Chart.defaults.color = '#888';
Chart.defaults.borderColor = '#333';
Chart.defaults.plugins.legend.labels.color = '#888';

/* ── Chart instance management ────────────────────────────────────── */
let chartInstances = {};

/* ── Computations ─────────────────────────────────────────────────── */
export function ytdRevenue() {
  return state.bookings.reduce((s, b) => s + (b.netPayout || 0), 0);
}

export function ytdExpenses() {
  return state.expenses.filter(e => e.status !== 'Personal').reduce((s, e) => s + (e.amount || 0), 0);
}

export function ytdExpenseByCategory(cat) {
  const lc = cat.toLowerCase();
  return state.expenses.filter(e => (e.category || '').toLowerCase() === lc && e.status !== 'Personal').reduce((s, e) => s + (e.amount || 0), 0);
}

export function computedImprovements() {
  // Total improvements = all Business-status expenses (the actual money spent getting the property rental-ready)
  return state.expenses.filter(e => e.status === 'Business').reduce((s, e) => s + (e.amount || 0), 0);
}

export function documentedImprovements() {
  // Only fully documented (Business status, receipt CC or Y)
  return state.expenses.filter(e => e.status === 'Business' && (e.receipt === 'CC' || e.receipt === 'Y')).reduce((s, e) => s + (e.amount || 0), 0);
}

export function undocumentedImprovements() {
  // Review items — money probably spent but not yet confirmed/documented
  return state.expenses.filter(e => e.status === 'Review').reduce((s, e) => s + (e.amount || 0), 0);
}

export function monthlySummary() {
  const year = new Date().getFullYear();
  return MONTHS.map((m, i) => {
    const label = `${m} ${year}`;
    const bks = state.bookings.filter(b => b.month === label);
    const exps = state.expenses.filter(e => e.month === label && e.status !== 'Personal');
    const revenue = bks.reduce((s, b) => s + (b.netPayout || 0), 0);
    const expenses = exps.reduce((s, e) => s + (e.amount || 0), 0);
    return {
      month: label,
      revenue,
      expenses,
      net: revenue - expenses,
      bookings: bks.length,
      nights: bks.reduce((s, b) => s + (b.nights || 0), 0),
      daysInMonth: DAYS_IN_MONTH[i],
    };
  });
}

/* ── Render: Overview ─────────────────────────────────────────────── */
export function renderOverview() {
  const rev = ytdRevenue();
  const exp = ytdExpenses();
  const net = rev - exp;
  const summary = monthlySummary();
  const totalNights = summary.reduce((s, m) => s + m.nights, 0);
  const totalDays = summary.reduce((s, m) => s + m.daysInMonth, 0);
  const activeMonths = summary.filter(m => m.revenue > 0).length;
  const inv = state.investment;
  const improvements = computedImprovements();
  const totalInv = inv.propertyPurchase + improvements;
  const mileageDeduction = state.mileage.reduce((s, t) => s + t.deduction, 0);
  const reviewCount = state.expenses.filter(e => e.status === 'Review').length;
  const pendingDocs = undocumentedImprovements();

  $('kpi-cards').innerHTML = `
    <div class="kpi-card">
      <div class="label">YTD Revenue</div>
      <div class="value positive">${fmtMoney(rev)}</div>
      <div class="sub">${state.bookings.length} bookings · ${totalNights} nights</div>
    </div>
    <div class="kpi-card">
      <div class="label">YTD Expenses</div>
      <div class="value neutral">${fmtMoney(exp)}</div>
      <div class="sub">${state.expenses.filter(e=>e.status !== 'Personal').length} transactions · <span style="color:var(--info)">Pre: ${fmtMoney(state.expenses.filter(e=>e.taxPeriod==='Pre-Service'&&e.status!=='Personal').reduce((s,e)=>s+(e.amount||0),0))}</span></div>
    </div>
    <div class="kpi-card">
      <div class="label">Net Profit</div>
      <div class="value ${net >= 0 ? 'positive' : 'negative'}">${fmtMoney(net)}</div>
      <div class="sub">${activeMonths > 0 ? fmtMoney(net / activeMonths) + '/mo avg' : 'No revenue months'}</div>
    </div>
    <div class="kpi-card">
      <div class="label">Occupancy</div>
      <div class="value neutral">${totalDays > 0 ? fmtPct(totalNights / totalDays) : '—'}</div>
      <div class="sub">${totalNights} of ${totalDays} days</div>
    </div>
    <div class="kpi-card">
      <div class="label">Mileage Deduction</div>
      <div class="value positive">${fmtMoney(mileageDeduction)}</div>
      <div class="sub">${state.mileage.length} trips · ${state.mileage.reduce((s,t)=>s+t.miles,0).toLocaleString()} mi</div>
    </div>
    <div class="kpi-card">
      <div class="label">Investment Recovery</div>
      <div class="value ${rev > 0 ? 'positive' : 'neutral'}">${rev > 0 ? fmtPct(rev / totalInv) : 'Pre-revenue'}</div>
      <div class="sub">${fmtMoney(rev)} recovered of ${fmtMoney(totalInv)}</div>
    </div>
    <div class="kpi-card">
      <div class="label">Total Invested</div>
      <div class="value neutral">${fmtMoney(totalInv)}</div>
      <div class="sub">${fmtMoney(inv.propertyPurchase)} purchase + ${fmtMoney(improvements)} expenses</div>
    </div>
    ${reviewCount > 0 ? `<div class="kpi-card" style="border-color:var(--warning);cursor:pointer" onclick="switchTab('review')">
      <div class="label" style="color:var(--warning)">Needs Review</div>
      <div class="value" style="color:var(--warning)">${reviewCount}</div>
      <div class="sub">${fmtMoney(pendingDocs)} pending documentation</div>
    </div>` : ''}
  `;

  // Monthly table
  $('monthly-body').innerHTML = summary.map(m => `<tr>
    <td>${m.month}</td>
    <td class="money">${m.revenue ? fmtMoney(m.revenue) : '<span style="color:var(--text-dim)">—</span>'}</td>
    <td class="money">${m.expenses ? fmtMoney(m.expenses) : '<span style="color:var(--text-dim)">—</span>'}</td>
    <td class="money" style="color:${m.net > 0 ? 'var(--positive)' : m.net < 0 ? 'var(--negative)' : 'var(--text-dim)'}">${m.revenue || m.expenses ? fmtMoney(m.net) : '<span style="color:var(--text-dim)">—</span>'}</td>
    <td class="center">${m.bookings || '<span style="color:var(--text-dim)">—</span>'}</td>
    <td class="center">${m.nights || '<span style="color:var(--text-dim)">—</span>'}</td>
    <td class="center">${m.nights ? fmtPct(m.nights / m.daysInMonth) : '<span style="color:var(--text-dim)">—</span>'}</td>
  </tr>`).join('');

  $('monthly-foot').innerHTML = `<tr class="total-row">
    <td>TOTAL ${new Date().getFullYear()}</td>
    <td class="money">${fmtMoney(rev)}</td>
    <td class="money">${fmtMoney(exp)}</td>
    <td class="money" style="color:${net >= 0 ? 'var(--positive)' : 'var(--negative)'}">${fmtMoney(net)}</td>
    <td class="center">${state.bookings.length}</td>
    <td class="center">${totalNights}</td>
    <td class="center">${totalDays > 0 ? fmtPct(totalNights / totalDays) : '—'}</td>
  </tr>`;

  // Category breakdown
  const totalExp = exp || 1;
  $('category-body').innerHTML = CATEGORIES.map(cat => {
    const amt = ytdExpenseByCategory(cat);
    if (amt === 0) return '';
    return `<tr>
      <td>${cat}</td>
      <td class="money">${fmtMoney(amt)}</td>
      <td class="center">${fmtPct(amt / totalExp)}</td>
    </tr>`;
  }).filter(Boolean).join('') || '<tr><td colspan="3" style="text-align:center;color:var(--text-dim);padding:20px">No expenses recorded</td></tr>';

  // ROI section — revenue-based recovery (how much of total investment earned back)
  const recoveryPct = totalInv > 0 ? rev / totalInv : 0;
  const projAnnual = activeMonths > 0 ? (net / activeMonths) * 12 : 0;
  const projYears = projAnnual > 0 ? totalInv / projAnnual : 0;
  const pctFill = Math.min(100, Math.max(0, recoveryPct * 100));

  $('roi-section').innerHTML = `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:20px">
      <div style="display:flex;justify-content:space-between;margin-bottom:12px">
        <div><strong>Total Investment:</strong> ${fmtMoney(totalInv)}</div>
        <div><strong>Target:</strong> ${inv.targetYears} years</div>
      </div>
      <div class="progress-bar"><div class="progress-fill" style="width:${pctFill}%">${fmtPct(recoveryPct)} recovered</div></div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:16px;font-size:0.9rem">
        <div><span style="color:var(--text-muted)">Revenue to date</span><br><strong style="color:var(--positive)">${fmtMoney(rev)}</strong></div>
        <div><span style="color:var(--text-muted)">Net profit to date</span><br><strong style="color:${net >= 0 ? 'var(--positive)' : 'var(--negative)'}">${fmtMoney(net)}</strong></div>
        <div><span style="color:var(--text-muted)">Projected payback</span><br><strong>${projYears > 0 ? projYears.toFixed(1) + ' years' : 'Needs more data'}</strong></div>
      </div>
    </div>
  `;

  renderCharts(summary);
}

/* ── Render: Charts ───────────────────────────────────────────────── */
function renderCharts(summary) {
  // Destroy existing chart instances
  Object.values(chartInstances).forEach(c => c.destroy());
  chartInstances = {};

  const months = summary.map(m => m.month.split(' ')[0]); // Short month labels

  // ── Chart 1: Monthly Revenue vs Expenses (Line) ──
  const trendCtx = $('chart-monthly-trend');
  if (trendCtx) {
    chartInstances.trend = new Chart(trendCtx, {
      type: 'line',
      data: {
        labels: months,
        datasets: [
          {
            label: 'Revenue',
            data: summary.map(m => m.revenue),
            borderColor: '#4ade80',
            backgroundColor: 'rgba(74, 222, 128, 0.1)',
            fill: true,
            tension: 0.3,
            pointBackgroundColor: '#4ade80',
            pointRadius: 4,
            pointHoverRadius: 6,
          },
          {
            label: 'Expenses',
            data: summary.map(m => m.expenses),
            borderColor: '#f87171',
            backgroundColor: 'rgba(248, 113, 113, 0.05)',
            fill: false,
            tension: 0.3,
            pointBackgroundColor: '#f87171',
            pointRadius: 4,
            pointHoverRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        interaction: { intersect: false, mode: 'index' },
        plugins: {
          legend: { position: 'top' },
          tooltip: {
            callbacks: {
              label: ctx => `${ctx.dataset.label}: ${fmtMoney(ctx.parsed.y)}`,
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { callback: v => fmtMoney(v) },
            grid: { color: '#2a2a2a' },
          },
          x: { grid: { color: '#2a2a2a' } },
        },
      },
    });
  }

  // ── Chart 2: Expense Category Breakdown (Doughnut) ──
  const catCtx = $('chart-category');
  if (catCtx) {
    const catData = CATEGORIES.map(cat => ({
      label: cat,
      amount: ytdExpenseByCategory(cat),
    })).filter(d => d.amount > 0);

    const palette = [
      '#6366f1', '#8b5cf6', '#a78bfa', '#c084fc',
      '#e879f9', '#f472b6', '#fb7185', '#f97316',
      '#eab308', '#22d3ee', '#34d399', '#60a5fa', '#94a3b8',
    ];

    const totalExpenses = catData.reduce((s, d) => s + d.amount, 0);

    chartInstances.category = new Chart(catCtx, {
      type: 'doughnut',
      data: {
        labels: catData.map(d => d.label),
        datasets: [{
          data: catData.map(d => d.amount),
          backgroundColor: palette.slice(0, catData.length),
          borderColor: '#1a1a1a',
          borderWidth: 2,
        }],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'right', labels: { padding: 12, font: { size: 11 } } },
          tooltip: {
            callbacks: {
              label: ctx => {
                const val = ctx.parsed;
                const pct = totalExpenses > 0 ? ((val / totalExpenses) * 100).toFixed(1) : 0;
                return `${ctx.label}: ${fmtMoney(val)} (${pct}%)`;
              },
            },
          },
        },
      },
      plugins: [{
        id: 'centerText',
        beforeDraw(chart) {
          const { width, height, ctx } = chart;
          ctx.save();
          ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, sans-serif';
          ctx.fillStyle = '#e0e0e0';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const centerX = (chart.chartArea.left + chart.chartArea.right) / 2;
          const centerY = (chart.chartArea.top + chart.chartArea.bottom) / 2;
          ctx.fillText(fmtMoney(totalExpenses), centerX, centerY - 8);
          ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
          ctx.fillStyle = '#888';
          ctx.fillText('Total', centerX, centerY + 12);
          ctx.restore();
        },
      }],
    });
  }

  // ── Chart 3: Monthly Occupancy (Bar) ──
  const occCtx = $('chart-occupancy');
  if (occCtx) {
    const occupancyPcts = summary.map(m => m.daysInMonth > 0 ? (m.nights / m.daysInMonth) * 100 : 0);
    const avgOccupancy = (() => {
      const active = occupancyPcts.filter(p => p > 0);
      return active.length > 0 ? active.reduce((s, v) => s + v, 0) / active.length : 0;
    })();

    chartInstances.occupancy = new Chart(occCtx, {
      type: 'bar',
      data: {
        labels: months,
        datasets: [{
          label: 'Occupancy %',
          data: occupancyPcts,
          backgroundColor: occupancyPcts.map(p => p > 0 ? 'rgba(74, 222, 128, 0.6)' : 'rgba(85, 85, 85, 0.3)'),
          borderColor: occupancyPcts.map(p => p > 0 ? '#4ade80' : '#555'),
          borderWidth: 1,
          borderRadius: 4,
        }],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => {
                const m = summary[ctx.dataIndex];
                return `${ctx.parsed.y.toFixed(1)}% (${m.nights} of ${m.daysInMonth} days)`;
              },
            },
          },
          annotation: undefined,
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            ticks: { callback: v => v + '%' },
            grid: { color: '#2a2a2a' },
          },
          x: { grid: { display: false } },
        },
      },
      plugins: [{
        id: 'avgLine',
        afterDatasetsDraw(chart) {
          if (avgOccupancy <= 0) return;
          const { ctx, chartArea, scales } = chart;
          const y = scales.y.getPixelForValue(avgOccupancy);
          ctx.save();
          ctx.strokeStyle = '#fbbf24';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([6, 4]);
          ctx.beginPath();
          ctx.moveTo(chartArea.left, y);
          ctx.lineTo(chartArea.right, y);
          ctx.stroke();
          ctx.fillStyle = '#fbbf24';
          ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText(`Avg: ${avgOccupancy.toFixed(1)}%`, chartArea.left + 4, y - 6);
          ctx.restore();
        },
      }],
    });
  }
}
