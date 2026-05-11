// author: AEON Dev | created: 2026-05-10
// CSV Mapping Wizard — shared modal for expense + booking import pages.
// Opens when auto-detection fails or returns low confidence.
// Lets users manually map CSV columns and optionally save as a template.

(function () {
  'use strict';

  // ── XSS escape ──────────────────────────────────────────────────────
  function esc(s) {
    if (s == null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  }

  // ── Logical fields per entity type ──────────────────────────────────
  const LOGICAL_FIELDS = {
    expense: [
      { key: 'transaction_date', label: 'Transaction Date', required: true },
      { key: 'amount',           label: 'Amount',           required: true },
      { key: 'merchant_name',    label: 'Merchant / Payee', required: false },
      { key: 'description',      label: 'Description',      required: false },
      { key: 'candidate_category', label: 'Category',       required: false },
      { key: 'reference_id',     label: 'Reference ID',     required: false },
    ],
    booking: [
      { key: 'check_in_date',       label: 'Check-in Date',     required: true },
      { key: 'check_out_date',      label: 'Check-out Date',    required: true },
      { key: 'net_payout_amount',   label: 'Net Payout',        required: true },
      { key: 'guest_name',          label: 'Guest Name',        required: false },
      { key: 'source_confirmation_code', label: 'Confirmation Code', required: false },
      { key: 'nights',              label: 'Nights',            required: false },
      { key: 'gross_revenue_amount', label: 'Gross Revenue',    required: false },
      { key: 'cleaning_fee_amount', label: 'Cleaning Fee',      required: false },
      { key: 'platform_fee_amount', label: 'Platform Fee',      required: false },
      { key: 'tax_amount',          label: 'Tax Amount',        required: false },
    ],
  };

  const AMOUNT_SIGNS = [
    { value: 'negative_is_debit', label: 'Negative = Debit' },
    { value: 'separate_columns',  label: 'Separate Debit/Credit Columns' },
    { value: 'always_positive',   label: 'Always Positive' },
  ];

  const DATE_FORMATS = [
    { value: 'auto',       label: 'Auto-detect' },
    { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
    { value: 'M/D/YYYY',   label: 'M/D/YYYY' },
    { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
    { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
  ];

  // ── Inject wizard CSS once ──────────────────────────────────────────
  let cssInjected = false;
  function injectCSS() {
    if (cssInjected) return;
    cssInjected = true;
    const style = document.createElement('style');
    style.textContent = `
      .cmw-backdrop {
        position: fixed; inset: 0; z-index: 1000;
        background: rgba(0,0,0,.6);
        display: flex; align-items: center; justify-content: center;
        opacity: 0; transition: opacity .2s ease;
        padding: 16px;
      }
      .cmw-backdrop.cmw-visible { opacity: 1; }
      .cmw-dialog {
        background: var(--surface, #1a1d27);
        border: 1px solid var(--border, #2e3345);
        border-radius: var(--radius, 12px);
        max-width: 700px; width: 100%;
        max-height: 85vh; overflow-y: auto;
        box-shadow: 0 12px 40px rgba(0,0,0,.5);
        transform: translateY(20px); opacity: 0;
        transition: transform .25s ease, opacity .25s ease;
        padding: 0;
      }
      .cmw-backdrop.cmw-visible .cmw-dialog {
        transform: translateY(0); opacity: 1;
      }
      .cmw-dialog::-webkit-scrollbar { width: 6px; }
      .cmw-dialog::-webkit-scrollbar-track { background: transparent; }
      .cmw-dialog::-webkit-scrollbar-thumb { background: var(--border2, #3d4255); border-radius: 3px; }
      .cmw-header {
        display: flex; align-items: center; justify-content: space-between;
        padding: 16px 20px; border-bottom: 1px solid var(--border, #2e3345);
        position: sticky; top: 0; background: var(--surface, #1a1d27); z-index: 1;
      }
      .cmw-header h2 { font-size: 1rem; font-weight: 600; margin: 0; color: var(--text, #e2e4ea); }
      .cmw-close {
        background: none; border: none; color: var(--text-muted, #8b90a0);
        font-size: 1.4rem; cursor: pointer; padding: 4px 8px; line-height: 1;
        border-radius: var(--radius-sm, 6px); transition: background .15s;
        min-height: auto;
      }
      .cmw-close:hover { background: var(--surface2, #222633); color: var(--text, #e2e4ea); }
      .cmw-body { padding: 20px; }
      .cmw-step-label {
        font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.5px;
        color: var(--text-dim, #5a5f72); margin-bottom: 12px; font-weight: 600;
      }

      /* Step 1: Template matches */
      .cmw-match-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }
      .cmw-match {
        display: flex; align-items: center; gap: 12px;
        padding: 12px 14px; border: 1px solid var(--border, #2e3345);
        border-radius: var(--radius-sm, 6px); background: var(--surface2, #222633);
        cursor: pointer; transition: border-color .15s, background .15s;
      }
      .cmw-match:hover { border-color: var(--accent-light, #60a5fa); background: var(--surface3, #2a2e3b); }
      .cmw-match-info { flex: 1; min-width: 0; }
      .cmw-match-name { font-weight: 600; font-size: 0.9rem; color: var(--text, #e2e4ea); }
      .cmw-match-meta { font-size: 0.75rem; color: var(--text-muted, #8b90a0); margin-top: 2px; }
      .cmw-conf-bar {
        width: 60px; height: 6px; border-radius: 3px;
        background: var(--surface3, #2a2e3b); overflow: hidden; flex-shrink: 0;
      }
      .cmw-conf-fill { height: 100%; border-radius: 3px; transition: width .3s; }
      .cmw-conf-high { background: var(--positive, #4ade80); }
      .cmw-conf-med  { background: var(--warning, #fbbf24); }
      .cmw-conf-low  { background: var(--negative, #f87171); }
      .cmw-conf-pct { font-size: 0.75rem; font-weight: 600; min-width: 36px; text-align: right; }
      .cmw-match-btn {
        padding: 6px 14px; border-radius: var(--radius-sm, 6px);
        background: var(--accent, #2563eb); color: #fff; border: none;
        font-size: 0.78rem; font-weight: 600; cursor: pointer;
        transition: filter .15s; min-height: auto; white-space: nowrap;
      }
      .cmw-match-btn:hover { filter: brightness(1.15); }
      .cmw-custom-link {
        display: inline-block; margin-top: 8px; font-size: 0.8rem;
        color: var(--accent-light, #60a5fa); cursor: pointer;
        text-decoration: underline; background: none; border: none;
        padding: 0; min-height: auto;
      }
      .cmw-divider {
        border: none; border-top: 1px solid var(--border, #2e3345);
        margin: 16px 0;
      }

      /* Step 2: Column mapping */
      .cmw-preview-table-wrap {
        overflow-x: auto; margin-bottom: 16px;
        border: 1px solid var(--border, #2e3345); border-radius: var(--radius-sm, 6px);
        max-height: 140px; overflow-y: auto;
      }
      .cmw-preview-table {
        width: 100%; border-collapse: collapse; font-size: 0.75rem;
      }
      .cmw-preview-table th {
        background: var(--surface3, #2a2e3b); color: var(--text-muted, #8b90a0);
        padding: 6px 10px; text-align: left; font-weight: 600;
        position: sticky; top: 0; white-space: nowrap;
      }
      .cmw-preview-table td {
        padding: 5px 10px; border-top: 1px solid var(--border, #2e3345);
        color: var(--text, #e2e4ea); white-space: nowrap;
        max-width: 160px; overflow: hidden; text-overflow: ellipsis;
      }
      .cmw-map-grid { display: flex; flex-direction: column; gap: 8px; }
      .cmw-map-row {
        display: grid; grid-template-columns: 140px 1fr 1fr; gap: 8px; align-items: center;
      }
      .cmw-map-label {
        font-size: 0.82rem; font-weight: 500; color: var(--text, #e2e4ea);
        display: flex; align-items: center; gap: 4px;
      }
      .cmw-map-label .cmw-req {
        color: var(--negative, #f87171); font-size: 0.7rem; font-weight: 700;
      }
      .cmw-map-select {
        width: 100%; padding: 7px 10px; border-radius: var(--radius-sm, 6px);
        background: var(--surface2, #222633); border: 1px solid var(--border, #2e3345);
        color: var(--text, #e2e4ea); font-size: 0.8rem;
        min-height: auto; cursor: pointer; transition: border-color .15s;
      }
      .cmw-map-select:focus { border-color: var(--accent-light, #60a5fa); outline: none; }
      .cmw-map-preview {
        font-size: 0.75rem; color: var(--text-muted, #8b90a0);
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      .cmw-map-status-mapped { color: var(--positive, #4ade80); }
      .cmw-map-status-unmapped { color: var(--text-dim, #5a5f72); }
      .cmw-map-status-required { color: var(--negative, #f87171); }

      /* Step 3: Options */
      .cmw-options { display: flex; flex-direction: column; gap: 12px; }
      .cmw-opt-row {
        display: flex; align-items: center; gap: 10px;
      }
      .cmw-opt-label {
        font-size: 0.82rem; color: var(--text, #e2e4ea); min-width: 110px; flex-shrink: 0;
      }
      .cmw-opt-select {
        flex: 1; padding: 7px 10px; border-radius: var(--radius-sm, 6px);
        background: var(--surface2, #222633); border: 1px solid var(--border, #2e3345);
        color: var(--text, #e2e4ea); font-size: 0.8rem;
        min-height: auto; cursor: pointer;
      }
      .cmw-opt-input {
        flex: 1; padding: 7px 10px; border-radius: var(--radius-sm, 6px);
        background: var(--surface2, #222633); border: 1px solid var(--border, #2e3345);
        color: var(--text, #e2e4ea); font-size: 0.8rem; min-height: auto;
      }
      .cmw-opt-input:focus, .cmw-opt-select:focus {
        border-color: var(--accent-light, #60a5fa); outline: none;
      }
      .cmw-save-check {
        display: flex; align-items: center; gap: 8px; cursor: pointer;
        font-size: 0.82rem; color: var(--text, #e2e4ea);
      }
      .cmw-save-check input { width: 16px; height: 16px; cursor: pointer; min-height: auto; }
      .cmw-save-fields { margin-top: 8px; display: flex; flex-direction: column; gap: 8px; }

      /* Footer */
      .cmw-footer {
        display: flex; align-items: center; justify-content: flex-end; gap: 10px;
        padding: 14px 20px; border-top: 1px solid var(--border, #2e3345);
        position: sticky; bottom: 0; background: var(--surface, #1a1d27);
      }
      .cmw-btn-secondary {
        padding: 8px 18px; border-radius: var(--radius-sm, 6px);
        background: var(--surface2, #222633); border: 1px solid var(--border, #2e3345);
        color: var(--text, #e2e4ea); font-size: 0.82rem; cursor: pointer;
        transition: background .15s; min-height: auto;
      }
      .cmw-btn-secondary:hover { background: var(--surface3, #2a2e3b); }
      .cmw-btn-primary {
        padding: 8px 22px; border-radius: var(--radius-sm, 6px);
        background: var(--accent, #2563eb); color: #fff; border: none;
        font-size: 0.82rem; font-weight: 600; cursor: pointer;
        transition: filter .15s; min-height: auto;
      }
      .cmw-btn-primary:hover { filter: brightness(1.15); }
      .cmw-btn-primary:disabled { opacity: .5; cursor: not-allowed; }

      @media (max-width: 600px) {
        .cmw-dialog { max-width: 100%; max-height: 92vh; }
        .cmw-map-row { grid-template-columns: 1fr; gap: 4px; }
        .cmw-map-preview { display: none; }
        .cmw-opt-row { flex-direction: column; align-items: stretch; }
        .cmw-opt-label { min-width: 0; }
        .cmw-match { flex-wrap: wrap; }
      }
    `;
    document.head.appendChild(style);
  }

  // ── Parse CSV headers + preview rows ────────────────────────────────
  function parseCsvPreview(csvText, maxRows) {
    maxRows = maxRows || 3;
    const lines = csvText.split(/\r?\n/).filter(l => l.trim());
    if (lines.length === 0) return { headers: [], rows: [] };

    // Simple CSV line parser (handles quoted fields)
    function splitLine(line) {
      const result = [];
      let current = '';
      let inQuote = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuote && i + 1 < line.length && line[i + 1] === '"') {
            current += '"'; i++;
          } else {
            inQuote = !inQuote;
          }
        } else if (ch === ',' && !inQuote) {
          result.push(current.trim());
          current = '';
        } else {
          current += ch;
        }
      }
      result.push(current.trim());
      return result;
    }

    const headers = splitLine(lines[0]);
    const rows = [];
    for (let i = 1; i < Math.min(lines.length, maxRows + 1); i++) {
      rows.push(splitLine(lines[i]));
    }
    return { headers, rows };
  }

  // ── Main wizard class ───────────────────────────────────────────────
  function CsvMappingWizard(opts) {
    this.entityType = opts.entityType;         // 'expense' | 'booking'
    this.csvText = opts.csvText;               // raw CSV string
    this.apiBase = opts.apiBase || '';          // API base URL
    this.jobId = opts.jobId;                   // import job ID
    this.getAuthToken = opts.getAuthToken;     // fn → token string
    this.getWorkspaceId = opts.getWorkspaceId; // fn → workspace ID
    this.onComplete = opts.onComplete;         // fn(result) — called when user proceeds
    this.onCancel = opts.onCancel || function(){};

    this._el = null;
    this._step = 'detecting'; // detecting | matches | mapping | closed
    this._matches = [];
    this._csvPreview = parseCsvPreview(this.csvText);
    this._columnMap = {};
    this._amountSign = 'negative_is_debit';
    this._dateFormat = 'auto';
    this._rowFilterColumn = '';
    this._rowFilterValues = '';
    this._saveAsTemplate = false;
    this._templateName = '';
    this._sourceUrl = '';
    this._selectedTemplate = null;
    this._fingerprint = null;
  }

  CsvMappingWizard.prototype.open = async function () {
    injectCSS();
    this._buildDOM();
    document.body.appendChild(this._el);

    // Animate in
    requestAnimationFrame(() => {
      this._el.classList.add('cmw-visible');
    });

    // Escape key
    this._onKey = (e) => {
      if (e.key === 'Escape') this.close();
    };
    document.addEventListener('keydown', this._onKey);

    // Run detection
    await this._detectFormat();
  };

  CsvMappingWizard.prototype.close = function () {
    if (!this._el) return;
    this._el.classList.remove('cmw-visible');
    document.removeEventListener('keydown', this._onKey);
    setTimeout(() => {
      if (this._el && this._el.parentNode) this._el.parentNode.removeChild(this._el);
      this._el = null;
    }, 250);
  };

  CsvMappingWizard.prototype._buildDOM = function () {
    this._el = document.createElement('div');
    this._el.className = 'cmw-backdrop';
    this._el.innerHTML =
      '<div class="cmw-dialog" role="dialog" aria-modal="true">' +
        '<div class="cmw-header">' +
          '<h2>CSV Column Mapping</h2>' +
          '<button class="cmw-close" aria-label="Close">&times;</button>' +
        '</div>' +
        '<div class="cmw-body" id="cmw-body">' +
          '<div style="text-align:center;padding:32px 0;color:var(--text-muted)">' +
            'Detecting format&hellip;' +
          '</div>' +
        '</div>' +
        '<div class="cmw-footer" id="cmw-footer" style="display:none"></div>' +
      '</div>';

    // Close button
    this._el.querySelector('.cmw-close').addEventListener('click', () => {
      this.close();
      this.onCancel();
    });

    // Backdrop click closes
    this._el.addEventListener('click', (e) => {
      if (e.target === this._el) {
        this.close();
        this.onCancel();
      }
    });
  };

  // ── Step: Detect format ─────────────────────────────────────────────
  CsvMappingWizard.prototype._detectFormat = async function () {
    try {
      const res = await fetch(this.apiBase + '/imports/' + this.jobId + '/detect-format', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + this.getAuthToken(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ csv: this.csvText }),
      });
      const data = await res.json();

      if (!res.ok) {
        this._showError(data.error || 'Format detection failed.');
        return;
      }

      this._fingerprint = data.fingerprint || null;
      this._matches = data.matches || [];
      var autoSelected = data.auto_selected;

      if (autoSelected && this._matches.length > 0) {
        // Auto-selected: close wizard, notify caller
        this.close();
        this.onComplete({
          autoSelected: true,
          templateId: this._matches[0].template_id,
          templateName: this._matches[0].template_name,
        });
        return;
      }

      if (this._matches.length > 0) {
        this._step = 'matches';
        this._renderMatches();
      } else {
        this._step = 'mapping';
        this._renderMapping();
      }
    } catch (err) {
      this._showError('Network error: ' + err.message);
    }
  };

  CsvMappingWizard.prototype._showError = function (msg) {
    var body = this._el.querySelector('#cmw-body');
    body.innerHTML =
      '<div style="text-align:center;padding:32px 0;color:var(--negative)">' +
        esc(msg) +
      '</div>';
    var footer = this._el.querySelector('#cmw-footer');
    footer.style.display = 'flex';
    footer.innerHTML =
      '<button class="cmw-btn-secondary cmw-cancel-btn">Close</button>';
    footer.querySelector('.cmw-cancel-btn').addEventListener('click', () => {
      this.close();
      this.onCancel();
    });
  };

  // ── Step 1: Template matches ────────────────────────────────────────
  CsvMappingWizard.prototype._renderMatches = function () {
    var body = this._el.querySelector('#cmw-body');
    var footer = this._el.querySelector('#cmw-footer');
    var self = this;
    var fields = LOGICAL_FIELDS[this.entityType] || LOGICAL_FIELDS.expense;

    var html = '<div class="cmw-step-label">Step 1 — Select a template</div>';
    html += '<div class="cmw-match-list">';

    this._matches.forEach(function (m, i) {
      var pct = Math.round((m.confidence || 0) * 100);
      var cls = pct >= 90 ? 'cmw-conf-high' : pct >= 60 ? 'cmw-conf-med' : 'cmw-conf-low';
      var matchedCount = (m.matched_columns || []).length;
      var missingCount = (m.missing_columns || []).length;

      html +=
        '<div class="cmw-match" data-idx="' + i + '">' +
          '<div class="cmw-match-info">' +
            '<div class="cmw-match-name">' + esc(m.template_name) + '</div>' +
            '<div class="cmw-match-meta">' +
              esc(matchedCount) + ' matched, ' + esc(missingCount) + ' missing' +
            '</div>' +
          '</div>' +
          '<div class="cmw-conf-bar"><div class="cmw-conf-fill ' + cls + '" style="width:' + pct + '%"></div></div>' +
          '<span class="cmw-conf-pct">' + pct + '%</span>' +
          '<button class="cmw-match-btn" data-idx="' + i + '">Use this</button>' +
        '</div>';
    });

    html += '</div>';
    html += '<button class="cmw-custom-link">Create custom mapping instead</button>';

    body.innerHTML = html;
    footer.style.display = 'flex';
    footer.innerHTML =
      '<button class="cmw-btn-secondary cmw-cancel-btn">Cancel</button>';

    // Wire match buttons
    body.querySelectorAll('.cmw-match-btn').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var idx = parseInt(btn.dataset.idx, 10);
        self._selectMatch(idx);
      });
    });

    // Wire custom mapping link
    body.querySelector('.cmw-custom-link').addEventListener('click', function () {
      self._step = 'mapping';
      self._renderMapping();
    });

    footer.querySelector('.cmw-cancel-btn').addEventListener('click', function () {
      self.close();
      self.onCancel();
    });
  };

  CsvMappingWizard.prototype._selectMatch = function (idx) {
    var match = this._matches[idx];
    if (!match) return;

    this._selectedTemplate = match;

    // Pre-fill column map from matched columns
    // matched_columns from API are the logical fields that matched
    // We proceed straight to parse since template is already stored
    this.close();
    this.onComplete({
      autoSelected: false,
      templateId: match.template_id,
      templateName: match.template_name,
      confidence: match.confidence,
    });
  };

  // ── Step 2 + 3: Column mapping + Options ────────────────────────────
  CsvMappingWizard.prototype._renderMapping = function () {
    var body = this._el.querySelector('#cmw-body');
    var footer = this._el.querySelector('#cmw-footer');
    var self = this;
    var fields = LOGICAL_FIELDS[this.entityType] || LOGICAL_FIELDS.expense;
    var headers = this._csvPreview.headers;
    var previewRows = this._csvPreview.rows;

    var html = '';

    // CSV preview table
    html += '<div class="cmw-step-label">CSV Preview</div>';
    html += '<div class="cmw-preview-table-wrap"><table class="cmw-preview-table"><thead><tr>';
    headers.forEach(function (h) {
      html += '<th>' + esc(h) + '</th>';
    });
    html += '</tr></thead><tbody>';
    previewRows.forEach(function (row) {
      html += '<tr>';
      headers.forEach(function (_, ci) {
        html += '<td>' + esc(row[ci] || '') + '</td>';
      });
      html += '</tr>';
    });
    html += '</tbody></table></div>';

    // Column mapping
    html += '<hr class="cmw-divider">';
    html += '<div class="cmw-step-label">Step 2 — Map columns</div>';
    html += '<div class="cmw-map-grid">';

    fields.forEach(function (f) {
      var selOptions = '<option value="">— skip —</option>';
      headers.forEach(function (h, hi) {
        var selected = self._guessColumn(f.key, h) ? ' selected' : '';
        if (selected) self._columnMap[f.key] = h;
        selOptions += '<option value="' + esc(h) + '"' + selected + '>' + esc(h) + '</option>';
      });

      var previewVal = '';
      if (self._columnMap[f.key] && previewRows.length > 0) {
        var ci = headers.indexOf(self._columnMap[f.key]);
        if (ci >= 0) previewVal = previewRows[0][ci] || '';
      }

      var reqBadge = f.required ? '<span class="cmw-req">*</span>' : '';

      html +=
        '<div class="cmw-map-row">' +
          '<div class="cmw-map-label">' + esc(f.label) + reqBadge + '</div>' +
          '<select class="cmw-map-select" data-field="' + esc(f.key) + '">' + selOptions + '</select>' +
          '<div class="cmw-map-preview" data-field-preview="' + esc(f.key) + '">' + esc(previewVal) + '</div>' +
        '</div>';
    });

    html += '</div>';

    // Options section
    html += '<hr class="cmw-divider">';
    html += '<div class="cmw-step-label">Step 3 — Options</div>';
    html += '<div class="cmw-options">';

    // Amount sign
    html += '<div class="cmw-opt-row">';
    html += '<span class="cmw-opt-label">Amount sign</span>';
    html += '<select class="cmw-opt-select" id="cmw-amount-sign">';
    AMOUNT_SIGNS.forEach(function (a) {
      html += '<option value="' + esc(a.value) + '">' + esc(a.label) + '</option>';
    });
    html += '</select></div>';

    // Date format
    html += '<div class="cmw-opt-row">';
    html += '<span class="cmw-opt-label">Date format</span>';
    html += '<select class="cmw-opt-select" id="cmw-date-format">';
    DATE_FORMATS.forEach(function (d) {
      html += '<option value="' + esc(d.value) + '">' + esc(d.label) + '</option>';
    });
    html += '</select></div>';

    // Row filter
    html += '<div class="cmw-opt-row">';
    html += '<span class="cmw-opt-label">Row filter</span>';
    html += '<select class="cmw-opt-select" id="cmw-filter-col" style="flex:.6">';
    html += '<option value="">None</option>';
    headers.forEach(function (h) {
      html += '<option value="' + esc(h) + '">' + esc(h) + '</option>';
    });
    html += '</select>';
    html += '<input class="cmw-opt-input" id="cmw-filter-vals" placeholder="Include values (comma-separated)" style="flex:1" />';
    html += '</div>';

    // Save as template
    html += '<hr class="cmw-divider">';
    html += '<label class="cmw-save-check">';
    html += '<input type="checkbox" id="cmw-save-template" />';
    html += 'Save as template for future imports';
    html += '</label>';

    html += '<div class="cmw-save-fields" id="cmw-save-fields" style="display:none">';
    html += '<div class="cmw-opt-row">';
    html += '<span class="cmw-opt-label">Template name</span>';
    html += '<input class="cmw-opt-input" id="cmw-tpl-name" placeholder="e.g. Chase Bank Statement" />';
    html += '</div>';
    html += '<div class="cmw-opt-row">';
    html += '<span class="cmw-opt-label">Source URL</span>';
    html += '<input class="cmw-opt-input" id="cmw-tpl-url" placeholder="https://..." />';
    html += '</div>';
    html += '</div>';

    html += '</div>';

    body.innerHTML = html;

    // Footer
    footer.style.display = 'flex';
    footer.innerHTML =
      (self._matches.length > 0
        ? '<button class="cmw-btn-secondary cmw-back-btn">Back</button>'
        : '') +
      '<button class="cmw-btn-secondary cmw-cancel-btn">Cancel</button>' +
      '<button class="cmw-btn-primary cmw-parse-btn">Parse CSV</button>';

    // Wire events
    body.querySelectorAll('.cmw-map-select').forEach(function (sel) {
      sel.addEventListener('change', function () {
        var fieldKey = sel.dataset.field;
        self._columnMap[fieldKey] = sel.value;
        // Update preview
        var previewEl = body.querySelector('[data-field-preview="' + fieldKey + '"]');
        if (previewEl) {
          var ci = headers.indexOf(sel.value);
          previewEl.textContent = (ci >= 0 && previewRows.length > 0) ? (previewRows[0][ci] || '') : '';
        }
      });
    });

    var saveCheck = body.querySelector('#cmw-save-template');
    saveCheck.addEventListener('change', function () {
      body.querySelector('#cmw-save-fields').style.display = saveCheck.checked ? 'flex' : 'none';
    });

    var amountSel = body.querySelector('#cmw-amount-sign');
    amountSel.addEventListener('change', function () { self._amountSign = amountSel.value; });

    var dateSel = body.querySelector('#cmw-date-format');
    dateSel.addEventListener('change', function () { self._dateFormat = dateSel.value; });

    // Footer buttons
    var backBtn = footer.querySelector('.cmw-back-btn');
    if (backBtn) {
      backBtn.addEventListener('click', function () {
        self._step = 'matches';
        self._renderMatches();
      });
    }

    footer.querySelector('.cmw-cancel-btn').addEventListener('click', function () {
      self.close();
      self.onCancel();
    });

    footer.querySelector('.cmw-parse-btn').addEventListener('click', function () {
      self._handleParse();
    });
  };

  // ── Guess column mapping by field key vs header name ────────────────
  CsvMappingWizard.prototype._guessColumn = function (fieldKey, headerName) {
    var h = headerName.toLowerCase().replace(/[^a-z0-9]/g, '');
    var guessMap = {
      transaction_date: ['transactiondate', 'date', 'postdate', 'postingdate', 'transdate'],
      amount: ['amount', 'totalamount', 'debit', 'total'],
      merchant_name: ['merchant', 'merchantname', 'payee', 'description', 'name'],
      description: ['description', 'memo', 'note', 'details', 'particulars'],
      candidate_category: ['category', 'type', 'expensecategory'],
      reference_id: ['referenceid', 'reference', 'refno', 'transactionid', 'confirmationcode'],
      check_in_date: ['checkin', 'checkindate', 'startdate', 'arrival'],
      check_out_date: ['checkout', 'checkoutdate', 'enddate', 'departure'],
      net_payout_amount: ['netpayout', 'payout', 'netamount', 'hostpayout', 'earnings'],
      guest_name: ['guest', 'guestname', 'name'],
      source_confirmation_code: ['confirmationcode', 'confirmation', 'reservationcode', 'listingid'],
      nights: ['nights', 'numberofnights', 'duration'],
      gross_revenue_amount: ['grossrevenue', 'gross', 'grossearnings', 'totalamount'],
      cleaning_fee_amount: ['cleaningfee', 'cleaning'],
      platform_fee_amount: ['platformfee', 'servicefee', 'hostservicefee', 'hostfee'],
      tax_amount: ['tax', 'taxes', 'occupancytax', 'occupancytaxes'],
    };

    var candidates = guessMap[fieldKey] || [];
    return candidates.indexOf(h) >= 0;
  };

  // ── Handle parse button click ───────────────────────────────────────
  CsvMappingWizard.prototype._handleParse = async function () {
    var self = this;
    var fields = LOGICAL_FIELDS[this.entityType] || LOGICAL_FIELDS.expense;

    // Read current selections
    this._el.querySelectorAll('.cmw-map-select').forEach(function (sel) {
      self._columnMap[sel.dataset.field] = sel.value;
    });

    // Validate required fields
    var missing = [];
    fields.forEach(function (f) {
      if (f.required && !self._columnMap[f.key]) {
        missing.push(f.label);
      }
    });

    if (missing.length > 0) {
      var parseBtn = this._el.querySelector('.cmw-parse-btn');
      if (parseBtn) parseBtn.style.animation = 'none';

      // Show inline validation
      var toastFn = window.showToast || window.toast;
      if (toastFn) toastFn('Required fields missing: ' + missing.join(', '));
      return;
    }

    // Read options
    var amountSel = this._el.querySelector('#cmw-amount-sign');
    if (amountSel) this._amountSign = amountSel.value;
    var dateSel = this._el.querySelector('#cmw-date-format');
    if (dateSel) this._dateFormat = dateSel.value;
    var filterCol = this._el.querySelector('#cmw-filter-col');
    var filterVals = this._el.querySelector('#cmw-filter-vals');
    if (filterCol) this._rowFilterColumn = filterCol.value;
    if (filterVals) this._rowFilterValues = filterVals.value;

    // Check save as template
    var saveCheck = this._el.querySelector('#cmw-save-template');
    this._saveAsTemplate = saveCheck && saveCheck.checked;
    if (this._saveAsTemplate) {
      var nameInput = this._el.querySelector('#cmw-tpl-name');
      var urlInput = this._el.querySelector('#cmw-tpl-url');
      this._templateName = nameInput ? nameInput.value.trim() : '';
      this._sourceUrl = urlInput ? urlInput.value.trim() : '';
    }

    // Disable button while working
    var parseBtn = this._el.querySelector('.cmw-parse-btn');
    if (parseBtn) { parseBtn.disabled = true; parseBtn.textContent = 'Saving\u2026'; }

    // Save template if requested
    var savedTemplateId = null;
    if (this._saveAsTemplate && this._templateName) {
      try {
        savedTemplateId = await this._saveTemplate();
      } catch (err) {
        var toastFn = window.showToast || window.toast;
        if (toastFn) toastFn('Failed to save template: ' + err.message);
      }
    }

    if (parseBtn) { parseBtn.disabled = false; parseBtn.textContent = 'Parse CSV'; }

    // Build clean column map (remove empty mappings)
    var cleanMap = {};
    Object.keys(this._columnMap).forEach(function (k) {
      if (self._columnMap[k]) cleanMap[k] = self._columnMap[k];
    });

    // Build row filter
    var rowFilter = null;
    if (this._rowFilterColumn && this._rowFilterValues) {
      rowFilter = {
        column: this._rowFilterColumn,
        include: this._rowFilterValues.split(',').map(function (v) { return v.trim(); }).filter(Boolean),
      };
    }

    // Close and notify caller
    this.close();
    this.onComplete({
      autoSelected: false,
      templateId: savedTemplateId,
      templateName: this._templateName || null,
      columnMap: cleanMap,
      amountSign: this._amountSign,
      dateFormat: this._dateFormat,
      rowFilter: rowFilter,
      fingerprint: this._fingerprint,
    });
  };

  // ── Save template via API ───────────────────────────────────────────
  CsvMappingWizard.prototype._saveTemplate = async function () {
    var cleanMap = {};
    var self = this;
    Object.keys(this._columnMap).forEach(function (k) {
      if (self._columnMap[k]) cleanMap[k] = self._columnMap[k];
    });

    var rowFilter = null;
    if (this._rowFilterColumn && this._rowFilterValues) {
      rowFilter = {
        column: this._rowFilterColumn,
        include: this._rowFilterValues.split(',').map(function (v) { return v.trim(); }).filter(Boolean),
      };
    }

    var payload = {
      workspace_id: this.getWorkspaceId(),
      name: this._templateName,
      entity_type: this.entityType,
      column_map: cleanMap,
      amount_sign: this._amountSign,
      date_format: this._dateFormat,
      header_fingerprint: this._fingerprint || null,
      row_filter: rowFilter,
    };

    if (this._sourceUrl) {
      payload.source_url = this._sourceUrl;
    }

    var res = await fetch(this.apiBase + '/csv-templates', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + this.getAuthToken(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    var data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to save template');
    }

    return data.data ? data.data.id : null;
  };

  // ── Public API ──────────────────────────────────────────────────────
  window.CsvMappingWizard = CsvMappingWizard;
})();
