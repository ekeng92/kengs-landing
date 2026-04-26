import { state, PLATFORMS } from './state.js';
import { $, fmtMoney, esc, makeOptions, computeBooking, markDirty } from './utils.js';

/* ── Render: Bookings ─────────────────────────────────────────────── */
export function renderBookings() {
  $('booking-count').textContent = `(${state.bookings.length})`;
  $('bookings-body').innerHTML = state.bookings.map((b, i) => `<tr>
    <td data-label="Platform"><select onchange="updBk(${i},'platform',this.value)"><option value="">—</option>${makeOptions(PLATFORMS, b.platform)}</select></td>
    <td data-label="Guest"><input type="text" value="${esc(b.guestName)}" onchange="updBk(${i},'guestName',this.value)" placeholder="Guest name"></td>
    <td data-label="Check-In"><input type="date" value="${b.checkIn}" onchange="updBkDate(${i},'checkIn',this.value)"></td>
    <td data-label="Check-Out"><input type="date" value="${b.checkOut}" onchange="updBkDate(${i},'checkOut',this.value)"></td>
    <td data-label="Nights" class="computed center" data-bk="${i}" data-f="nights">${b.nights || ''}</td>
    <td data-label="Rate"><input type="number" value="${b.nightlyRate || ''}" step="1" onchange="updBkNum(${i},'nightlyRate',this.value)" placeholder="0" style="width:80px"></td>
    <td data-label="Cleaning"><input type="number" value="${b.cleaningFee || ''}" step="1" onchange="updBkNum(${i},'cleaningFee',this.value)" placeholder="0" style="width:80px"></td>
    <td data-label="Gross" class="computed money" data-bk="${i}" data-f="grossRevenue">${b.grossRevenue ? fmtMoney(b.grossRevenue) : ''}</td>
    <td data-label="Fees"><input type="number" value="${b.platformFees || ''}" step="0.01" onchange="updBkNum(${i},'platformFees',this.value)" placeholder="0" style="width:80px"></td>
    <td data-label="Net Payout" class="computed money" data-bk="${i}" data-f="netPayout" style="font-weight:600;color:var(--positive)">${b.netPayout ? fmtMoney(b.netPayout) : ''}</td>
    <td data-label="Notes"><input type="text" value="${esc(b.notes)}" onchange="updBk(${i},'notes',this.value)" placeholder="Notes"></td>
    <td><button class="btn btn-danger btn-sm" onclick="delBk(${i})" title="Delete">✕</button></td>
  </tr>`).join('');

  // Totals
  const totGross = state.bookings.reduce((s, b) => s + (b.grossRevenue || 0), 0);
  const totFees = state.bookings.reduce((s, b) => s + (b.platformFees || 0), 0);
  const totNet = state.bookings.reduce((s, b) => s + (b.netPayout || 0), 0);
  const totNights = state.bookings.reduce((s, b) => s + (b.nights || 0), 0);
  $('bookings-foot').innerHTML = state.bookings.length ? `<tr>
    <td colspan="4" style="text-align:right">Totals</td>
    <td class="center">${totNights}</td><td></td><td></td>
    <td class="money">${fmtMoney(totGross)}</td>
    <td class="money">${fmtMoney(totFees)}</td>
    <td class="money" style="color:var(--positive);font-weight:700">${fmtMoney(totNet)}</td>
    <td></td><td></td>
  </tr>` : '';
}

export function addBooking() {
  state.bookings.unshift({
    month: '', platform: 'Airbnb', guestName: '', checkIn: '', checkOut: '',
    nights: 0, nightlyRate: 150, cleaningFee: 0, grossRevenue: 0, platformFees: 0, netPayout: 0, notes: ''
  });
  markDirty();
  renderBookings();
}

export function updBk(i, field, val) { state.bookings[i][field] = val; markDirty(); }

export function updBkNum(i, field, val) {
  state.bookings[i][field] = parseFloat(val) || 0;
  computeBooking(state.bookings[i]);
  refreshBkComputed(i);
  markDirty();
}

export function updBkDate(i, field, val) {
  state.bookings[i][field] = val;
  computeBooking(state.bookings[i]);
  refreshBkComputed(i);
  markDirty();
}

export function delBk(i) {
  state.bookings.splice(i, 1);
  markDirty();
  renderBookings();
}

export function refreshBkComputed(i) {
  const b = state.bookings[i];
  document.querySelectorAll(`[data-bk="${i}"]`).forEach(el => {
    const f = el.dataset.f;
    if (f === 'nights') el.textContent = b.nights || '';
    else if (f === 'grossRevenue') el.textContent = b.grossRevenue ? fmtMoney(b.grossRevenue) : '';
    else if (f === 'netPayout') el.textContent = b.netPayout ? fmtMoney(b.netPayout) : '';
  });
  // Update footer totals without full re-render
  const totGross = state.bookings.reduce((s, b) => s + (b.grossRevenue || 0), 0);
  const totFees = state.bookings.reduce((s, b) => s + (b.platformFees || 0), 0);
  const totNet = state.bookings.reduce((s, b) => s + (b.netPayout || 0), 0);
  const totNights = state.bookings.reduce((s, b) => s + (b.nights || 0), 0);
  const foot = $('bookings-foot');
  if (foot.querySelector('tr')) {
    const cells = foot.querySelectorAll('td');
    if (cells.length >= 10) {
      cells[4].textContent = totNights;
      cells[7].textContent = fmtMoney(totGross);
      cells[8].textContent = fmtMoney(totFees);
      cells[9].textContent = fmtMoney(totNet);
    }
  }
}

window.addBooking = addBooking;
window.updBk = updBk;
window.updBkNum = updBkNum;
window.updBkDate = updBkDate;
window.delBk = delBk;
