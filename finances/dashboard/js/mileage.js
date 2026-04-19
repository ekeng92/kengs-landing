import { state, MONTHS } from './state.js';
import { $, fmtMoney, esc, fmtPct } from './utils.js';

/* ── Render: Mileage ──────────────────────────────────────────────── */
export function renderMileage() {
  const trips = state.mileage;
  const totalMiles = trips.reduce((s, t) => s + t.miles, 0);
  const totalDeduction = trips.reduce((s, t) => s + t.deduction, 0);
  const rate = trips.length > 0 ? trips[0].rate : 0.70;

  $('mileage-count').textContent = `(${trips.length} trips)`;

  $('mileage-kpis').innerHTML = `
    <div class="kpi-card">
      <div class="label">Total Trips</div>
      <div class="value neutral">${trips.length}</div>
      <div class="sub">Jan — ${MONTHS[new Date().getMonth()]} ${new Date().getFullYear()}</div>
    </div>
    <div class="kpi-card">
      <div class="label">Total Miles</div>
      <div class="value neutral">${totalMiles.toLocaleString()}</div>
      <div class="sub">~120 mi round trip</div>
    </div>
    <div class="kpi-card">
      <div class="label">Mileage Deduction</div>
      <div class="value positive">${fmtMoney(totalDeduction)}</div>
      <div class="sub">@ ${fmtMoney(rate)}/mile (IRS standard)</div>
    </div>
    <div class="kpi-card">
      <div class="label">Avg Trips/Month</div>
      <div class="value neutral">${trips.length > 0 ? (trips.length / Math.max(1, new Date().getMonth() + 1)).toFixed(1) : '0'}</div>
      <div class="sub">${fmtMoney(totalDeduction / Math.max(1, new Date().getMonth() + 1))}/mo deduction</div>
    </div>
  `;

  $('mileage-body').innerHTML = trips.map(t => `<tr>
    <td data-label="Date">${t.date}</td>
    <td data-label="Origin">${esc(t.origin)}</td>
    <td data-label="Destination">${esc(t.destination)}</td>
    <td data-label="Miles" class="center">${t.miles}</td>
    <td data-label="Purpose">${esc(t.purpose)}</td>
    <td data-label="Stops" style="font-size:0.8rem;color:var(--text-muted)">${esc(t.stops)}</td>
    <td data-label="Deduction" class="money" style="color:var(--positive)">${fmtMoney(t.deduction)}</td>
  </tr>`).join('');

  $('mileage-foot').innerHTML = `<tr class="total-row">
    <td colspan="3">TOTAL</td>
    <td class="center">${totalMiles.toLocaleString()}</td>
    <td colspan="2">${trips.length} trips</td>
    <td class="money" style="color:var(--positive)">${fmtMoney(totalDeduction)}</td>
  </tr>`;
}
