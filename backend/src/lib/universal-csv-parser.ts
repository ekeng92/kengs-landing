// author: AEON Test | created: 2026-05-10
// Universal CSV parsing engine — template-driven column mapping
// Replaces hardcoded column detection with dynamic csv_format_templates.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CsvFormatTemplate {
  id: string
  name: string
  entity_type: 'booking' | 'expense'
  column_map: Record<string, string>   // { logical_field: csv_header_name }
  row_filter?: { column: string; include: string[] } | null
  amount_sign: 'negative_is_debit' | 'separate_columns' | 'always_positive'
  date_format: 'auto' | 'MM/DD/YYYY' | 'YYYY-MM-DD' | 'DD/MM/YYYY' | 'M/D/YYYY'
  source_url?: string | null
  header_fingerprint?: string | null
}

export interface UniversalParseOptions {
  existingDedupeKeys?: Set<string>
  knownPropertyCodes?: string[]
  propertyId?: string
}

export type ValidationError = {
  field: string
  reason: string
  severity: 'blocking' | 'soft'
}

export interface NormalizedExpense {
  transaction_date: string | null
  amount: number | null
  merchant_name: string | null
  description: string | null
  candidate_category: string | null
  reference_id: string | null
}

export interface NormalizedBooking {
  source_platform: string
  source_confirmation_code: string | null
  guest_name: string | null
  check_in_date: string | null
  check_out_date: string | null
  nights: number | null
  gross_revenue_amount: number | null
  cleaning_fee_amount: number | null
  platform_fee_amount: number | null
  tax_amount: number | null
  net_payout_amount: number | null
}

export interface UniversalParsedRow {
  row_index: number
  raw_payload: Record<string, string>
  normalized_payload: NormalizedExpense | NormalizedBooking | null
  validation_errors: ValidationError[]
  review_status: 'pending' | 'flagged' | 'rejected' | 'approved'
  dedupe_key: string | null
  confidence_score: number | null
}

export interface UniversalParseResult {
  rows: UniversalParsedRow[]
  summary: {
    total: number
    approved: number
    flagged: number
    rejected: number
    error_count: number
  }
}

// ─── Shared Utilities ─────────────────────────────────────────────────────────

/**
 * Strip UTF-8 BOM (byte order mark) from the beginning of text.
 */
export function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
}

/**
 * Normalize a raw string value: trim + collapse internal whitespace.
 */
export function normalizeValue(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ')
}

/**
 * RFC 4180 CSV line splitter. Handles quoted fields with escaped double-quotes.
 */
export function splitCsvLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  fields.push(current)
  return fields
}

/**
 * Split CSV text into rows, handling multi-line quoted fields.
 * Returns array of rows, each row an array of cell strings.
 */
export function splitCsvRows(csvText: string): string[][] {
  const rows: string[][] = []
  const len = csvText.length
  let i = 0

  while (i < len) {
    const row: string[] = []
    while (i < len) {
      let cell = ''
      if (csvText[i] === '"') {
        i++ // skip opening quote
        while (i < len) {
          if (csvText[i] === '"') {
            if (i + 1 < len && csvText[i + 1] === '"') {
              cell += '"'
              i += 2
            } else {
              i++ // closing quote
              break
            }
          } else {
            cell += csvText[i]
            i++
          }
        }
        // skip to comma or end-of-line
        while (i < len && csvText[i] !== ',' && csvText[i] !== '\r' && csvText[i] !== '\n') i++
      } else {
        while (i < len && csvText[i] !== ',' && csvText[i] !== '\r' && csvText[i] !== '\n') {
          cell += csvText[i]
          i++
        }
      }
      row.push(cell)
      if (i < len && csvText[i] === ',') {
        i++
      } else {
        break
      }
    }
    // Skip line endings
    if (i < len && csvText[i] === '\r') i++
    if (i < len && csvText[i] === '\n') i++
    // Only add non-empty rows
    if (row.length > 1 || (row.length === 1 && (row[0] ?? '').trim())) {
      rows.push(row)
    }
  }
  return rows
}

/**
 * Parse a date string into ISO YYYY-MM-DD.
 * When format is specified, uses that format. When 'auto' or omitted, tries all known formats.
 */
