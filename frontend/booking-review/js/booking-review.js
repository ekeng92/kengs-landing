// author: AEON Dev | created: 2026-04-20 | last updated: 2026-04-21
// Booking Import Review — dark theme redesign
// Wired to Hono backend API at localhost:8787

const API = 'http://localhost:8787';
const WS_ID = 'b0604861-b7ae-4f1e-a7cb-fe066d57c623';
const PROPERTY_360CR = '0e8ab13c-7976-4b9d-a6c6-3561f7a73f40';

let jobId = null;
let rows = [];
let jobStatus = null;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function fmt(date) {
  if (!date) return '<span class="muted">—</span>';
  const d = new Date(date + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtMoney(amount) {
  if (amount === null || amount === undefined) return '<span class="muted">—</span>';
  return '$' + Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}

function showToast(msg, durationMs = 2800) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.style.display = 'block';
  clearTimeout(el._timer);
  el._timer = setTimeout(() => { el.style.display = 'none'; }, durationMs);
}

function friendlyFlag(errors) {
  if (!errors || errors.length === 0) return null;
  const raw = typeof errors[0] === 'string' ? errors[0] : (errors[0].reason || errors[0].message || 'Flagged');
  const lower = raw.toLowerCase();
  if (lower.includes('duplicate')) return { label: 'Possible duplicate', cls: 'warn-dup' };
  if (lower.includes('date')) return { label: 'Date issue', cls: 'warn-err' };
  if (lower.includes('payout') || lower.includes('zero')) return { label: 'Zero payout', cls: 'warn-err' };
  if (lower.includes('guest') || lower.includes('missing')) return { label: 'Missing info', cls: 'warn-err' };
  return { label: raw.slice(0, 30), cls: 'warn-err' };
}

// ---------------------------------------------------------------------------
// Upload
// ---------------------------------------------------------------------------
async function uploadFile(file) {
  if (!file.name.endsWith('.csv')) { showToast('Only CSV files are supported.'); return; }
  document.getElementById('upload-progress').style.display = 'block';

  try {
    const jobRes = await fetch(`${API}/imports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspace_id: WS_ID, import_type: 'booking', original_filename: file.name }),
    });
    const jobData = await jobRes.json();
    if (!jobRes.ok) { showToast(jobData.error || 'Failed to create import job.'); return; }
    jobId = jobData.data.id;

    const csvText = await file.text();
    const parseRes = await fetch(`${API}/imports/${jobId}/parse-bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ property_id: PROPERTY_360CR, csv: csvText }),
    });
    const parseData = await parseRes.json();
    if (!parseRes.ok) { showToast(parseData.error || 'Failed to parse CSV.'); return; }

    jobStatus = parseData.data?.status ?? 'parsed';
    const s = parseData.summary || {};
    showToast(`Parsed ${s.total || 0} bookings — ${s.auto_promotable || 0} eligible, ${s.flagged || 0} flagged.`);
    await loadRows();
    showReviewUI();
  } catch (err) {
    showToast(`Upload error: ${err.message}`);
  } finally {
    document.getElementById('upload-progress').style.display = 'none';
  }
}

async function loadRows() {
  if (!jobId) return;
  const res = await fetch(`${API}/imports/${jobId}/rows`);
  if (res.ok) { rows = (await res.json()).data || []; }
  else { rows = []; }
}

