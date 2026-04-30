// author: AEON Dev | created: 2026-04-19 | last updated: 2026-04-20
// Expense Review Queue — frontend logic
// Spec ref: docs/specs/expense-import-review.md § Review Queue Interaction
// API: Hono routes under /imports (imports.ts) — not standalone edge functions

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const BACKEND_BASE = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_BACKEND_BASE)
  || '';   // empty = same-origin Cloudflare Pages proxy to the Worker

const SCHEDULE_E_CATEGORIES = [
  'Advertising', 'Cleaning & turnover', 'Insurance', 'Mortgage interest',
  'Platform fees', 'Professional services', 'Property taxes',
  'Repairs & maintenance', 'Supplies', 'Utilities',
];

// ---------------------------------------------------------------------------
// Auth helpers (Supabase JWT stored in sessionStorage after login)
// ---------------------------------------------------------------------------
function getAuthToken() {
  return sessionStorage.getItem('sb_token') || localStorage.getItem('sb_token') || '';
}
function getWorkspaceId() {
  return sessionStorage.getItem('workspace_id') || localStorage.getItem('workspace_id') || '';
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
const state = {
  jobId: null,
  jobStatus: null,
  jobFilename: null,
  rows: [], // raw import_rows from API
  rowDecisions: {}, // rowId → { reviewState, category, propertyId }
};

// ---------------------------------------------------------------------------
// DOM refs
// ---------------------------------------------------------------------------
const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  populateCategoryFilters();
  wireUploadZone();
  wireFilters();
  $('promote-all-btn').addEventListener('click', promoteAllApproved);
  $('new-import-btn').addEventListener('click', resetToUpload);
});

function populateCategoryFilters() {
  const sel = $('filter-category');
  SCHEDULE_E_CATEGORIES.forEach((c) => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    sel.appendChild(opt);
  });
}

// ---------------------------------------------------------------------------
// Upload zone
// ---------------------------------------------------------------------------
function wireUploadZone() {
  const zone = $('upload-zone');
  const input = $('csv-file-input');

  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('drag-over');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const file = e.dataTransfer?.files?.[0];
    if (file) uploadFile(file);
  });
  input.addEventListener('change', () => {
    if (input.files?.[0]) uploadFile(input.files[0]);
  });
}

async function uploadFile(file) {
  if (!file.name.endsWith('.csv')) {
    toast('Only CSV files are supported.', 'error');
    return;
  }
  const workspaceId = getWorkspaceId();
  if (!workspaceId) {
    toast('No workspace selected. Please log in.', 'error');
    return;
  }

  $('upload-progress').style.display = 'block';

  // 1. Create the import_job first (POST /imports)
  let jobId;
  {
    const jobRes = await fetch(`${BACKEND_BASE}/imports`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${getAuthToken()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        workspace_id: workspaceId,
        import_type: 'bank_csv',
        original_filename: file.name,
      }),
    });
    const jobData = await jobRes.json();
    if (!jobRes.ok) {
      toast(jobData.error || 'Failed to create import job.', 'error');
      $('upload-progress').style.display = 'none';
      return;
    }
    jobId = jobData.data.id;
  }

  // 2. Parse the CSV (POST /imports/:jobId/parse-expenses)
  const csvText = await file.text();
  const parseRes = await fetch(`${BACKEND_BASE}/imports/${jobId}/parse-expenses`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getAuthToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ csv: csvText }),
  });
  const parseData = await parseRes.json();
  if (!parseRes.ok) {
    toast(parseData.error || 'CSV parse failed.', 'error');
    $('upload-progress').style.display = 'none';
    return;
  }

  const { summary } = parseData;
  state.jobId = jobId;
  state.jobStatus = parseData.data.status;
  state.jobFilename = file.name;

  toast(
    `Import created. ${summary.flagged} rows need review. ${summary.approved} ready to promote.`
  );
  await loadReviewQueue();
}

// ---------------------------------------------------------------------------
// Load review queue rows from Supabase REST
// ---------------------------------------------------------------------------
async function loadReviewQueue() {
  if (!state.jobId) return;

  // Fetch rows for this job via Supabase REST
  const workspaceId = getWorkspaceId();
  const supabaseUrl = (import.meta.env?.VITE_SUPABASE_URL) || '';
  const anonKey = (import.meta.env?.VITE_SUPABASE_ANON_KEY) || '';

  let rows = [];
  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/import_rows?import_job_id=eq.${state.jobId}&order=row_index.asc`,
      {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${getAuthToken()}`,
          Accept: 'application/json',
        },
      }
    );
    if (res.ok) {
      rows = await res.json();
    }
  } catch {
    toast('Could not load review rows. Check network.', 'error');
  }

  state.rows = rows;

  // Show UI
  $('upload-section').style.display = 'none';
  $('job-status-bar').style.display = 'flex';
  $('filter-section').style.display = 'block';
  $('review-table-section').style.display = 'block';

  updateJobStatusBar();
  renderRows();
}