export function parseDate(raw: string, format?: string): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed) return null

  if (!format || format === 'auto') {
    // Try all formats in order
    return parseDateISO(trimmed)
      ?? parseDateMDY(trimmed)
      ?? parseDateDMY(trimmed)
  }

  switch (format) {
    case 'YYYY-MM-DD':
      return parseDateISO(trimmed)
    case 'MM/DD/YYYY':
    case 'M/D/YYYY':
      return parseDateMDY(trimmed)
    case 'DD/MM/YYYY':
      return parseDateDMY(trimmed)
    default:
      return parseDateISO(trimmed) ?? parseDateMDY(trimmed) ?? parseDateDMY(trimmed)
  }
}

function parseDateISO(s: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(s)
    return isNaN(d.getTime()) ? null : s
  }
  return null
}

function parseDateMDY(s: string): string | null {
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (!m || !m[1] || !m[2] || !m[3]) return null
  const month = Number(m[1])
  const day = Number(m[2])
  let year = Number(m[3])
  if (year < 100) year += 2000
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const date = new Date(year, month - 1, day)
  if (isNaN(date.getTime())) return null
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function parseDateDMY(s: string): string | null {
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m || !m[1] || !m[2] || !m[3]) return null
  const day = Number(m[1])
  const month = Number(m[2])
  const year = Number(m[3])
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const date = new Date(year, month - 1, day)
  if (isNaN(date.getTime())) return null
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/**
 * Parse a currency string into a number.
 * Strips $, commas, whitespace. Handles parentheses as negative: (123.45) → -123.45.
 */
export function parseCurrency(raw: string): number | null {
  if (!raw) return null
  let s = raw.trim()
  if (!s) return null
  const isNegative = s.startsWith('(') && s.endsWith(')')
  if (isNegative) s = '-' + s.slice(1, -1)
  s = s.replace(/[$,\s]/g, '')
  const n = parseFloat(s)
  return isNaN(n) ? null : n
}

// ─── Column Map Resolution ───────────────────────────────────────────────────

/**
 * Build a lookup from logical field name to column index,
 * matching column_map values against CSV headers case-insensitively.
 */
function resolveColumnMap(
  headers: string[],
  columnMap: Record<string, string>
): Record<string, number> {
  const headerLower = headers.map((h) => h.trim().toLowerCase())
  const resolved: Record<string, number> = {}
  for (const [logicalField, csvHeaderName] of Object.entries(columnMap)) {
    const idx = headerLower.indexOf(csvHeaderName.toLowerCase())
    if (idx !== -1) {
      resolved[logicalField] = idx
    }
  }
  return resolved
}

/**
 * Extract a cell value by logical field name using the resolved column map.
 */
function getField(
  cells: string[],
  resolved: Record<string, number>,
  logicalField: string
): string {
  const idx = resolved[logicalField]
  if (idx === undefined || idx >= cells.length) return ''
  return (cells[idx] ?? '').trim()
}

// ─── Row Filtering ───────────────────────────────────────────────────────────

function shouldIncludeRow(
  cells: string[],
  headers: string[],
  rowFilter: { column: string; include: string[] } | null | undefined
): boolean {
  if (!rowFilter) return true
  const headerLower = headers.map((h) => h.trim().toLowerCase())
  const colIdx = headerLower.indexOf(rowFilter.column.toLowerCase())
  if (colIdx === -1) return true // column not found, include all
  const cellValue = (cells[colIdx] ?? '').trim().toLowerCase()
  return rowFilter.include.some((v) => v.toLowerCase() === cellValue)
}

// ─── Amount Parsing ──────────────────────────────────────────────────────────

function parseAmountWithConvention(
  cells: string[],
  resolved: Record<string, number>,
  amountSign: CsvFormatTemplate['amount_sign']
): number | null {
  if (amountSign === 'separate_columns') {
    const debit = parseCurrency(getField(cells, resolved, 'amount'))
    const credit = parseCurrency(getField(cells, resolved, 'credit'))
    // Debit is the expense amount, credit reduces it
    if (debit !== null && debit !== 0) return Math.abs(debit)
    if (credit !== null && credit !== 0) return -Math.abs(credit)
    // If both are present, net them
    if (debit !== null && credit !== null) return Math.abs(debit) - Math.abs(credit)
    return debit ?? credit
  }

  const raw = parseCurrency(getField(cells, resolved, 'amount'))
  if (raw === null) return null

  if (amountSign === 'negative_is_debit') {
    // Negative values are debits (expenses), positive are credits
    // For expense entity: return absolute value of negative amounts
    // The caller decides how to interpret the sign based on entity_type
    return raw
  }

  // always_positive: amount is always the expense/booking value
  return raw
}

// ─── Confidence Scoring ──────────────────────────────────────────────────────

function scoreExpenseCandidate(
  date: string | null,
  amount: number | null,
  merchant: string | null,
  category: string | null,
  propertyCode: string | null
): number {
  let score = 0
  if (date) score += 0.25
  if (amount !== null && amount !== 0) score += 0.25
  if (merchant) score += 0.20
  if (category) score += 0.20
  if (propertyCode !== null) score += 0.10
  return parseFloat(score.toFixed(4))
}

function scoreBookingCandidate(
  checkIn: string | null,
  checkOut: string | null,
  confirmationCode: string | null,
  netPayout: number | null,
  guestName: string | null
): number {
  let score = 0
  if (checkIn) score += 0.20
  if (checkOut) score += 0.20
  if (confirmationCode) score += 0.20
  if (netPayout !== null && netPayout !== 0) score += 0.25
  if (guestName) score += 0.15
  return parseFloat(score.toFixed(4))
}

// ─── Dedupe Key Builders ─────────────────────────────────────────────────────

function buildExpenseDedupeKey(
  date: string,
  amount: number,
  merchant: string,
  refId?: string
): string {
  const merchantNorm = merchant.toLowerCase().replace(/\s+/g, ' ').trim()
  const parts = [date, amount.toFixed(2), merchantNorm]
  if (refId) parts.push(refId.trim())
  return parts.join('|')
}

function buildBookingDedupeKey(
  confirmationCode: string | null,
  checkIn: string | null,
  checkOut: string | null,
  guestName: string | null,
  propertyId?: string
): string {
  const pid = propertyId ?? '{PROPERTY_ID}'
  if (confirmationCode) {
    return `booking:${confirmationCode}:${pid}`
  }
  return `booking:nonce-${checkIn ?? 'unk'}-${checkOut ?? 'unk'}-${guestName ?? 'unknown'}:${pid}`
}

// ─── Normalize Merchant ──────────────────────────────────────────────────────

function normalizeMerchant(raw: string): string {
  let name = raw
    .replace(/\*[\d]+/g, '')
    .replace(/\d{5,}/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()

  name = name.replace(/\s{2,}[A-Z]{2}\s*$/, '').trim()

  name = name
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())

  return name
}

// ─── Nights Calculation ──────────────────────────────────────────────────────

function nightsBetween(checkIn: string, checkOut: string): number {
  const msPerDay = 1000 * 60 * 60 * 24
  return Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / msPerDay)
}

