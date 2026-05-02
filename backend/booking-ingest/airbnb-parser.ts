/**
 * Airbnb CSV Parser — Booking Ingestion (T6)
 *
 * Normalizes Airbnb CSV export rows into canonical booking fields per
 * the normalization rules in docs/specs/booking-revenue-ingest.md.
 *
 * author: AEON Dev | created: 2026-04-20 | last updated: 2026-04-20
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AirbnbCsvRow {
  [key: string]: string
}

export type ValidationError = {
  field: string
  reason: string
  severity: 'blocking' | 'soft'
}

export type NormalizedBookingRow = {
  source_platform: 'airbnb'
  source_confirmation_code: string | null
  guest_name: string | null
  check_in_date: string | null  // YYYY-MM-DD or null if blocking parse failure
  check_out_date: string | null
  nights: number | null
  gross_revenue_amount: number | null
  cleaning_fee_amount: number | null
  platform_fee_amount: number | null
  tax_amount: number | null
  net_payout_amount: number | null
}

export type ParsedRow = {
  raw_payload: AirbnbCsvRow
  normalized: NormalizedBookingRow
  validation_errors: ValidationError[]
  /** 'rejected' if any blocking error; 'flagged' if soft errors; 'pending' otherwise */
  initial_review_status: 'pending' | 'flagged' | 'rejected'
  /** {source_platform}:{source_confirmation_code}:{property_id} — filled after property is known */
  dedupe_key_template: string  // property_id is a placeholder until caller fills it in
}

// ─── Column Lookup (case-insensitive + aliases) ──────────────────────────────

/**
 * Find a column value by trying each alias against the row's keys (case-insensitive).
 * Returns the trimmed value of the first match, or empty string if none found.
 */
function findColumn(row: AirbnbCsvRow, ...aliases: string[]): string {
  const keys = Object.keys(row)
  for (const alias of aliases) {
    const lower = alias.toLowerCase()
    const match = keys.find((k) => k.toLowerCase() === lower)
    if (match !== undefined && row[match] !== undefined) {
      return row[match]!.trim()
    }
  }
  return ''
}

// ─── Row-Type Filtering ───────────────────────────────────────────────────────

/**
 * Filter parsed CSV rows to only Reservation rows.
 * If the CSV has no 'Type' column, all rows are kept (backward compat with old format).
 */
export function filterReservationRows(rows: AirbnbCsvRow[]): AirbnbCsvRow[] {
  if (rows.length === 0) return rows
  // Check if any row has a Type column (case-insensitive)
  const hasTypeColumn = rows.some((row) =>
    Object.keys(row).some((k) => k.toLowerCase() === 'type')
  )
  if (!hasTypeColumn) return rows
  return rows.filter((row) => findColumn(row, 'Type').toLowerCase() === 'reservation')
}

// ─── CSV Parsing ──────────────────────────────────────────────────────────────

/**
 * Parse a raw CSV string into rows of key-value pairs.
 * Handles quoted fields containing commas.
 */
export function parseCsvText(text: string): AirbnbCsvRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length < 2) return []

  const headerLine = lines[0]
  if (!headerLine) return []

  const headers = splitCsvLine(headerLine)
  const rows: AirbnbCsvRow[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line) continue

    const values = splitCsvLine(line)
    const row: AirbnbCsvRow = {}
    headers.forEach((h, idx) => {
      row[h.trim()] = (values[idx] ?? '').trim()
    })
    rows.push(row)
  }

  return rows
}

function splitCsvLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      // Handle escaped double-quotes
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

// ─── Normalization ────────────────────────────────────────────────────────────

/**
 * Normalize a single Airbnb CSV row into canonical booking fields.
 * property_id is provided by the caller at import time.
 */