// ---------------------------------------------------------------------------
// Job status bar
// ---------------------------------------------------------------------------
function updateJobStatusBar() {
  $('job-filename').textContent = state.jobFilename ?? '—';
  const flagged = state.rows.filter((r) => r.review_status === 'flagged').length;
  const approved = state.rows.filter((r) => r.review_status === 'approved').length;
  const total = state.rows.length;
  $('job-meta').textContent = ` — ${total} rows · ${flagged} flagged · ${approved} approved`;

  const pill = $('job-status-pill');
  pill.textContent = state.jobStatus ?? '—';
  pill.className = `status-pill pill-${state.jobStatus ?? 'uploaded'}`;

  $('promote-all-btn').disabled = approved === 0;
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
    const norm = r.normalized_payload ?? {};
    if (category && norm.candidate_category !== category) return false;
    if (merchant && !(norm.merchant_name ?? '').toLowerCase().includes(merchant)) return false;
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
    return;
  }
  $('review-empty').style.display = 'none';

  tbody.innerHTML = rows.map((r) => renderRow(r)).join('');

  // Wire inline controls
  tbody.querySelectorAll('.cat-select').forEach((sel) => {
    sel.addEventListener('change', (e) => {
      const rowId = e.target.dataset.rowId;
      if (!state.rowDecisions[rowId]) state.rowDecisions[rowId] = {};
      state.rowDecisions[rowId].category = e.target.value;
    });
  });
}

function renderRow(r) {
  const norm = r.normalized_payload ?? {};
  const errors = r.validation_errors ?? [];
  const conf = r.confidence_score ?? 0;
  const confClass = conf >= 0.9 ? 'conf-high' : conf >= 0.6 ? 'conf-med' : 'conf-low';
  const confLabel = `${Math.round(conf * 100)}%`;

  const isTerminal = r.review_status === 'promoted' || r.review_status === 'rejected';

  const categoryOptions = SCHEDULE_E_CATEGORIES.map(
    (c) => `<option value="${esc(c)}" ${norm.candidate_category === c ? 'selected' : ''}>${esc(c)}</option>`
  ).join('');

  const catSelect = isTerminal
    ? `<span>${esc(norm.candidate_category ?? '—')}</span>`
    : `<select class="cat-select" data-row-id="${r.id}">${categoryOptions}</select>`;

  const actions = isTerminal
    ? `<span class="muted">${r.review_status === 'promoted' ? 'Promoted' : 'Rejected'}</span>`
    : `<div class="classify-controls">
        <button class="btn btn-biz" data-action="classify" data-state="Business" data-row-id="${r.id}" title="Mark as Business">✓ Biz</button>
        <button class="btn btn-pers" data-action="classify" data-state="Personal" data-row-id="${r.id}" title="Mark as Personal">✕ Personal</button>
        <button class="btn btn-hold" data-action="classify" data-state="Review" data-row-id="${r.id}" title="Hold for further review">? Hold</button>
        <button class="btn btn-reject" data-action="reject" data-row-id="${r.id}" title="Reject this row (not an expense)">Reject</button>
        ${r.review_status === 'approved'
          ? `<button class="btn btn-promote" data-action="promote" data-row-id="${r.id}" title="Promote to committed expense">Promote</button>`
          : ''}
      </div>`;

  const errorHtml = errors.length
    ? `<div class="muted" style="color:var(--red);font-size:11px;margin-top:2px">${esc(errors[0])}</div>`
    : '';

  return `<tr data-row-id="${r.id}" data-cy="review-row">
    <td class="mono">${esc(norm.transaction_date ?? '—')}</td>
    <td>${esc(norm.merchant_name ?? '—')}${errorHtml}</td>
    <td class="muted" style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(norm.description ?? '')}">${esc(norm.description ?? '')}</td>
    <td class="money">${fmtMoney(norm.amount)}</td>
    <td>${catSelect}</td>
    <td><span class="conf-badge rs-${r.review_status}">${esc(norm.candidate_review_state ?? norm.candidate_review_state ?? '—')}</span></td>
    <td><span class="conf-badge ${confClass}">${confLabel}</span></td>
    <td><span class="conf-badge rs-${r.review_status}">${esc(r.review_status)}</span></td>
    <td>${actions}</td>
  </tr>`;
}

