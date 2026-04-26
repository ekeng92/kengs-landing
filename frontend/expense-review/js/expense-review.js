// author: AEON Dev | created: 2026-04-19 | last updated: 2026-04-21
// Expense Review Queue — dark theme redesign
// Wired to Hono backend API

const API = location.hostname === 'localhost' ? 'http://localhost:8787' : 'https://kengs-landing-api.kengs-landing.workers.dev';
const WS_ID = 'b0604861-b7ae-4f1e-a7cb-fe066d57c623';
const PROPERTY_360CR = '0e8ab13c-7976-4b9d-a6c6-3561f7a73f40';

const SCHEDULE_E_CATEGORIES = [
  'Supplies', 'Repairs & maintenance', 'Cleaning & turnover', 'Utilities',
  'Insurance', 'Mortgage interest', 'Platform fees', 'Professional services',
  'Property taxes', 'Advertising', 'Other',
];

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
const state = {
  jobId: null,
  jobStatus: null,
  jobFilename: null,
  rows: [],
  rowDecisions: {},
};

const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  populateCategoryFilter();
  wireUploadZone();
  wireFilters();
  $('promote-all-btn').addEventListener('click', promoteAllApproved);
  $('new-import-btn').addEventListener('click', resetToUpload);
  $('completion-new-import').addEventListener('click', resetToUpload);
});

function populateCategoryFilter() {
  const sel = $('filter-category');
  SCHEDULE_E_CATEGORIES.forEach((c) => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    sel.appendChild(opt);
  });
}

// ---------------------------------------------------------------------------
// Upload
// ---------------------------------------------------------------------------
function wireUploadZone() {
  const zone = $('upload-zone');
  const input = $('csv-file-input');
  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault(); zone.classList.remove('drag-over');
    if (e.dataTransfer?.files?.[0]) uploadFile(e.dataTransfer.files[0]);
  });
  input.addEventListener('change', () => { if (input.files?.[0]) uploadFile(input.files[0]); });
}

async function uploadFile(file) {
  if (!file.name.endsWith('.csv')) { toast('Only CSV files are supported.', 'error'); return; }
  $('upload-progress').style.display = 'block';

  try {
    const jobRes = await fetch(`${API}/imports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspace_id: WS_ID, import_type: 'expense', original_filename: file.name }),
    });
    const jobData = await jobRes.json();
    if (!jobRes.ok) { toast(jobData.error || 'Failed to create import job.', 'error'); return; }

    state.jobId = jobData.data.id;
    state.jobFilename = file.name;

    const csvText = await file.text();
    const parseRes = await fetch(`${API}/imports/${state.jobId}/parse-expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csv: csvText }),
    });
    const parseData = await parseRes.json();
    if (!parseRes.ok) { toast(parseData.error || 'Failed to parse CSV.', 'error'); return; }

    state.jobStatus = parseData.data?.status ?? 'parsed';
    const s = parseData.summary || {};
    toast(`Parsed ${s.total || 0} rows — ${s.approved || 0} auto-approved, ${s.flagged || 0} need review.`);
    await loadReviewQueue();
  } catch (err) {
    toast(`Upload error: ${err.message}`, 'error');
  } finally {
    $('upload-progress').style.display = 'none';
  }
}

// ---------------------------------------------------------------------------
// Load rows
// ---------------------------------------------------------------------------
async function loadReviewQueue() {
  if (!state.jobId) return;
  try {
    const res = await fetch(`${API}/imports/${state.jobId}/rows`);
    if (res.ok) { state.rows = (await res.json()).data || []; }
    else { toast('Could not load review rows.', 'error'); state.rows = []; }
  } catch { toast('Network error loading rows.', 'error'); state.rows = []; }

  $('upload-section').style.display = 'none';
  $('review-section').style.display = 'block';
  $('header-meta').textContent = state.jobFilename ?? '';
  updateSummary();
  renderRows();
}

// ---------------------------------------------------------------------------
// Summary cards
// ---------------------------------------------------------------------------
function updateSummary() {
  const counts = { flagged: 0, approved: 0, rejected: 0, promoted: 0 };
  state.rows.forEach((r) => { if (counts[r.review_status] !== undefined) counts[r.review_status]++; });
  $('s-total').textContent = state.rows.length;
  $('s-flagged').textContent = counts.flagged;
  $('s-approved').textContent = counts.approved;
  $('s-rejected').textContent = counts.rejected;
  $('s-promoted').textContent = counts.promoted;
  $('promote-all-btn').disabled = counts.approved === 0;
}

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------
function wireFilters() {
  ['filter-status', 'filter-category', 'filter-merchant'].forEach((id) => {
    $(id).addEventListener('input', renderRows);
  });
}

