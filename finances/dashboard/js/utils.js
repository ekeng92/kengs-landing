import { state, MONTHS } from './state.js';

/* ── Utilities ────────────────────────────────────────────────────── */
export const $ = id => document.getElementById(id);

export const fmtMoney = n => {
  if (n == null || isNaN(n)) return '$0.00';
  return (n < 0 ? '-' : '') + '$' + Math.abs(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

export const fmtPct = n => ((n || 0) * 100).toFixed(1) + '%';

export const esc = s => s == null ? '' : String(s).replace(/"/g, '&quot;').replace(/</g, '&lt;');

export function normalizeDate(val) {
  if (!val) return '';
  if (val instanceof Date) {
    return `${val.getUTCFullYear()}-${String(val.getUTCMonth()+1).padStart(2,'0')}-${String(val.getUTCDate()).padStart(2,'0')}`;
  }
  if (typeof val === 'number') {
    const d = new Date(Math.round((val - 25569) * 86400000));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
  }
  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  return isNaN(d) ? s : `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

export function dateToMonth(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length < 2) return '';
  const m = parseInt(parts[1], 10) - 1;
  return m >= 0 && m < 12 ? `${MONTHS[m]} ${parts[0]}` : '';
}

export function computeBooking(b) {
  if (b.checkIn && b.checkOut) {
    const d1 = new Date(b.checkIn), d2 = new Date(b.checkOut);
    b.nights = Math.max(0, Math.round((d2 - d1) / 86400000));
  }
  b.month = dateToMonth(b.checkIn);
  b.grossRevenue = (b.nights || 0) * (b.nightlyRate || 0) + (b.cleaningFee || 0);
  b.netPayout = b.grossRevenue - (b.platformFees || 0);
}

export function makeOptions(list, selected) {
  return list.map(v =>
    `<option value="${esc(v)}"${v === selected ? ' selected' : ''}>${esc(v)}</option>`
  ).join('');
}

export function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2500);
}

export function markDirty() {
  state.dirty = true;
  $('dirty-dot').classList.add('show');
  // persistToLocal is called from main.js via this export
  if (window._persistToLocal) window._persistToLocal();
}

export function markClean() {
  state.dirty = false;
  $('dirty-dot').classList.remove('show');
}
