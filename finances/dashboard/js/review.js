import { state } from './state.js';
import { $, fmtMoney, esc, toast, markDirty } from './utils.js';
import { renderExpenses } from './expenses.js';

/* ── Render: Review ────────────────────────────────────────────────── */
export function renderReview() {
  const reviewItems = state.expenses
    .map((e, i) => ({...e, idx: i}))
    .filter(e => e.status === 'Review');

  $('review-count').textContent = `(${reviewItems.length} items)`;

  // Update badge in nav
  const badge = $('review-badge');
  if (reviewItems.length > 0) {
    badge.textContent = reviewItems.length;
    badge.style.display = 'inline-block';
  } else {
    badge.style.display = 'none';
  }

  if (reviewItems.length === 0) {
    $('review-body').innerHTML = '';
    $('review-empty').style.display = 'block';
    return;
  }
  $('review-empty').style.display = 'none';

  $('review-body').innerHTML = reviewItems.map(e => `<tr class="review-row">
    <td>${e.date}</td>
    <td>${esc(e.vendor)}</td>
    <td style="max-width:300px;font-size:0.8rem;color:var(--text-muted)">${esc(e.description)}</td>
    <td class="money">${fmtMoney(e.amount)}</td>
    <td>${esc(e.category)}</td>
    <td style="white-space:nowrap">
      <button class="status-btn biz ${state.expenses[e.idx]._decision==='Business'?'active-biz':''}" onclick="setReviewDecision(${e.idx},'Business',this)">✓ Business</button>
      <button class="status-btn personal ${state.expenses[e.idx]._decision==='Personal'?'active-personal':''}" onclick="setReviewDecision(${e.idx},'Personal',this)">✕ Personal</button>
    </td>
  </tr>`).join('');
}

export function setReviewDecision(idx, decision, btnEl) {
  state.expenses[idx]._decision = decision;
  // Update button states in row
  const row = btnEl.closest('tr');
  row.querySelectorAll('.status-btn').forEach(b => {
    b.classList.remove('active-biz', 'active-personal');
  });
  if (decision === 'Business') btnEl.classList.add('active-biz');
  else btnEl.classList.add('active-personal');
}

export function markAllReviewBusiness() {
  state.expenses.forEach((e, i) => {
    if (e.status === 'Review') e._decision = 'Business';
  });
  renderReview();
}

export function applyReviewDecisions() {
  let applied = 0;
  let removed = 0;
  const toRemove = [];

  state.expenses.forEach((e, i) => {
    if (e._decision) {
      e.status = e._decision;
      delete e._decision;
      applied++;
      if (e.status === 'Personal') toRemove.push(i);
    }
  });

  // Remove personal items (reverse order to preserve indices)
  toRemove.sort((a, b) => b - a).forEach(i => {
    state.expenses.splice(i, 1);
    removed++;
  });

  if (applied === 0) {
    toast('No decisions to apply — click Business or Personal first');
    return;
  }

  markDirty();
  renderReview();
  renderExpenses();
  toast(`Applied ${applied} decisions, removed ${removed} personal items`);
}

export function updateReviewBadge() {
  const count = state.expenses.filter(e => e.status === 'Review').length;
  const badge = $('review-badge');
  if (count > 0) {
    badge.textContent = count;
    badge.style.display = 'inline-block';
  } else {
    badge.style.display = 'none';
  }
}

window.setReviewDecision = setReviewDecision;
window.markAllReviewBusiness = markAllReviewBusiness;
window.applyReviewDecisions = applyReviewDecisions;