// ─── Row Processors by Entity Type ──────────────────────────────────────────

function processExpenseRow(
  cells: string[],
  headers: string[],
  resolved: Record<string, number>,
  template: CsvFormatTemplate,
  rowIndex: number,
  opts: UniversalParseOptions
): UniversalParsedRow {
  const errors: ValidationError[] = []
  const raw_payload: Record<string, string> = {}
  headers.forEach((h, idx) => {
    raw_payload[h] = (cells[idx] ?? '').trim()
  })

  // Date
  const dateRaw = getField(cells, resolved, 'date')
  const transaction_date = parseDate(dateRaw, template.date_format)
  if (!dateRaw) {
    errors.push({ field: 'date', reason: 'Date field is missing', severity: 'blocking' })
  } else if (!transaction_date) {
    errors.push({ field: 'date', reason: `Unparseable date: "${dateRaw}"`, severity: 'blocking' })
  }

  // Amount
  const rawAmount = parseAmountWithConvention(cells, resolved, template.amount_sign)
  let amount: number | null = rawAmount

  if (amount === null) {
    errors.push({ field: 'amount', reason: 'Amount is missing or non-numeric', severity: 'blocking' })
  } else if (template.amount_sign === 'negative_is_debit') {
    // For expenses with negative_is_debit, negative values are expenses
    // We store the absolute value
    if (amount > 0) {
      // Positive amount with negative_is_debit = credit/refund
      errors.push({ field: 'amount', reason: `Non-negative amount (${amount}): treated as refund/credit`, severity: 'soft' })
    } else {
      amount = Math.abs(amount)
    }
  }

  // Merchant
  const merchantRaw = getField(cells, resolved, 'merchant')
  const merchant_name = merchantRaw ? normalizeMerchant(merchantRaw) : null
  if (!merchant_name) {
    errors.push({ field: 'merchant', reason: 'Missing merchant name', severity: 'soft' })
  }

  // Description
  const descriptionRaw = getField(cells, resolved, 'description')
  const description = descriptionRaw || merchantRaw || null

  // Reference ID
  const reference_id = getField(cells, resolved, 'reference_id') || null

  // Category from source
  const category = getField(cells, resolved, 'category') || null

  // Confidence
  const confidence_score = scoreExpenseCandidate(
    transaction_date,
    amount,
    merchant_name,
    category,
    null // property resolution happens at review time
  )

  // Dedupe
  let dedupe_key: string | null = null
  if (transaction_date && amount !== null && merchant_name) {
    dedupe_key = buildExpenseDedupeKey(transaction_date, amount, merchant_name, reference_id ?? undefined)
  }

  // Duplicate check
  const isDuplicate = dedupe_key ? (opts.existingDedupeKeys?.has(dedupe_key) ?? false) : false
  if (isDuplicate) {
    errors.push({ field: 'dedupe_key', reason: 'Possible duplicate: matching transaction already imported', severity: 'soft' })
  }

  const hasBlocking = errors.some((e) => e.severity === 'blocking')
  const hasSoft = errors.some((e) => e.severity === 'soft')

  const normalized_payload: NormalizedExpense | null = hasBlocking ? null : {
    transaction_date,
    amount,
    merchant_name,
    description,
    candidate_category: category,
    reference_id,
  }

  let review_status: UniversalParsedRow['review_status']
  if (hasBlocking) {
    review_status = 'rejected'
  } else if (hasSoft || isDuplicate) {
    review_status = 'flagged'
  } else if (confidence_score >= 0.90) {
    review_status = 'approved'
  } else {
    review_status = 'flagged'
  }

  return {
    row_index: rowIndex,
    raw_payload,
    normalized_payload,
    validation_errors: errors,
    review_status,
    dedupe_key,
    confidence_score,
  }
}

