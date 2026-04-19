/* ── CSS Import (Vite handles injection) ──────────────────────────── */
import '../css/styles.css';
import '../css/responsive.css';

/* ── Module Imports ───────────────────────────────────────────────── */
import { state, CATEGORIES, CAT_LOOKUP } from './state.js';
import { $, markClean, markDirty } from './utils.js';
import { renderOverview } from './overview.js';
import { renderReview, updateReviewBadge } from './review.js';
import { renderBookings } from './bookings.js';
import { renderExpenses } from './expenses.js';
import { renderMileage } from './mileage.js';
import { renderBudget } from './budget.js';

// file-io.js registers its own window globals (openFile, saveFile)
import './file-io.js';

/* ── Tab Management ───────────────────────────────────────────────── */
function switchTab(tab) {
  state.activeTab = tab;
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('nav.tabs button').forEach(btn => btn.classList.remove('active'));
  const section = $(`tab-${tab}`);
  if (section) section.classList.add('active');
  const btn = document.querySelector(`nav.tabs button[data-tab="${tab}"]`);
  if (btn) btn.classList.add('active');
  if (tab === 'overview') renderOverview();
  if (tab === 'review') renderReview();
  if (tab === 'mileage') renderMileage();
  if (tab === 'budget') renderBudget();
}

document.addEventListener('click', e => {
  if (e.target.matches('nav.tabs button')) {
    switchTab(e.target.dataset.tab);
  }
});

/* ── Render All ───────────────────────────────────────────────────── */
function renderAll() {
  renderOverview();
  renderReview();
  renderBookings();
  renderExpenses();
  renderMileage();
  renderBudget();
  updateReviewBadge();
}

/* ── Show Dashboard ───────────────────────────────────────────────── */
function showDashboard() {
  $('empty-state').style.display = 'none';
  $('tab-nav').style.display = 'flex';
  $('btn-save').style.display = '';
  markClean();
  switchTab('overview');
  renderAll();
}

/* ── LocalStorage Persistence ─────────────────────────────────────── */
const LS_KEY = 'kengs-landing-finance';

function persistToLocal() {
  try {
    const data = {
      bookings: state.bookings,
      expenses: state.expenses,
      mileage: state.mileage,
      budgets: state.budgets,
      investment: state.investment,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(LS_KEY, JSON.stringify(data));
    const ts = new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
    $('auto-save-status').textContent = `auto-saved ${ts}`;
  } catch(e) { console.warn('localStorage save failed', e); }
}

function loadFromLocal() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (!data.bookings) return false;
    state.bookings = data.bookings || [];
    state.expenses = (data.expenses || []).map(e => {
      // Migrate stale localStorage: ensure status exists, normalize category casing, compute tax period
      if (!e.status) e.status = 'Business';
      if (e.category && CAT_LOOKUP[e.category.toLowerCase()]) e.category = CAT_LOOKUP[e.category.toLowerCase()];
      if (!e.taxPeriod && e.date) e.taxPeriod = e.date < '2026-03-01' ? 'Pre-Service' : 'Operational';
      return e;
    });
    state.mileage = data.mileage || [];
    if (data.budgets) {
      // Migrate budget keys to match normalized category names
      const migrated = {};
      CATEGORIES.forEach(c => migrated[c] = 0);
      Object.entries(data.budgets).forEach(([k, v]) => {
        const norm = CAT_LOOKUP[k.toLowerCase()];
        if (norm) migrated[norm] = v;
      });
      state.budgets = migrated;
    }
    if (data.investment) Object.assign(state.investment, data.investment);
    return true;
  } catch(e) { console.warn('localStorage load failed', e); return false; }
}

/* ── Keyboard shortcut: Cmd+S to save ─────────────────────────────── */
document.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key === 's') {
    e.preventDefault();
    if (state.dirty || state.fileHandle) window.saveFile();
  }
});

/* ── Warn on unsaved close ────────────────────────────────────────── */
window.addEventListener('beforeunload', e => {
  if (state.dirty) { e.preventDefault(); e.returnValue = ''; }
});

/* ── Expose globals needed by other modules ───────────────────────── */
window.switchTab = switchTab;
window._showDashboard = showDashboard;
window._persistToLocal = persistToLocal;

/* ── Auto-load on page open ───────────────────────────────────────── */
(function init() {
  if (loadFromLocal()) {
    showDashboard();
    const raw = JSON.parse(localStorage.getItem(LS_KEY));
    if (raw && raw.savedAt) {
      const d = new Date(raw.savedAt);
      $('auto-save-status').textContent = `last saved ${d.toLocaleDateString()} ${d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}`;
    }
  }
})();