export function normalizeAirbnbRow(row: AirbnbCsvRow): ParsedRow {
  const errors: ValidationError[] = []

  // Confirmation code (soft if missing)
  const confirmationCode = findColumn(row, 'Confirmation Code', 'Confirmation code') || null
  if (!confirmationCode) {
    errors.push({ field: 'source_confirmation_code', reason: 'Confirmation code absent — dedup fallback will run', severity: 'soft' })
  }

  // Guest name (optional)
  const guestName = findColumn(row, 'Guest Name', 'Guest') || null

  // Dates
  const checkInRaw = findColumn(row, 'Start Date', 'Start date')
  const checkOutRaw = findColumn(row, 'End Date', 'End date')
  const checkIn = parseDate(checkInRaw)
  const checkOut = parseDate(checkOutRaw)

  if (!checkIn) {
    errors.push({ field: 'check_in_date', reason: `Unparseable date: "${checkInRaw}"`, severity: 'blocking' })
  }
  if (!checkOut) {
    errors.push({ field: 'check_out_date', reason: `Unparseable date: "${checkOutRaw}"`, severity: 'blocking' })
  }
  if (checkIn && checkOut && checkOut <= checkIn) {
    errors.push({ field: 'check_out_date', reason: 'check_out_date must be after check_in_date', severity: 'blocking' })
  }

  // Nights
  let nights: number | null = null
  const nightsRaw = findColumn(row, 'Nights')
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
      nights = derived // Prefer derived
    }
  }

  // Currency fields
  const grossRevenue = parseCurrency(findColumn(row, 'Gross Earnings', 'Gross earnings'))
  const cleaningFee = parseCurrency(findColumn(row, 'Cleaning Fee', 'Cleaning fee'))
  const platformFee = parseCurrency(findColumn(row, 'Host Service Fee', 'Service fee', 'Host service fee'))
  const tax = parseCurrency(findColumn(row, 'Taxes', 'Airbnb remitted tax', 'Tax'))
  const netPayout = parseCurrency(findColumn(row, 'Amount', 'Paid out'))

  if (netPayout === null) {
    errors.push({ field: 'net_payout_amount', reason: 'Amount is missing or non-numeric — row cannot be committed', severity: 'blocking' })
  } else if (netPayout === 0) {
    errors.push({ field: 'net_payout_amount', reason: 'Amount is zero', severity: 'blocking' })
  } else if (netPayout < 0) {
    errors.push({ field: 'net_payout_amount', reason: 'Negative payout — may be an adjustment, review required', severity: 'soft' })
  }

  if (grossRevenue === null || grossRevenue === 0) {
    errors.push({ field: 'gross_revenue_amount', reason: 'Gross earnings absent or zero', severity: 'soft' })
  }

  // Staleness checks
  if (checkIn) {
    const threeYearsAgo = new Date()
    threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3)
    if (new Date(checkIn) < threeYearsAgo) {
      errors.push({ field: 'check_in_date', reason: 'Check-in date is more than 3 years in the past', severity: 'soft' })
    }
    const oneEightyDaysOut = new Date()
    oneEightyDaysOut.setDate(oneEightyDaysOut.getDate() + 180)
    if (new Date(checkIn) > oneEightyDaysOut) {
      errors.push({ field: 'check_in_date', reason: 'Check-in date is more than 180 days in the future', severity: 'soft' })
    }
  }

  const hasBlocking = errors.some((e) => e.severity === 'blocking')
  const hasSoft = errors.some((e) => e.severity === 'soft')

  const initial_review_status = hasBlocking ? 'rejected' : hasSoft ? 'flagged' : 'pending'

  const normalized: NormalizedBookingRow = {
    source_platform: 'airbnb',
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

  // Dedupe key template — caller must substitute {PROPERTY_ID}
  const dedupeKeyTemplate = confirmationCode
    ? `airbnb:${confirmationCode}:{PROPERTY_ID}`
    : `airbnb:nonce-${checkIn}-${checkOut}-${guestName ?? 'unknown'}:{PROPERTY_ID}`

  return { raw_payload: row, normalized, validation_errors: errors, initial_review_status, dedupe_key_template: dedupeKeyTemplate }
}

// ─── Deduplication ────────────────────────────────────────────────────────────