function processBookingRow(
  cells: string[],
  headers: string[],
  resolved: Record<string, number>,
  template: CsvFormatTemplate,
  rowIndex: number,
  opts: UniversalParseOptions
): UniversalParsedRow {
  const errors: ValidationError[] = []
  const raw_payload: Record<string, string> = {}
  headers.forEach((h, idx) => {
    raw_payload[h] = (cells[idx] ?? '').trim()
  })

  // Confirmation code
  const confirmationCode = getField(cells, resolved, 'confirmation_code') || null
  if (!confirmationCode) {
    errors.push({ field: 'confirmation_code', reason: 'Confirmation code absent', severity: 'soft' })
  }

  // Guest name
  const guestName = getField(cells, resolved, 'guest_name') || null

  // Dates
  const checkInRaw = getField(cells, resolved, 'check_in')
  const checkOutRaw = getField(cells, resolved, 'check_out')
  const checkIn = parseDate(checkInRaw, template.date_format)
  const checkOut = parseDate(checkOutRaw, template.date_format)

  if (!checkInRaw) {
    errors.push({ field: 'check_in', reason: 'Check-in date is missing', severity: 'blocking' })
  } else if (!checkIn) {
    errors.push({ field: 'check_in', reason: `Unparseable date: "${checkInRaw}"`, severity: 'blocking' })
  }
  if (!checkOutRaw) {
    errors.push({ field: 'check_out', reason: 'Check-out date is missing', severity: 'blocking' })
  } else if (!checkOut) {
    errors.push({ field: 'check_out', reason: `Unparseable date: "${checkOutRaw}"`, severity: 'blocking' })
  }
  if (checkIn && checkOut && checkOut <= checkIn) {
    errors.push({ field: 'check_out', reason: 'Check-out must be after check-in', severity: 'blocking' })
  }

  // Nights
  let nights: number | null = null
  const nightsRaw = getField(cells, resolved, 'nights')
  if (nightsRaw) {
    nights = parseInt(nightsRaw, 10)
    if (isNaN(nights)) nights = null
  }
  if (nights == null && checkIn && checkOut) {
    nights = nightsBetween(checkIn, checkOut)
  }
  if (nights != null && checkIn && checkOut) {
    const derived = nightsBetween(checkIn, checkOut)
    if (derived !== nights) {
      errors.push({ field: 'nights', reason: `Nights field (${nights}) does not match date range (${derived})`, severity: 'soft' })
      nights = derived
    }
  }

  // Currency fields
  const grossRevenue = parseCurrency(getField(cells, resolved, 'gross_revenue'))
  const cleaningFee = parseCurrency(getField(cells, resolved, 'cleaning_fee'))
  const platformFee = parseCurrency(getField(cells, resolved, 'platform_fee'))
  const tax = parseCurrency(getField(cells, resolved, 'tax'))
  const netPayout = parseCurrency(getField(cells, resolved, 'net_payout'))

  if (netPayout === null) {
    errors.push({ field: 'net_payout', reason: 'Net payout is missing or non-numeric', severity: 'blocking' })
  } else if (netPayout === 0) {
    errors.push({ field: 'net_payout', reason: 'Net payout is zero', severity: 'blocking' })
  } else if (netPayout < 0) {
    errors.push({ field: 'net_payout', reason: 'Negative payout, may be an adjustment', severity: 'soft' })
  }

  if (grossRevenue === null || grossRevenue === 0) {
    errors.push({ field: 'gross_revenue', reason: 'Gross revenue absent or zero', severity: 'soft' })
  }

  // Staleness checks
  if (checkIn) {
    const threeYearsAgo = new Date()
    threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3)
    if (new Date(checkIn) < threeYearsAgo) {
      errors.push({ field: 'check_in', reason: 'Check-in is more than 3 years in the past', severity: 'soft' })
    }
    const futureLimit = new Date()
    futureLimit.setDate(futureLimit.getDate() + 180)
    if (new Date(checkIn) > futureLimit) {
      errors.push({ field: 'check_in', reason: 'Check-in is more than 180 days in the future', severity: 'soft' })
    }
  }

  // Confidence
  const confidence_score = scoreBookingCandidate(checkIn, checkOut, confirmationCode, netPayout, guestName)

  // Dedupe
  const dedupe_key = buildBookingDedupeKey(confirmationCode, checkIn, checkOut, guestName, opts.propertyId)

  const isDuplicate = dedupe_key ? (opts.existingDedupeKeys?.has(dedupe_key) ?? false) : false
  if (isDuplicate) {
    errors.push({ field: 'dedupe_key', reason: 'Possible duplicate: matching booking already imported', severity: 'soft' })
  }

  const hasBlocking = errors.some((e) => e.severity === 'blocking')
  const hasSoft = errors.some((e) => e.severity === 'soft')

  const normalized_payload: NormalizedBooking | null = hasBlocking ? null : {
    source_platform: template.name.toLowerCase().replace(/\s+/g, '-'),
    source_confirmation_code: confirmationCode,
    guest_name: guestName,
    check_in_date: checkIn,
    check_out_date: checkOut,
    nights,
    gross_revenue_amount: grossRevenue,
    cleaning_fee_amount: cleaningFee,
    platform_fee_amount: platformFee,
    tax_amount: tax,
    net_payout_amount: netPayout,
  }

  let review_status: UniversalParsedRow['review_status']
  if (hasBlocking) {
    review_status = 'rejected'
  } else if (hasSoft || isDuplicate) {
    review_status = 'flagged'
  } else if (confidence_score >= 0.80) {
    review_status = 'pending'
  } else {
    review_status = 'flagged'
  }

  return {
    row_index: rowIndex,
    raw_payload,
    normalized_payload,
    validation_errors: errors,
    review_status,
    dedupe_key,
    confidence_score,
  }
}