// ---------------------------------------------------------------------------
// Event delegation for classify / reject / promote buttons
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
  const norm = row.normalized_payload ?? {};
  const category = decision.category ?? norm.candidate_category ?? '';

  btn.disabled = true;

  if (action === 'classify') {
    await doReviewAction({
      action: 'classify',
      import_row_id: rowId,
      import_job_id: state.jobId,
      workspace_id: getWorkspaceId(),
      review_state: reviewState,
      category: category || 'Supplies',
      property_id: decision.propertyId ?? null,
      description: norm.description ?? null,
      payment_method: norm.payment_method ?? null,
      documentation_status: 'N',
    });
  } else if (action === 'reject') {
    await doReviewAction({
      action: 'reject',
      import_row_id: rowId,
      import_job_id: state.jobId,
      workspace_id: getWorkspaceId(),
    });
  } else if (action === 'promote') {
    await doReviewAction({
      action: 'promote',
      import_row_id: rowId,
      import_job_id: state.jobId,
      workspace_id: getWorkspaceId(),
      review_state: norm.candidate_review_state ?? 'Review',
      category: category || 'Supplies',
      property_id: decision.propertyId ?? null,
      description: norm.description ?? null,
      payment_method: norm.payment_method ?? null,
      documentation_status: 'N',
    });
  }

  btn.disabled = false;
});

async function doReviewAction(body) {
  try {
    const res = await fetch(`${BACKEND_BASE}/expense-import/review-action`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${getAuthToken()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      toast(data.error || 'Action failed.', 'error');
      return;
    }

    // Optimistic update of row in state
    const row = state.rows.find((r) => r.id === body.import_row_id);
    if (row) {
      if (body.action === 'classify') {
        row.review_status = 'approved';
        if (!row.normalized_payload) row.normalized_payload = {};
        row.normalized_payload.candidate_review_state = body.review_state;
        if (body.category) row.normalized_payload.candidate_category = body.category;
      } else if (body.action === 'reject') {
        row.review_status = 'rejected';
      } else if (body.action === 'promote') {
        row.review_status = 'promoted';
      }
    }
    if (body.action === 'promote' && data.expense_id) {
      toast(`Promoted → expense ${data.expense_id.slice(0, 8)}… (${data.tax_period})`);
    } else {
      toast('Saved.');
    }
    renderRows();
    updateJobStatusBar();
  } catch (err) {
    toast(`Error: ${err.message}`, 'error');
  }
}

// ---------------------------------------------------------------------------
// Promote all approved rows
// ---------------------------------------------------------------------------
async function promoteAllApproved() {
  const approved = state.rows.filter((r) => r.review_status === 'approved');
  if (approved.length === 0) return;

  $('promote-all-btn').disabled = true;
  let promoted = 0;

  for (const row of approved) {
    const norm = row.normalized_payload ?? {};
    const decision = state.rowDecisions[row.id] ?? {};
    await doReviewAction({
      action: 'promote',
      import_row_id: row.id,
      import_job_id: state.jobId,
      workspace_id: getWorkspaceId(),
      review_state: norm.candidate_review_state ?? 'Review',
      category: decision.category ?? norm.candidate_category ?? 'Supplies',
      property_id: decision.propertyId ?? null,
      description: norm.description ?? null,
      payment_method: norm.payment_method ?? null,
      documentation_status: 'N',
    });
    promoted++;
  }

  toast(`Promoted ${promoted} expense${promoted !== 1 ? 's' : ''}.`);
  $('promote-all-btn').disabled = false;
}

// ---------------------------------------------------------------------------
// Reset to upload view
// ---------------------------------------------------------------------------
function resetToUpload() {
  state.jobId = null;
  state.jobStatus = null;
  state.jobFilename = null;
  state.rows = [];
  state.rowDecisions = {};
  $('review-tbody').innerHTML = '';
  $('upload-section').style.display = 'block';
  $('job-status-bar').style.display = 'none';
  $('filter-section').style.display = 'none';
  $('review-table-section').style.display = 'none';
  $('csv-file-input').value = '';
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------
function fmtMoney(n) {
  if (n == null || isNaN(n)) return '—';
  return (n < 0 ? '-' : '') + '$' + Math.abs(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}

let toastTimer;
function toast(msg, type = 'ok') {
  const el = $('toast');
  el.textContent = msg;
  el.style.background = type === 'error' ? '#991b1b' : '#1e293b';
  el.style.display = 'block';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.style.display = 'none'; }, 3500);
}