function showReviewUI() {
  document.getElementById('upload-section').style.display = 'none';
  document.getElementById('review-section').style.display = 'block';
  renderQueue();
  updateSummary();
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
function updateSummary() {
  const pending = rows.filter(r => r.review_status === 'pending').length;
  const approved = rows.filter(r => r.review_status === 'approved').length;
  const promoted = rows.filter(r => r.review_status === 'promoted').length;
  const flagged = rows.filter(r => r.review_status === 'flagged').length;
  const rejected = rows.filter(r => r.review_status === 'rejected').length;

  document.getElementById('stat-total').textContent = rows.length;
  document.getElementById('stat-auto').textContent = pending + approved + promoted;
  document.getElementById('stat-flagged').textContent = flagged;
  document.getElementById('stat-rejected').textContent = rejected;

  const promoteBtn = document.getElementById('promote-all-btn');
  if (promoteBtn) promoteBtn.disabled = (pending + approved) === 0;
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------
function renderQueue() {
  const tbody = document.getElementById('review-tbody');
  const emptyEl = document.getElementById('review-empty');
  tbody.innerHTML = '';

  if (rows.length === 0) { emptyEl.style.display = 'block'; return; }
  emptyEl.style.display = 'none';

  rows.forEach(row => {
    const n = row.normalized_payload || {};
    const tr = document.createElement('tr');
    tr.className = 'row-' + row.review_status;
    const isResolved = row.review_status === 'promoted' || row.review_status === 'rejected';

    // Build flag warning badge if present
    const flag = friendlyFlag(row.validation_errors);
    const flagHtml = flag ? `<div class="warn-badge ${flag.cls}" style="margin-top:2px">⚠ ${esc(flag.label)}</div>` : '';

    // Status
    const statusMap = { flagged: 'Review', approved: 'Ready', pending: 'Ready', promoted: 'Committed', rejected: 'Rejected' };
    const statusLabel = statusMap[row.review_status] || row.review_status;

    // Actions
    const actionsHtml = isResolved
      ? `<span style="color:var(--text-dim);font-size:0.78rem">${row.review_status === 'promoted' ? 'Done' : 'Skipped'}</span>`
      : `<div class="row-actions">
          <button class="btn-approve" onclick="approveRow('${row.id}')">✓ Approve</button>
          <button class="btn-row-reject" onclick="rejectRow('${row.id}')">Skip</button>
        </div>`;

    tr.innerHTML = [
      `<td class="mono">${esc(n.source_confirmation_code || '—')}</td>`,
      `<td>${esc(n.guest_name || '(unknown)')}${flagHtml}</td>`,
      `<td>${fmt(n.check_in_date)}</td>`,
      `<td>${fmt(n.check_out_date)}</td>`,
      `<td class="muted">${n.nights != null ? n.nights : '—'}</td>`,
      `<td class="money">${fmtMoney(n.net_payout_amount)}</td>`,
      `<td><span class="status-badge status-${row.review_status}">${statusLabel}</span></td>`,
      `<td>${actionsHtml}</td>`,
    ].join('');

    tbody.appendChild(tr);
  });

  updateSummary();
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------
async function approveRow(id) {
  const row = rows.find(r => r.id === id);
  if (!row) return;
  try {
    const res = await fetch(`${API}/imports/${jobId}/rows/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ review_status: 'approved' }),
    });
    if (!res.ok) { const d = await res.json(); showToast(d.error || 'Approve failed.'); return; }
    row.review_status = 'approved';
    renderQueue();
    showToast('Booking approved — eligible for commit.');
    checkCompletion();
  } catch (err) { showToast('Error: ' + err.message); }
}

async function rejectRow(id) {
  const row = rows.find(r => r.id === id);
  if (!row) return;
  try {
    const res = await fetch(`${API}/imports/${jobId}/rows/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ review_status: 'rejected' }),
    });
    if (!res.ok) { const d = await res.json(); showToast(d.error || 'Reject failed.'); return; }
    row.review_status = 'rejected';
    renderQueue();
    showToast('Booking skipped.');
    checkCompletion();
  } catch (err) { showToast('Error: ' + err.message); }
}

async function promoteAll() {
  const btn = document.getElementById('promote-all-btn');
  if (btn) btn.disabled = true;
  try {
    const res = await fetch(`${API}/imports/${jobId}/promote-bookings`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
    });
    const data = await res.json();
    if (!res.ok) { showToast(data.error || 'Commit failed.'); return; }
    const s = data.summary || {};
    showToast(`Committed ${s.promoted || 0} booking${(s.promoted || 0) !== 1 ? 's' : ''}. ${s.skipped || 0} skipped.`);
    await loadRows();
    renderQueue();
    checkCompletion();
  } catch (err) { showToast('Error: ' + err.message); }
  finally { if (btn) btn.disabled = false; }
}

// ---------------------------------------------------------------------------
// Reset
// ---------------------------------------------------------------------------
function resetToUpload() {
  jobId = null; rows = []; jobStatus = null;
  document.getElementById('upload-section').style.display = 'block';
  document.getElementById('review-section').style.display = 'none';
  document.getElementById('completion-banner').style.display = 'none';
  document.getElementById('csv-file-input').value = '';
}

// ---------------------------------------------------------------------------
// Completion detection
// ---------------------------------------------------------------------------
function checkCompletion() {
  if (rows.length === 0) return;
  const pending = rows.filter(r => r.review_status !== 'promoted' && r.review_status !== 'rejected');
  if (pending.length > 0) { document.getElementById('completion-banner').style.display = 'none'; return; }

  const promoted = rows.filter(r => r.review_status === 'promoted').length;
  const rejected = rows.filter(r => r.review_status === 'rejected').length;

  let lines = [`All ${rows.length} booking${rows.length !== 1 ? 's' : ''} processed.`];
  if (promoted > 0) lines.push(`${promoted} booking${promoted !== 1 ? 's' : ''} committed to your books.`);
  if (rejected > 0) lines.push(`${rejected} booking${rejected !== 1 ? 's' : ''} skipped.`);
  lines.push('Your dashboard is updated — head there to review revenue and export.');

  document.getElementById('completion-summary').innerHTML = lines.join('<br>');
  document.getElementById('completion-banner').style.display = 'block';
  document.getElementById('completion-banner').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  const zone = document.getElementById('upload-zone');
  const input = document.getElementById('csv-file-input');

  if (zone) {
    zone.addEventListener('click', () => input.click());
    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', (e) => {
      e.preventDefault(); zone.classList.remove('drag-over');
      if (e.dataTransfer?.files?.[0]) uploadFile(e.dataTransfer.files[0]);
    });
  }
  if (input) input.addEventListener('change', () => { if (input.files?.[0]) uploadFile(input.files[0]); });

  const promoteBtn = document.getElementById('promote-all-btn');
  if (promoteBtn) promoteBtn.addEventListener('click', promoteAll);

  const newBtn = document.getElementById('new-import-btn');
  if (newBtn) newBtn.addEventListener('click', resetToUpload);

  const completionNewBtn = document.getElementById('completion-new-import');
  if (completionNewBtn) completionNewBtn.addEventListener('click', resetToUpload);
});