// ─── Main Entry Point ─────────────────────────────────────────────────────────

/**
 * Universal CSV parser. Takes raw CSV text and a format template,
 * returns parsed rows with normalized payloads per entity type.
 */
export function universalParse(
  csvText: string,
  template: CsvFormatTemplate,
  opts: UniversalParseOptions = {}
): UniversalParseResult {
  const allRows = splitCsvRows(stripBom(csvText))
  if (allRows.length < 2) {
    return { rows: [], summary: { total: 0, approved: 0, flagged: 0, rejected: 0, error_count: 0 } }
  }

  const headerRow = allRows[0]
  if (!headerRow) {
    return { rows: [], summary: { total: 0, approved: 0, flagged: 0, rejected: 0, error_count: 0 } }
  }

  const headers = headerRow.map((h) => h.trim())
  const resolved = resolveColumnMap(headers, template.column_map)

  const results: UniversalParsedRow[] = []
  let dataRowIndex = 0

  for (let i = 1; i < allRows.length; i++) {
    const cells = allRows[i]
    if (!cells || cells.length === 0) continue

    // Row filtering
    if (!shouldIncludeRow(cells, headers, template.row_filter)) continue

    const rowIndex = dataRowIndex++

    if (template.entity_type === 'expense') {
      results.push(processExpenseRow(cells, headers, resolved, template, rowIndex, opts))
    } else {
      results.push(processBookingRow(cells, headers, resolved, template, rowIndex, opts))
    }
  }

  const summary = {
    total: results.length,
    approved: results.filter((r) => r.review_status === 'approved').length,
    flagged: results.filter((r) => r.review_status === 'flagged').length,
    rejected: results.filter((r) => r.review_status === 'rejected').length,
    error_count: results.filter((r) => r.validation_errors.length > 0).length,
  }

  return { rows: results, summary }
}

