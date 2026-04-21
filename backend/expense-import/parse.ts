// author: AEON Dev | created: 2026-04-19 | last updated: 2026-04-19
// Parse a bank/card CSV export into staged import rows.
// Rules: docs/specs/import-parsing-rules.md
// Aligned to schema: import_rows, normalized_payload (NormalizedExpenseCandidate)

import { inferCategory, type ScheduleECategory } from './categories.js';
import type {
  NormalizedExpenseCandidate,
  ParsedRow,
  ImportRowReviewStatus,
  ExpenseReviewState,
} from './types.js';

// ---------------------------------------------------------------------------
// Map card issuer source categories (e.g. Amex) to Schedule E categories.
// Returns null if no confident mapping exists.
// ---------------------------------------------------------------------------
const SOURCE_CATEGORY_MAP: Array<{ pattern: RegExp; category: ScheduleECategory }> = [
  { pattern: /supplies|retail|wholesale|internet purchase|merchandise/i, category: 'Supplies' },
  { pattern: /insurance/i, category: 'Insurance' },
  { pattern: /utilities|electric|gas|water/i, category: 'Utilities' },
  { pattern: /repair|hardware|building/i, category: 'Repairs & maintenance' },
  { pattern: /cleaning|janitorial/i, category: 'Cleaning & turnover' },
  { pattern: /advertising|marketing/i, category: 'Advertising' },
  { pattern: /professional|legal|accounting/i, category: 'Professional services' },
];