function filteredRows() {
  const status = $('filter-status').value;
  const category = $('filter-category').value;
  const merchant = $('filter-merchant').value.toLowerCase();
  return state.rows.filter((r) => {
    if (status && r.review_status !== status) return false;
    const n = r.normalized_payload ?? {};
    if (category && n.candidate_category !== category) return false;
    if (merchant && !(n.merchant_name ?? '').toLowerCase().includes(merchant)) return false;
    return true;
  });
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------
function renderRows() {
  const rows = filteredRows();
  const tbody = $('review-tbody');
  $('row-count-label').textContent = `${rows.length} row${rows.length !== 1 ? 's' : ''}`;

  if (rows.length === 0) {
    tbody.innerHTML = '';
    $('review-empty').style.display = 'block';
    $('table-wrap').style.display = 'none';
    return;
  }
  $('review-empty').style.display = 'none';
  $('table-wrap').style.display = 'block';
  tbody.innerHTML = rows.map(renderRow).join('');

  // Wire category selects
  tbody.querySelectorAll('.cat-select').forEach((sel) => {
    sel.addEventListener('change', (e) => {
      const rowId = e.target.dataset.rowId;
      if (!state.rowDecisions[rowId]) state.rowDecisions[rowId] = {};
      state.rowDecisions[rowId].category = e.target.value;
    });
  });
}

function renderRow(r) {
  const n = r.normalized_payload ?? {};
  const errors = r.validation_errors ?? [];
  const isTerminal = r.review_status === 'promoted' || r.review_status === 'rejected';

  // Merchant cell: name + description subtitle + warning badges
  let merchantHtml = `<div class="merchant-name">${esc(n.merchant_name ?? '—')}</div>`;
  if (n.description && n.description !== n.merchant_name) {
    merchantHtml += `<div class="merchant-desc" title="${esc(n.description)}">${esc(n.description)}</div>`;
  }
  // Show human-friendly warning badges for errors
  errors.forEach((err) => {
    const msg = friendlyError(err);
    const cls = msg.isDuplicate ? 'warn-dup' : 'warn-err';
    merchantHtml += `<div class="warn-badge ${cls}" title="${esc(err)}">⚠ ${esc(msg.label)}</div>`;
  });

  // Category: dropdown for actionable rows, plain text for terminal
  const catValue = n.candidate_category || '';
  let catHtml;
  if (isTerminal) {
    catHtml = `<span style="font-size:0.82rem">${esc(catValue || '—')}</span>`;
  } else {
    const options = SCHEDULE_E_CATEGORIES.map((c) =>
      `<option value="${esc(c)}" ${catValue === c ? 'selected' : ''}>${esc(c)}</option>`
    ).join('');
    catHtml = `<select class="cat-select" data-row-id="${r.id}"><option value="" ${!catValue ? 'selected' : ''}>Select…</option>${options}</select>`;
  }

  // Status badge
  const statusLabel = { flagged: 'Review', approved: 'Classified', promoted: 'Committed', rejected: 'Rejected' }[r.review_status] || r.review_status;
  const statusHtml = `<span class="status-badge status-${r.review_status}">${statusLabel}</span>`;

  // Actions
  let actionsHtml;
  if (isTerminal) {
    actionsHtml = `<span style="color:var(--text-dim);font-size:0.78rem">${r.review_status === 'promoted' ? 'Done' : 'Skipped'}</span>`;
  } else {
    actionsHtml = `<div class="row-actions">
      <button class="btn-biz" data-action="classify" data-state="Business" data-row-id="${r.id}">✓ Business</button>
      <button class="btn-pers" data-action="classify" data-state="Personal" data-row-id="${r.id}">✕ Personal</button>
      <button class="btn-reject" data-action="reject" data-row-id="${r.id}">Skip</button>
    </div>`;
  }

  return `<tr class="row-${r.review_status}" data-row-id="${r.id}" data-cy="review-row">
    <td class="mono">${esc(n.transaction_date ?? '—')}</td>
    <td>${merchantHtml}</td>
    <td class="money">$${fmtAmount(n.amount)}</td>
    <td>${catHtml}</td>
    <td>${statusHtml}</td>
    <td>${actionsHtml}</td>
  </tr>`;
}

function friendlyError(err) {
  if (typeof err !== 'string') err = err.reason || err.message || JSON.stringify(err);
  const lower = err.toLowerCase();
  if (lower.includes('duplicate') || lower.includes('dedupe')) return { label: 'Possible duplicate', isDuplicate: true };
  if (lower.includes('unparseable date')) return { label: 'Invalid date', isDuplicate: false };
  if (lower.includes('non-positive') || lower.includes('refund')) return { label: 'Refund / credit', isDuplicate: false };
  if (lower.includes('missing merchant')) return { label: 'No merchant name', isDuplicate: false };
  if (lower.includes('unparseable amount')) return { label: 'Invalid amount', isDuplicate: false };
  return { label: err.slice(0, 40), isDuplicate: false };
}

// ---------------------------------------------------------------------------
// Actions (classify / reject / promote)
// ---------------------------------------------------------------------------
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;
  const rowId = btn.dataset.rowId;
  const reviewState = btn.dataset.state;
  if (!rowId) return;

  const row = state.rows.find((r) => r.id === rowId);
  if (!row) return;

  const decision = state.rowDecisions[rowId] ?? {};
  const n = row.normalized_payload ?? {};
  const category = decision.category ?? n.candidate_category ?? 'Supplies';

  btn.disabled = true;

  try {
    if (action === 'classify') {
      const res = await fetch(`${API}/imports/${state.jobId}/rows/${rowId}/classify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          review_state: reviewState, category,
          property_id: PROPERTY_360CR,
          description: n.description ?? null,
          payment_method: n.payment_method ?? null,
        }),
      });
      if (!res.ok) { const d = await res.json(); toast(d.error || 'Classify failed.', 'error'); return; }
      row.review_status = 'approved';
      if (!row.normalized_payload) row.normalized_payload = {};
      row.normalized_payload.candidate_review_state = reviewState;
      if (category) row.normalized_payload.candidate_category = category;
      toast(`Marked as ${reviewState}.`);

    } else if (action === 'reject') {
      const res = await fetch(`${API}/imports/${state.jobId}/rows/${rowId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) { const d = await res.json(); toast(d.error || 'Reject failed.', 'error'); return; }
      row.review_status = 'rejected';
      toast('Skipped.');
    }
  } catch (err) {
    toast(`Error: ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
    renderRows();
    updateSummary();
    checkCompletion();
  }
});

// ---------------------------------------------------------------------------
// Promote all approved
// ---------------------------------------------------------------------------
async function promoteAllApproved() {
  const approved = state.rows.filter((r) => r.review_status === 'approved');
  if (approved.length === 0) return;
  $('promote-all-btn').disabled = true;
  toast(`Committing ${approved.length} expense${approved.length !== 1 ? 's' : ''}…`);

  try {
    const res = await fetch(`${API}/imports/${state.jobId}/promote-expenses`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
    });
    const data = await res.json();
    if (!res.ok) { toast(data.error || 'Commit failed.', 'error'); return; }
    const s = data.summary || {};
    toast(`Committed ${s.promoted ?? 0} expense${s.promoted !== 1 ? 's' : ''}. ${s.skipped ?? 0} skipped.`);
    await loadReviewQueue();
    checkCompletion();
  } catch (err) {
    toast(`Error: ${err.message}`, 'error');
  } finally {
    $('promote-all-btn').disabled = false;
  }
}

// ---------------------------------------------------------------------------
// Reset
// ---------------------------------------------------------------------------
function resetToUpload() {
  state.jobId = null;
  state.jobStatus = null;
  state.jobFilename = null;
  state.rows = [];
  state.rowDecisions = {};
  $('review-tbody').innerHTML = '';
  $('upload-section').style.display = 'block';
  $('review-section').style.display = 'none';
  $('completion-banner').style.display = 'none';
  $('header-meta').textContent = '';
  $('csv-file-input').value = '';
}

// ---------------------------------------------------------------------------
// Completion detection
// ---------------------------------------------------------------------------
function checkCompletion() {
  if (state.rows.length === 0) return;
  const pending = state.rows.filter((r) => r.review_status !== 'promoted' && r.review_status !== 'rejected');
  if (pending.length > 0) { $('completion-banner').style.display = 'none'; return; }

  const promoted = state.rows.filter((r) => r.review_status === 'promoted').length;
  const rejected = state.rows.filter((r) => r.review_status === 'rejected').length;
  const total = state.rows.length;

  let lines = [`All ${total} row${total !== 1 ? 's' : ''} processed.`];
  if (promoted > 0) lines.push(`${promoted} expense${promoted !== 1 ? 's' : ''} committed to your books.`);
  if (rejected > 0) lines.push(`${rejected} row${rejected !== 1 ? 's' : ''} skipped.`);
  lines.push('Your dashboard is updated — head there to review totals and export.');

  $('completion-summary').innerHTML = lines.join('<br>');
  $('completion-banner').style.display = 'block';
  $('completion-banner').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------
function fmtAmount(n) {
  if (n == null || isNaN(n)) return '0.00';
  return Math.abs(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}

let toastTimer;
function toast(msg, type = 'ok') {
  const el = $('toast');
  el.textContent = msg;
  el.className = type === 'error' ? 'toast-error' : 'toast-ok';
  el.style.display = 'block';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.style.display = 'none'; }, 3500);
}