export type DedupeResult =
  | { outcome: 'new' }
  | { outcome: 'duplicate_exact'; existing_booking_id: string }
  | { outcome: 'duplicate_conflict'; existing_booking_id: string; conflict_fields: string[] }
  | { outcome: 'fallback_match'; candidate_booking_ids: string[] }

/** Durable fields: conflicts on these require user review */
const DURABLE_FIELDS: (keyof NormalizedBookingRow)[] = [
  'check_in_date',
  'check_out_date',
  'net_payout_amount',
  'gross_revenue_amount',
]

/**
 * Determine dedup outcome for a normalized row against existing committed bookings.
 *
 * existingBookings: array of committed bookings already in DB for this workspace.
 */
export function checkDedup(
  normalized: NormalizedBookingRow,
  propertyId: string,
  existingBookings: Array<{
    id: string
    source_platform: string
    source_confirmation_code: string | null
    check_in_date: string
    check_out_date: string
    guest_name: string | null
    net_payout_amount: number | null
    gross_revenue_amount: number | null
  }>
): DedupeResult {
  const { source_platform, source_confirmation_code } = normalized

  // Primary key dedup: platform + confirmation code
  if (source_confirmation_code) {
    const match = existingBookings.find(
      (b) => b.source_platform === source_platform && b.source_confirmation_code === source_confirmation_code
    )
    if (match) {
      const conflicts = DURABLE_FIELDS.filter((f) => {
        const incoming = normalized[f]
        const existing = match[f as keyof typeof match]
        return incoming != null && existing != null && String(incoming) !== String(existing)
      })
      if (conflicts.length > 0) {
        return { outcome: 'duplicate_conflict', existing_booking_id: match.id, conflict_fields: conflicts }
      }
      return { outcome: 'duplicate_exact', existing_booking_id: match.id }
    }
    return { outcome: 'new' }
  }

  // Fallback dedup: property + check-in + check-out + guest name
  const candidates = existingBookings.filter(
    (b) =>
      b.check_in_date === normalized.check_in_date &&
      b.check_out_date === normalized.check_out_date &&
      (normalized.guest_name == null || b.guest_name === normalized.guest_name)
  )

  if (candidates.length > 0) {
    return { outcome: 'fallback_match', candidate_booking_ids: candidates.map((b) => b.id) }
  }

  return { outcome: 'new' }
}

// ─── Small Utilities ──────────────────────────────────────────────────────────

/** Parse date in MM/DD/YYYY, M/D/YYYY, or YYYY-MM-DD into YYYY-MM-DD. Returns null on failure. */
function parseDate(raw: string | undefined): string | null {
  if (!raw) return null
  const trimmed = raw.trim()

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const d = new Date(trimmed)
    return isNaN(d.getTime()) ? null : trimmed
  }

  // MM/DD/YYYY or M/D/YYYY
  const mdyMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (mdyMatch) {
    const [, monthRaw, dayRaw, yearRaw] = mdyMatch
    if (!monthRaw || !dayRaw || !yearRaw) return null

    const padded = `${yearRaw}-${monthRaw.padStart(2, '0')}-${dayRaw.padStart(2, '0')}`
    const date = new Date(padded)
    return isNaN(date.getTime()) ? null : padded
  }

  return null
}

/** Strip currency symbols and parse to number. Returns null on parse failure. */
function parseCurrency(raw: string | undefined): number | null {
  if (!raw) return null
  let s = raw.trim()
  // Handle parentheses as negative: (123.45) → -123.45
  const isNegative = s.startsWith('(') && s.endsWith(')')
  if (isNegative) s = '-' + s.slice(1, -1)
  // Strip $, commas, whitespace
  s = s.replace(/[$,\s]/g, '')
  const n = parseFloat(s)
  return isNaN(n) ? null : n
}

function nightsBetween(checkIn: string, checkOut: string): number {
  const msPerDay = 1000 * 60 * 60 * 24
  return Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / msPerDay)
}