function mapSourceCategory(raw: string): ScheduleECategory | null {
  if (!raw) return null;
  for (const { pattern, category } of SOURCE_CATEGORY_MAP) {
    if (pattern.test(raw)) return category;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Auto-approval threshold: rows scoring >= this value AND passing all hard
// field checks may skip the review queue.
// Spec ref: expense-import-review.md § Auto-Approval Rules + import-parsing-rules.md
// ---------------------------------------------------------------------------
const AUTO_APPROVE_THRESHOLD = 0.90;

// ---------------------------------------------------------------------------
// Dedupe key
// Format: {date}|{amount}|{merchant_normalized}
// Bank reference id is appended when present (column "Reference", "Ref #", etc.)
// ---------------------------------------------------------------------------
export function buildDedupeKey(
  date: string,
  amount: number,
  merchant: string,
  refId?: string
): string {
  const merchantNorm = merchant.toLowerCase().replace(/\s+/g, ' ').trim();
  const parts = [date, amount.toFixed(2), merchantNorm];
  if (refId) parts.push(refId.trim());
  return parts.join('|');
}

// ---------------------------------------------------------------------------
// Normalize merchant name: preserve business intent, strip noise.
// ---------------------------------------------------------------------------
function normalizeMerchant(raw: string): string {
  let name = raw
    .replace(/\*[\d]+/g, '')                          // strip card suffixes like *1234
    .replace(/\d{5,}/g, '')                            // strip long numeric codes (store #, zip baked into name)
    .replace(/\s{2,}/g, ' ')
    .trim();

  // Strip trailing US state + city patterns: "FORT WORTH          TX" or "LAKE WORTH TX"
  name = name.replace(/\s{2,}[A-Z]{2}\s*$/, '').trim();

  // Title case: "ECO THRIFT 160" → "Eco Thrift 160"
  name = name
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return name;
}

// ---------------------------------------------------------------------------
// Parse date column. Accepts MM/DD/YYYY, YYYY-MM-DD, M/D/YYYY, M/D/YY.
// Returns ISO YYYY-MM-DD or null on failure.
// ---------------------------------------------------------------------------
export function parseDate(raw: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();

  // ISO format
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const d = new Date(trimmed);
    return isNaN(d.getTime()) ? null : trimmed;
  }
  // MM/DD/YYYY or M/D/YYYY or M/D/YY
  const mdy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (mdy) {
    let [, m, d, y] = mdy.map(Number);
    if (y < 100) y += 2000;
    const date = new Date(y, m - 1, d);
    if (isNaN(date.getTime())) return null;
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Parse amount. Only positive charges are expense candidates.
// Strips currency symbols and commas. Returns null for unparseable values.
// ---------------------------------------------------------------------------
export function parseAmount(raw: string): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[$,\s]/g, '');
  const n = parseFloat(cleaned);
  if (isNaN(n)) return null;
  return n;
}

// ---------------------------------------------------------------------------
// Score a parsed row candidate. Returns 0.0–1.0.
// Score reflects how much human judgment is still required.
// ---------------------------------------------------------------------------
function scoreCandidate(
  date: string | null,
  amount: number | null,
  merchant: string | null,
  category: string | null,
  propertyCode: string | null
): number {
  let score = 0;
  if (date) score += 0.25;
  if (amount !== null && amount > 0) score += 0.25;
  if (merchant) score += 0.20;
  if (category) score += 0.20;
  if (propertyCode !== null) score += 0.10; // null is acceptable (general overhead)
  return parseFloat(score.toFixed(4));
}

// ---------------------------------------------------------------------------
// Detect which column names are present in the CSV header row.
// We support common bank CSV formats without hardcoding a single layout.
// ---------------------------------------------------------------------------
interface ColumnMap {
  date: string | null;
  amount: string | null;
  merchant: string | null;
  description: string | null;
  refId: string | null;
  sourceCategory: string | null;
}

function detectColumns(headers: string[]): ColumnMap {
  const lower = headers.map((h) => h.trim().toLowerCase());
  const pick = (...candidates: string[]) =>
    headers[candidates.map((c) => lower.indexOf(c)).find((i) => i !== -1) ?? -1] ?? null;

  return {
    date: pick('date', 'transaction date', 'posted date', 'trans. date', 'post date'),
    amount: pick('amount', 'debit', 'charge amount', 'withdrawal amount', 'transaction amount'),
    merchant: pick('description', 'merchant name', 'merchant', 'payee', 'name'),
    description: pick('memo', 'original description', 'extended details', 'details'),
    refId: pick('reference', 'ref #', 'transaction id', 'check number', 'trans id'),
    sourceCategory: pick('category', 'transaction category', 'type'),
  };
}

// ---------------------------------------------------------------------------
// Main export: parse raw CSV text into ParsedRow[].
//
// knownPropertyCodes: workspace property codes for property resolution.
// existingDedupeKeys: set of dedupe_keys already committed in expenses.
// ---------------------------------------------------------------------------
export function parseBankCsv(
  csvText: string,
  knownPropertyCodes: string[],
  existingDedupeKeys: Set<string>
): ParsedRow[] {
  const rows = splitCsvRows(csvText);
  if (rows.length < 2) return []; // header + at least one data row required

  const headers = rows[0].map((h) => h.trim());
  const cols = detectColumns(headers);

  const results: ParsedRow[] = [];

  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i];
    if (cells.length === 0) continue;
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = (cells[idx] ?? '').trim();
    });

    const errors: string[] = [];
    const raw_payload = { ...row };

    // --- Date ---
    const dateRaw = cols.date ? row[cols.date] ?? '' : '';
    const transaction_date = parseDate(dateRaw);
    if (!transaction_date) errors.push(`Unparseable date: "${dateRaw}"`);

    // --- Amount ---
    const amountRaw = cols.amount ? row[cols.amount] ?? '' : '';
    const amount = parseAmount(amountRaw);
    if (amount === null) {
      errors.push(`Unparseable amount: "${amountRaw}"`);
    } else if (amount <= 0) {
      // Refunds / credits: not expense candidates → fail row gracefully
      errors.push(`Non-positive amount (${amount}): treated as refund/credit, not an expense`);
    }

    // --- Merchant ---
    const merchantRaw = cols.merchant ? row[cols.merchant] ?? '' : '';
    const merchant_name = merchantRaw ? normalizeMerchant(merchantRaw) : null;
    if (!merchant_name) errors.push('Missing merchant name');

    // --- Description ---
    const descriptionRaw = cols.description ? row[cols.description] ?? '' : '';
    const description = descriptionRaw || merchantRaw || null;

    // --- Ref ID (for dedupe key) ---
    const refId = cols.refId ? row[cols.refId] ?? '' : undefined;

    // Hard failure: cannot build a valid candidate
    if (errors.length > 0) {
      results.push({
        row_index: i,
        raw_payload,
        normalized_payload: null,
        validation_errors: errors,
        review_status: 'flagged',
        dedupe_key: null,
        confidence_score: null,
      });
      continue;
    }

    // --- Source category (from CSV, e.g. Amex "Category" column) ---
    const sourceCatRaw = cols.sourceCategory ? row[cols.sourceCategory] ?? '' : '';

    // --- Category inference: try keyword match first, then source category mapping ---
    const candidate_category = inferCategory(merchant_name!, description ?? '') ?? mapSourceCategory(sourceCatRaw);

    // --- Property resolution ---
    // Prototype: cannot resolve property from CSV alone without user context.
    // All rows set candidate_property_code to null → property is user-confirmed during review.
    // Production implementation should resolve via property-specific account/keyword rules.
    const candidate_property_code: string | null = null;

    // --- Confidence score ---
    const confidence_score = scoreCandidate(
      transaction_date,
      amount,
      merchant_name,
      candidate_category,
      candidate_property_code
    );

    // --- Auto-approval candidate_review_state ---
    // Business is only inferred when category is known + confidence is high.
    const candidate_review_state: ExpenseReviewState =
      candidate_category && confidence_score >= AUTO_APPROVE_THRESHOLD ? 'Business' : 'Review';

    // --- Dedupe key ---
    const dedupe_key = buildDedupeKey(
      transaction_date!,
      amount!,
      merchant_name!,
      refId
    );

    // --- Dedupe check: flag if already committed ---
    const isDuplicate = existingDedupeKeys.has(dedupe_key);
    if (isDuplicate) {
      errors.push('Possible duplicate — a matching transaction was already imported');
    }

    const normalized_payload: NormalizedExpenseCandidate = {
      transaction_date,
      amount,
      merchant_name,
      description,
      payment_method: null, // not derivable from generic bank CSV
      candidate_property_code,
      candidate_category,
      candidate_review_state,
      confidence_score,
      confidence_explanation: buildExplanation(
        !!candidate_category,
        candidate_property_code !== null,
        confidence_score,
        isDuplicate
      ),
    };

    // --- Review status ---
    let review_status: ImportRowReviewStatus;
    if (isDuplicate) {
      review_status = 'flagged';
    } else if (
      candidate_category &&
      confidence_score >= AUTO_APPROVE_THRESHOLD &&
      candidate_review_state === 'Business' &&
      errors.length === 0
    ) {
      review_status = 'approved';
    } else {
      review_status = 'flagged';
    }

    results.push({
      row_index: i,
      raw_payload,
      normalized_payload,
      validation_errors: errors.length > 0 ? errors : null,
      review_status,
      dedupe_key,
      confidence_score,
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Build a human-readable confidence explanation for the review queue.
// ---------------------------------------------------------------------------
function buildExplanation(
  categoryKnown: boolean,
  propertyKnown: boolean,
  score: number,
  isDuplicate: boolean
): string {
  const parts: string[] = [];
  if (isDuplicate) parts.push('Possible duplicate of committed record');
  if (!categoryKnown) parts.push('Category could not be determined — requires review');
  if (!propertyKnown) parts.push('Property not resolved — confirm during review');
  if (score >= AUTO_APPROVE_THRESHOLD && !isDuplicate) {
    parts.push(`High confidence (${(score * 100).toFixed(0)}%) — auto-approved`);
  } else {
    parts.push(`Confidence: ${(score * 100).toFixed(0)}%`);
  }
  return parts.join('. ');
}

// ---------------------------------------------------------------------------
// Minimal RFC 4180 compliant CSV line splitter (handles quoted fields).
// ---------------------------------------------------------------------------
function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

// ---------------------------------------------------------------------------
// Split CSV text into rows, properly handling multi-line quoted fields.
// Returns an array of rows, each row an array of unquoted cell values.
// ---------------------------------------------------------------------------
function splitCsvRows(csvText: string): string[][] {
  const rows: string[][] = [];
  const len = csvText.length;
  let i = 0;

  while (i < len) {
    const row: string[] = [];
    // Parse one row (may span multiple physical lines due to quoted fields)
    while (i < len) {
      let cell = '';
      if (csvText[i] === '"') {
        // Quoted field — consume until closing quote
        i++; // skip opening quote
        while (i < len) {
          if (csvText[i] === '"') {
            if (i + 1 < len && csvText[i + 1] === '"') {
              cell += '"';
              i += 2; // escaped quote
            } else {
              i++; // closing quote
              break;
            }
          } else {
            cell += csvText[i];
            i++;
          }
        }
        // skip to comma or end-of-line
        while (i < len && csvText[i] !== ',' && csvText[i] !== '\r' && csvText[i] !== '\n') i++;
      } else {
        // Unquoted field — consume until comma or end-of-line
        while (i < len && csvText[i] !== ',' && csvText[i] !== '\r' && csvText[i] !== '\n') {
          cell += csvText[i];
          i++;
        }
      }
      row.push(cell);
      if (i < len && csvText[i] === ',') {
        i++; // skip comma, continue to next cell in same row
      } else {
        break; // end of row
      }
    }
    // Skip line endings
    if (i < len && csvText[i] === '\r') i++;
    if (i < len && csvText[i] === '\n') i++;
    // Only add non-empty rows
    if (row.length > 1 || (row.length === 1 && row[0].trim())) {
      rows.push(row);
    }
  }
  return rows;
}