// ─── Header Fingerprinting & Format Detection ────────────────────────────────

export interface FormatMatch {
  template: CsvFormatTemplate
  confidence: number
  matched_columns: string[]
  missing_columns: string[]
}

export interface FormatDetectionResult {
  fingerprint: string
  matches: FormatMatch[]
}

/**
 * Generate a deterministic fingerprint from CSV headers.
 * Normalizes by lowercasing, trimming, and sorting alphabetically,
 * then hashes with SHA-256 (Web Crypto API for Cloudflare Workers).
 * Returns the first 32 hex chars.
 */
export async function generateHeaderFingerprint(headers: string[]): Promise<string> {
  const normalized = headers
    .map((h) => h.trim().toLowerCase())
    .filter((h) => h.length > 0)
    .sort()
    .join(',')

  const data = new TextEncoder().encode(normalized)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hexString = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
  return hexString.substring(0, 32)
}

/**
 * Detect which CSV format templates match a given CSV's headers.
 * Returns fingerprint and ranked matches (confidence > 0.5).
 */
export async function detectFormat(
  csvText: string,
  templates: CsvFormatTemplate[]
): Promise<FormatDetectionResult> {
  const rows = splitCsvRows(stripBom(csvText))
  if (rows.length === 0) {
    return { fingerprint: '', matches: [] }
  }

  const headers = rows[0]!
  const fingerprint = await generateHeaderFingerprint(headers)
  const headersLower = headers.map((h) => h.trim().toLowerCase())

  const matches: FormatMatch[] = []

  for (const template of templates) {
    // Exact fingerprint match
    if (template.header_fingerprint && template.header_fingerprint === fingerprint) {
      const columnMap = template.column_map
      const allFields = Object.keys(columnMap)
      const matched = allFields.filter((field) =>
        headersLower.includes(columnMap[field]!.toLowerCase())
      )
      const missing = allFields.filter((field) =>
        !headersLower.includes(columnMap[field]!.toLowerCase())
      )
      matches.push({
        template,
        confidence: 1.0,
        matched_columns: matched,
        missing_columns: missing,
      })
      continue
    }

    // Fuzzy match via column_map
    const columnMap = template.column_map
    const allFields = Object.keys(columnMap)
    if (allFields.length === 0) continue

    const matched: string[] = []
    const missing: string[] = []

    for (const field of allFields) {
      const csvHeader = columnMap[field]!
      if (headersLower.includes(csvHeader.toLowerCase())) {
        matched.push(field)
      } else {
        missing.push(field)
      }
    }

    const confidence = parseFloat((matched.length / allFields.length).toFixed(4))
    if (confidence > 0.5) {
      matches.push({ template, confidence, matched_columns: matched, missing_columns: missing })
    }
  }

  // Sort by confidence descending
  matches.sort((a, b) => b.confidence - a.confidence)

  return { fingerprint, matches }
}
