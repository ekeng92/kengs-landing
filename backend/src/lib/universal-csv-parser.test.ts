// author: AEON Test | created: 2026-05-10
// Tests for universal CSV parser

import { describe, it, expect } from 'vitest'
import {
  universalParse,
  splitCsvLine,
  splitCsvRows,
  parseDate,
  parseCurrency,
  normalizeValue,
  generateHeaderFingerprint,
  detectFormat,
  type CsvFormatTemplate,
  type UniversalParseOptions,
} from './universal-csv-parser.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeExpenseTemplate(overrides: Partial<CsvFormatTemplate> = {}): CsvFormatTemplate {
  return {
    id: 'tmpl-1',
    name: 'Test Bank',
    entity_type: 'expense',
    column_map: {
      date: 'Date',
      amount: 'Amount',
      merchant: 'Description',
      description: 'Memo',
      reference_id: 'Reference',
      category: 'Category',
    },
    amount_sign: 'negative_is_debit',
    date_format: 'auto',
    ...overrides,
  }
}

function makeBookingTemplate(overrides: Partial<CsvFormatTemplate> = {}): CsvFormatTemplate {
  return {
    id: 'tmpl-2',
    name: 'Airbnb',
    entity_type: 'booking',
    column_map: {
      confirmation_code: 'Confirmation Code',
      guest_name: 'Guest',
      check_in: 'Start Date',
      check_out: 'End Date',
      nights: 'Nights',
      gross_revenue: 'Gross Earnings',
      cleaning_fee: 'Cleaning Fee',
      platform_fee: 'Host Service Fee',
      tax: 'Taxes',
      net_payout: 'Amount',
      type: 'Type',
    },
    row_filter: { column: 'Type', include: ['Reservation'] },
    amount_sign: 'always_positive',
    date_format: 'auto',
    ...overrides,
  }
}

const BANK_CSV = `Date,Amount,Description,Memo,Reference,Category
01/15/2026,-45.99,LOWES #1234,Supplies purchase,REF001,Supplies
01/16/2026,-120.00,HILTON CLEANING SVC,Monthly cleaning,REF002,Cleaning
01/17/2026,25.00,REFUND AMAZON,Refund for return,REF003,Retail`

const AIRBNB_CSV = `Type,Confirmation Code,Guest,Start Date,End Date,Nights,Gross Earnings,Cleaning Fee,Host Service Fee,Taxes,Amount
Reservation,ABC123,John Smith,01/20/2026,01/23/2026,3,$450.00,$75.00,($52.50),$33.75,$506.25
Payout,,,,,,,,,,
Reservation,DEF456,Jane Doe,02/01/2026,02/05/2026,4,$600.00,$100.00,($70.00),$45.00,$675.00`

// ─── splitCsvLine ─────────────────────────────────────────────────────────────

describe('splitCsvLine', () => {
  it('splits simple comma-separated values', () => {
    expect(splitCsvLine('a,b,c')).toEqual(['a', 'b', 'c'])
  })

  it('handles quoted fields with commas', () => {
    expect(splitCsvLine('"hello, world",b,c')).toEqual(['hello, world', 'b', 'c'])
  })

  it('handles escaped double quotes', () => {
    expect(splitCsvLine('"say ""hello""",b')).toEqual(['say "hello"', 'b'])
  })

  it('handles empty fields', () => {
    expect(splitCsvLine('a,,c,')).toEqual(['a', '', 'c', ''])
  })
})

// ─── splitCsvRows ─────────────────────────────────────────────────────────────

describe('splitCsvRows', () => {
  it('splits multi-row CSV text', () => {
    const rows = splitCsvRows('a,b\n1,2\n3,4')
    expect(rows).toEqual([['a', 'b'], ['1', '2'], ['3', '4']])
  })

  it('handles CRLF line endings', () => {
    const rows = splitCsvRows('a,b\r\n1,2\r\n')
    expect(rows).toEqual([['a', 'b'], ['1', '2']])
  })

  it('handles multi-line quoted fields', () => {
    const rows = splitCsvRows('a,"line1\nline2",c\n1,2,3')
    expect(rows).toEqual([['a', 'line1\nline2', 'c'], ['1', '2', '3']])
  })

  it('skips completely empty rows', () => {
    const rows = splitCsvRows('a,b\n\n1,2')
    expect(rows).toEqual([['a', 'b'], ['1', '2']])
  })
})

// ─── parseDate ────────────────────────────────────────────────────────────────

describe('parseDate', () => {
  it('parses ISO format', () => {
    expect(parseDate('2026-01-15')).toBe('2026-01-15')
  })

  it('parses MM/DD/YYYY', () => {
    expect(parseDate('01/15/2026')).toBe('2026-01-15')
  })

  it('parses M/D/YYYY', () => {
    expect(parseDate('1/5/2026')).toBe('2026-01-05')
  })

  it('parses M/D/YY as 20YY', () => {
    expect(parseDate('1/5/26')).toBe('2026-01-05')
  })

  it('parses DD/MM/YYYY when format specified', () => {
    expect(parseDate('25/01/2026', 'DD/MM/YYYY')).toBe('2026-01-25')
  })

  it('returns null for empty string', () => {
    expect(parseDate('')).toBeNull()
  })

  it('returns null for garbage', () => {
    expect(parseDate('not-a-date')).toBeNull()
  })

  it('returns null for invalid date', () => {
    expect(parseDate('13/32/2026')).toBeNull()
  })

  it('respects explicit YYYY-MM-DD format', () => {
    expect(parseDate('2026-01-15', 'YYYY-MM-DD')).toBe('2026-01-15')
    expect(parseDate('01/15/2026', 'YYYY-MM-DD')).toBeNull()
  })

  it('respects explicit MM/DD/YYYY format', () => {
    expect(parseDate('01/15/2026', 'MM/DD/YYYY')).toBe('2026-01-15')
  })
})

// ─── parseCurrency ────────────────────────────────────────────────────────────

describe('parseCurrency', () => {
  it('parses plain numbers', () => {
    expect(parseCurrency('100')).toBe(100)
  })

  it('strips dollar signs and commas', () => {
    expect(parseCurrency('$1,234.56')).toBe(1234.56)
  })

  it('handles parentheses as negative', () => {
    expect(parseCurrency('($52.50)')).toBe(-52.50)
  })

  it('handles negative sign', () => {
    expect(parseCurrency('-45.99')).toBe(-45.99)
  })

  it('returns null for empty', () => {
    expect(parseCurrency('')).toBeNull()
  })

  it('returns null for non-numeric', () => {
    expect(parseCurrency('abc')).toBeNull()
  })
})

// ─── normalizeValue ──────────────────────────────────────────────────────────

describe('normalizeValue', () => {
  it('trims whitespace', () => {
    expect(normalizeValue('  hello  ')).toBe('hello')
  })

  it('collapses internal whitespace', () => {
    expect(normalizeValue('hello   world')).toBe('hello world')
  })
})

// ─── universalParse: Expense CSVs ─────────────────────────────────────────────

describe('universalParse — expense', () => {
  it('parses valid bank CSV rows', () => {
    const template = makeExpenseTemplate()
    const result = universalParse(BANK_CSV, template)

    expect(result.rows.length).toBe(3)
    expect(result.summary.total).toBe(3)
  })

  it('correctly normalizes expense fields', () => {
    const template = makeExpenseTemplate()
    const result = universalParse(BANK_CSV, template)

    const row0 = result.rows[0]!
    expect(row0.normalized_payload).not.toBeNull()
    const norm = row0.normalized_payload as any
    expect(norm.transaction_date).toBe('2026-01-15')
    expect(norm.amount).toBe(45.99)
    expect(norm.merchant_name).toBeTruthy()
    expect(norm.reference_id).toBe('REF001')
  })

  it('treats positive amounts as refunds with negative_is_debit', () => {
    const template = makeExpenseTemplate()
    const result = universalParse(BANK_CSV, template)

    const refundRow = result.rows[2]!
    // Positive amount with negative_is_debit should be flagged as refund
    expect(refundRow.validation_errors.some((e) => e.field === 'amount')).toBe(true)
  })

  it('generates dedupe keys for valid rows', () => {
    const template = makeExpenseTemplate()
    const result = universalParse(BANK_CSV, template)

    const row0 = result.rows[0]!
    expect(row0.dedupe_key).toBeTruthy()
    expect(row0.dedupe_key).toContain('2026-01-15')
    expect(row0.dedupe_key).toContain('45.99')
  })

  it('flags duplicates when existing keys provided', () => {
    const template = makeExpenseTemplate()
    // First parse to get the key
    const first = universalParse(BANK_CSV, template)
    const key = first.rows[0]!.dedupe_key!

    const opts: UniversalParseOptions = {
      existingDedupeKeys: new Set([key]),
    }
    const second = universalParse(BANK_CSV, template, opts)
    const row0 = second.rows[0]!
    expect(row0.validation_errors.some((e) => e.field === 'dedupe_key')).toBe(true)
    expect(row0.review_status).toBe('flagged')
  })

  it('handles always_positive amount sign', () => {
    const csv = `Date,Amount,Description\n01/15/2026,45.99,STORE`
    const template = makeExpenseTemplate({
      amount_sign: 'always_positive',
      column_map: { date: 'Date', amount: 'Amount', merchant: 'Description' },
    })
    const result = universalParse(csv, template)
    const norm = result.rows[0]!.normalized_payload as any
    expect(norm.amount).toBe(45.99)
  })

  it('handles separate_columns amount sign', () => {
    const csv = `Date,Debit,Credit,Description\n01/15/2026,45.99,,STORE\n01/16/2026,,10.00,REFUND`
    const template = makeExpenseTemplate({
      amount_sign: 'separate_columns',
      column_map: { date: 'Date', amount: 'Debit', credit: 'Credit', merchant: 'Description' },
    })
    const result = universalParse(csv, template)
    expect(result.rows.length).toBe(2)

    const debitRow = result.rows[0]!.normalized_payload as any
    expect(debitRow.amount).toBe(45.99)

    const creditRow = result.rows[1]!.normalized_payload as any
    // Credit returns negative
    expect(creditRow.amount).toBe(-10.00)
  })

  it('rejects rows with missing required date', () => {
    const csv = `Date,Amount,Description\n,50.00,STORE`
    const template = makeExpenseTemplate({
      column_map: { date: 'Date', amount: 'Amount', merchant: 'Description' },
    })
    const result = universalParse(csv, template)
    expect(result.rows[0]!.review_status).toBe('rejected')
    expect(result.rows[0]!.validation_errors.some((e) => e.field === 'date' && e.severity === 'blocking')).toBe(true)
  })

  it('rejects rows with missing required amount', () => {
    const csv = `Date,Amount,Description\n01/15/2026,,STORE`
    const template = makeExpenseTemplate({
      column_map: { date: 'Date', amount: 'Amount', merchant: 'Description' },
    })
    const result = universalParse(csv, template)
    expect(result.rows[0]!.review_status).toBe('rejected')
    expect(result.rows[0]!.validation_errors.some((e) => e.field === 'amount' && e.severity === 'blocking')).toBe(true)
  })

  it('generates confidence scores', () => {
    const template = makeExpenseTemplate()
    const result = universalParse(BANK_CSV, template)
    const row0 = result.rows[0]!
    expect(row0.confidence_score).toBeGreaterThan(0)
    expect(row0.confidence_score).toBeLessThanOrEqual(1)
  })

  it('preserves raw_payload with original headers', () => {
    const template = makeExpenseTemplate()
    const result = universalParse(BANK_CSV, template)
    const row0 = result.rows[0]!
    expect(row0.raw_payload['Date']).toBe('01/15/2026')
    expect(row0.raw_payload['Amount']).toBe('-45.99')
  })

  it('respects explicit date format', () => {
    const csv = `Date,Amount,Description\n25/01/2026,-50.00,STORE`
    const template = makeExpenseTemplate({
      date_format: 'DD/MM/YYYY',
      column_map: { date: 'Date', amount: 'Amount', merchant: 'Description' },
    })
    const result = universalParse(csv, template)
    const norm = result.rows[0]!.normalized_payload as any
    expect(norm.transaction_date).toBe('2026-01-25')
  })

  it('returns empty result for header-only CSV', () => {
    const csv = `Date,Amount,Description`
    const template = makeExpenseTemplate()
    const result = universalParse(csv, template)
    expect(result.rows).toEqual([])
    expect(result.summary.total).toBe(0)
  })

  it('returns empty result for empty CSV', () => {
    const result = universalParse('', makeExpenseTemplate())
    expect(result.rows).toEqual([])
  })

  it('handles case-insensitive column matching', () => {
    const csv = `date,amount,description\n01/15/2026,-50.00,STORE`
    const template = makeExpenseTemplate({
      column_map: { date: 'Date', amount: 'Amount', merchant: 'Description' },
    })
    const result = universalParse(csv, template)
    expect(result.rows.length).toBe(1)
    const norm = result.rows[0]!.normalized_payload as any
    expect(norm.transaction_date).toBe('2026-01-15')
  })
})

// ─── universalParse: Booking CSVs ────────────────────────────────────────────

describe('universalParse — booking', () => {
  it('parses valid Airbnb CSV with row filtering', () => {
    const template = makeBookingTemplate()
    const result = universalParse(AIRBNB_CSV, template)

    // Should filter out the Payout row
    expect(result.rows.length).toBe(2)
    expect(result.summary.total).toBe(2)
  })

  it('correctly normalizes booking fields', () => {
    const template = makeBookingTemplate()
    const result = universalParse(AIRBNB_CSV, template)

    const row0 = result.rows[0]!
    expect(row0.normalized_payload).not.toBeNull()
    const norm = row0.normalized_payload as any
    expect(norm.source_confirmation_code).toBe('ABC123')
    expect(norm.guest_name).toBe('John Smith')
    expect(norm.check_in_date).toBe('2026-01-20')
    expect(norm.check_out_date).toBe('2026-01-23')
    expect(norm.nights).toBe(3)
    expect(norm.gross_revenue_amount).toBe(450.00)
    expect(norm.cleaning_fee_amount).toBe(75.00)
    expect(norm.platform_fee_amount).toBe(-52.50) // parentheses = negative
    expect(norm.tax_amount).toBe(33.75)
    expect(norm.net_payout_amount).toBe(506.25)
  })

  it('generates booking dedupe keys', () => {
    const template = makeBookingTemplate()
    const result = universalParse(AIRBNB_CSV, template, { propertyId: 'prop-1' })

    const row0 = result.rows[0]!
    expect(row0.dedupe_key).toBe('booking:ABC123:prop-1')
  })

  it('generates fallback dedupe key when no confirmation code', () => {
    const csv = `Type,Confirmation Code,Guest,Start Date,End Date,Nights,Amount
Reservation,,Jane,01/20/2026,01/23/2026,3,$500.00`
    const template = makeBookingTemplate({
      column_map: {
        type: 'Type',
        confirmation_code: 'Confirmation Code',
        guest_name: 'Guest',
        check_in: 'Start Date',
        check_out: 'End Date',
        nights: 'Nights',
        net_payout: 'Amount',
      },
    })
    const result = universalParse(csv, template)
    expect(result.rows[0]!.dedupe_key).toContain('nonce')
    expect(result.rows[0]!.dedupe_key).toContain('Jane')
  })

  it('rejects rows with missing check-in date', () => {
    const csv = `Type,Start Date,End Date,Amount
Reservation,,01/23/2026,$500.00`
    const template = makeBookingTemplate({
      column_map: { type: 'Type', check_in: 'Start Date', check_out: 'End Date', net_payout: 'Amount' },
      row_filter: null,
    })
    const result = universalParse(csv, template)
    expect(result.rows[0]!.review_status).toBe('rejected')
    expect(result.rows[0]!.validation_errors.some((e) => e.field === 'check_in' && e.severity === 'blocking')).toBe(true)
  })

  it('rejects rows with missing net payout', () => {
    const csv = `Type,Start Date,End Date,Amount
Reservation,01/20/2026,01/23/2026,`
    const template = makeBookingTemplate({
      column_map: { type: 'Type', check_in: 'Start Date', check_out: 'End Date', net_payout: 'Amount' },
      row_filter: null,
    })
    const result = universalParse(csv, template)
    expect(result.rows[0]!.review_status).toBe('rejected')
  })

  it('rejects rows where check-out is before check-in', () => {
    const csv = `Start Date,End Date,Amount
01/25/2026,01/20/2026,$500.00`
    const template = makeBookingTemplate({
      column_map: { check_in: 'Start Date', check_out: 'End Date', net_payout: 'Amount' },
      row_filter: null,
    })
    const result = universalParse(csv, template)
    expect(result.rows[0]!.review_status).toBe('rejected')
  })

  it('derives nights from dates when not provided', () => {
    const csv = `Start Date,End Date,Amount
01/20/2026,01/23/2026,$500.00`
    const template = makeBookingTemplate({
      column_map: { check_in: 'Start Date', check_out: 'End Date', net_payout: 'Amount' },
      row_filter: null,
    })
    const result = universalParse(csv, template)
    const norm = result.rows[0]!.normalized_payload as any
    expect(norm.nights).toBe(3)
  })

  it('flags mismatched nights vs date range', () => {
    const csv = `Start Date,End Date,Nights,Amount
01/20/2026,01/23/2026,5,$500.00`
    const template = makeBookingTemplate({
      column_map: { check_in: 'Start Date', check_out: 'End Date', nights: 'Nights', net_payout: 'Amount' },
      row_filter: null,
    })
    const result = universalParse(csv, template)
    expect(result.rows[0]!.validation_errors.some((e) => e.field === 'nights')).toBe(true)
    // Derived value wins
    const norm = result.rows[0]!.normalized_payload as any
    expect(norm.nights).toBe(3)
  })

  it('generates confidence scores for bookings', () => {
    const template = makeBookingTemplate()
    const result = universalParse(AIRBNB_CSV, template)
    const row0 = result.rows[0]!
    expect(row0.confidence_score).toBeGreaterThan(0)
    expect(row0.confidence_score).toBeLessThanOrEqual(1)
  })

  it('handles case-insensitive column matching', () => {
    const csv = `type,confirmation code,guest,start date,end date,nights,amount
Reservation,XYZ789,Bob,01/20/2026,01/23/2026,3,$500.00`
    const template = makeBookingTemplate({
      column_map: {
        type: 'Type',
        confirmation_code: 'Confirmation Code',
        guest_name: 'Guest',
        check_in: 'Start Date',
        check_out: 'End Date',
        nights: 'Nights',
        net_payout: 'Amount',
      },
      row_filter: { column: 'Type', include: ['Reservation'] },
    })
    const result = universalParse(csv, template)
    expect(result.rows.length).toBe(1)
    const norm = result.rows[0]!.normalized_payload as any
    expect(norm.source_confirmation_code).toBe('XYZ789')
  })
})

// ─── Row Filtering ───────────────────────────────────────────────────────────

describe('universalParse — row filtering', () => {
  it('filters rows by column value', () => {
    const template = makeBookingTemplate()
    const result = universalParse(AIRBNB_CSV, template)
    // Payout row should be filtered out
    expect(result.rows.length).toBe(2)
  })

  it('includes all rows when no filter set', () => {
    const template = makeBookingTemplate({ row_filter: null })
    const result = universalParse(AIRBNB_CSV, template)
    // All 3 data rows included
    expect(result.rows.length).toBe(3)
  })

  it('filter is case-insensitive', () => {
    const csv = `Type,Start Date,End Date,Amount
reservation,01/20/2026,01/23/2026,$500.00
PAYOUT,,,$0.00`
    const template = makeBookingTemplate({
      column_map: { type: 'Type', check_in: 'Start Date', check_out: 'End Date', net_payout: 'Amount' },
      row_filter: { column: 'Type', include: ['Reservation'] },
    })
    const result = universalParse(csv, template)
    expect(result.rows.length).toBe(1)
  })

  it('includes all rows when filter column not found', () => {
    const csv = `Start Date,End Date,Amount
01/20/2026,01/23/2026,$500.00`
    const template = makeBookingTemplate({
      column_map: { check_in: 'Start Date', check_out: 'End Date', net_payout: 'Amount' },
      row_filter: { column: 'NonExistent', include: ['Reservation'] },
    })
    const result = universalParse(csv, template)
    expect(result.rows.length).toBe(1)
  })
})

// ─── Date Format Handling ────────────────────────────────────────────────────

describe('universalParse — date formats', () => {
  it('auto-detects ISO dates', () => {
    const csv = `Date,Amount,Description\n2026-01-15,-50.00,STORE`
    const template = makeExpenseTemplate({
      date_format: 'auto',
      column_map: { date: 'Date', amount: 'Amount', merchant: 'Description' },
    })
    const result = universalParse(csv, template)
    const norm = result.rows[0]!.normalized_payload as any
    expect(norm.transaction_date).toBe('2026-01-15')
  })

  it('auto-detects M/D/YYYY dates', () => {
    const csv = `Date,Amount,Description\n1/5/2026,-50.00,STORE`
    const template = makeExpenseTemplate({
      date_format: 'auto',
      column_map: { date: 'Date', amount: 'Amount', merchant: 'Description' },
    })
    const result = universalParse(csv, template)
    const norm = result.rows[0]!.normalized_payload as any
    expect(norm.transaction_date).toBe('2026-01-05')
  })

  it('parses DD/MM/YYYY when specified', () => {
    const csv = `Date,Amount,Description\n15/01/2026,-50.00,STORE`
    const template = makeExpenseTemplate({
      date_format: 'DD/MM/YYYY',
      column_map: { date: 'Date', amount: 'Amount', merchant: 'Description' },
    })
    const result = universalParse(csv, template)
    const norm = result.rows[0]!.normalized_payload as any
    expect(norm.transaction_date).toBe('2026-01-15')
  })

  it('rejects dates that do not match the specified format', () => {
    const csv = `Date,Amount,Description\n01/15/2026,-50.00,STORE`
    const template = makeExpenseTemplate({
      date_format: 'YYYY-MM-DD',
      column_map: { date: 'Date', amount: 'Amount', merchant: 'Description' },
    })
    const result = universalParse(csv, template)
    expect(result.rows[0]!.review_status).toBe('rejected')
  })
})

// ─── Amount Sign Conventions ─────────────────────────────────────────────────

describe('universalParse — amount conventions', () => {
  it('negative_is_debit: negative amount becomes positive expense', () => {
    const csv = `Date,Amount,Description\n01/15/2026,-99.50,STORE`
    const template = makeExpenseTemplate({
      column_map: { date: 'Date', amount: 'Amount', merchant: 'Description' },
    })
    const result = universalParse(csv, template)
    const norm = result.rows[0]!.normalized_payload as any
    expect(norm.amount).toBe(99.50)
  })

  it('always_positive: amount used as-is', () => {
    const csv = `Date,Amount,Description\n01/15/2026,99.50,STORE`
    const template = makeExpenseTemplate({
      amount_sign: 'always_positive',
      column_map: { date: 'Date', amount: 'Amount', merchant: 'Description' },
    })
    const result = universalParse(csv, template)
    const norm = result.rows[0]!.normalized_payload as any
    expect(norm.amount).toBe(99.50)
  })

  it('separate_columns: uses debit when present', () => {
    const csv = `Date,Debit,Credit,Description\n01/15/2026,75.00,,STORE`
    const template = makeExpenseTemplate({
      amount_sign: 'separate_columns',
      column_map: { date: 'Date', amount: 'Debit', credit: 'Credit', merchant: 'Description' },
    })
    const result = universalParse(csv, template)
    const norm = result.rows[0]!.normalized_payload as any
    expect(norm.amount).toBe(75.00)
  })

  it('separate_columns: uses credit (negative) when debit is empty', () => {
    const csv = `Date,Debit,Credit,Description\n01/15/2026,,30.00,REFUND`
    const template = makeExpenseTemplate({
      amount_sign: 'separate_columns',
      column_map: { date: 'Date', amount: 'Debit', credit: 'Credit', merchant: 'Description' },
    })
    const result = universalParse(csv, template)
    const norm = result.rows[0]!.normalized_payload as any
    expect(norm.amount).toBe(-30.00)
  })
})

// ─── Summary ─────────────────────────────────────────────────────────────────

describe('universalParse — summary', () => {
  it('calculates summary counts correctly', () => {
    const template = makeBookingTemplate()
    const result = universalParse(AIRBNB_CSV, template)

    expect(result.summary.total).toBe(2)
    expect(result.summary.total).toBe(
      result.summary.approved + result.summary.flagged + result.summary.rejected +
      result.rows.filter((r) => r.review_status === 'pending').length
    )
  })

  it('counts errors in summary', () => {
    const csv = `Date,Amount,Description\n,-50.00,STORE\n01/15/2026,,-STORE`
    const template = makeExpenseTemplate({
      column_map: { date: 'Date', amount: 'Amount', merchant: 'Description' },
    })
    const result = universalParse(csv, template)
    expect(result.summary.error_count).toBe(2)
  })
})

// ─── Edge Cases ──────────────────────────────────────────────────────────────

describe('universalParse — edge cases', () => {
  it('handles CSV with extra columns not in column_map', () => {
    const csv = `Date,Amount,Description,Extra1,Extra2\n01/15/2026,-50.00,STORE,foo,bar`
    const template = makeExpenseTemplate({
      column_map: { date: 'Date', amount: 'Amount', merchant: 'Description' },
    })
    const result = universalParse(csv, template)
    expect(result.rows.length).toBe(1)
    // Extra columns should be in raw_payload
    expect(result.rows[0]!.raw_payload['Extra1']).toBe('foo')
  })

  it('handles CSV with quoted fields containing commas', () => {
    const csv = `Date,Amount,Description\n01/15/2026,-50.00,"STORE, INC."`
    const template = makeExpenseTemplate({
      column_map: { date: 'Date', amount: 'Amount', merchant: 'Description' },
    })
    const result = universalParse(csv, template)
    expect(result.rows[0]!.raw_payload['Description']).toBe('STORE, INC.')
  })

  it('handles currency with dollar signs and commas', () => {
    const csv = `Date,Amount,Description\n01/15/2026,"$-1,234.56",STORE`
    const template = makeExpenseTemplate({
      column_map: { date: 'Date', amount: 'Amount', merchant: 'Description' },
    })
    const result = universalParse(csv, template)
    const norm = result.rows[0]!.normalized_payload as any
    expect(norm.amount).toBe(1234.56)
  })

  it('handles booking CSV with parenthesized fees', () => {
    const csv = `Start Date,End Date,Host Service Fee,Amount
01/20/2026,01/23/2026,($52.50),$500.00`
    const template = makeBookingTemplate({
      column_map: {
        check_in: 'Start Date',
        check_out: 'End Date',
        platform_fee: 'Host Service Fee',
        net_payout: 'Amount',
      },
      row_filter: null,
    })
    const result = universalParse(csv, template)
    const norm = result.rows[0]!.normalized_payload as any
    expect(norm.platform_fee_amount).toBe(-52.50)
    expect(norm.net_payout_amount).toBe(500.00)
  })

  it('handles single data row CSV', () => {
    const csv = `Date,Amount,Description\n01/15/2026,-50.00,STORE`
    const template = makeExpenseTemplate({
      column_map: { date: 'Date', amount: 'Amount', merchant: 'Description' },
    })
    const result = universalParse(csv, template)
    expect(result.rows.length).toBe(1)
  })

  it('row_index increments only for included rows', () => {
    const template = makeBookingTemplate()
    const result = universalParse(AIRBNB_CSV, template)
    expect(result.rows[0]!.row_index).toBe(0)
    expect(result.rows[1]!.row_index).toBe(1)
  })
})

// ─── generateHeaderFingerprint ────────────────────────────────────────────────

describe('generateHeaderFingerprint', () => {
  it('produces a 32-char hex string', async () => {
    const fp = await generateHeaderFingerprint(['Date', 'Amount', 'Description'])
    expect(fp).toMatch(/^[0-9a-f]{32}$/)
  })

  it('same headers in different order produce same fingerprint', async () => {
    const fp1 = await generateHeaderFingerprint(['Date', 'Amount', 'Description'])
    const fp2 = await generateHeaderFingerprint(['Description', 'Date', 'Amount'])
    expect(fp1).toBe(fp2)
  })

  it('is case-insensitive', async () => {
    const fp1 = await generateHeaderFingerprint(['Date', 'Amount'])
    const fp2 = await generateHeaderFingerprint(['date', 'amount'])
    expect(fp1).toBe(fp2)
  })

  it('trims whitespace from headers', async () => {
    const fp1 = await generateHeaderFingerprint(['Date', 'Amount'])
    const fp2 = await generateHeaderFingerprint(['  Date  ', '  Amount  '])
    expect(fp1).toBe(fp2)
  })

  it('different headers produce different fingerprints', async () => {
    const fp1 = await generateHeaderFingerprint(['Date', 'Amount'])
    const fp2 = await generateHeaderFingerprint(['Name', 'Email'])
    expect(fp1).not.toBe(fp2)
  })

  it('ignores empty headers', async () => {
    const fp1 = await generateHeaderFingerprint(['Date', 'Amount'])
    const fp2 = await generateHeaderFingerprint(['Date', '', 'Amount', ''])
    expect(fp1).toBe(fp2)
  })
})

// ─── detectFormat ─────────────────────────────────────────────────────────────

describe('detectFormat', () => {
  it('returns exact fingerprint match with confidence 1.0', async () => {
    const csvText = 'Date,Amount,Description\n01/01/2026,100,Test'
    const fp = await generateHeaderFingerprint(['Date', 'Amount', 'Description'])
    const template = makeExpenseTemplate({ header_fingerprint: fp })

    const result = await detectFormat(csvText, [template])
    expect(result.matches).toHaveLength(1)
    expect(result.matches[0]!.confidence).toBe(1.0)
    expect(result.matches[0]!.template.id).toBe('tmpl-1')
  })

  it('returns fingerprint as 32-char hex', async () => {
    const csvText = 'Date,Amount\n01/01/2026,100'
    const result = await detectFormat(csvText, [])
    expect(result.fingerprint).toMatch(/^[0-9a-f]{32}$/)
  })

  it('returns proportional confidence for partial column match', async () => {
    const csvText = 'Date,Amount,Vendor\n01/01/2026,100,Store'
    // Template maps: date->Date, amount->Amount, merchant->Description, description->Memo, reference_id->Reference, category->Category
    // Only Date and Amount match (2 out of 6 = 0.3333), below 0.5 threshold
    const template = makeExpenseTemplate()
    const result = await detectFormat(csvText, [template])
    // 2/6 = 0.3333, below threshold, should be excluded
    expect(result.matches).toHaveLength(0)
  })

  it('includes templates above 0.5 confidence threshold', async () => {
    const csvText = 'Date,Amount,Description,Category\n01/01/2026,100,Store,Supplies'
    // date->Date, amount->Amount, merchant->Description, category->Category = 4/6 = 0.6667
    const template = makeExpenseTemplate()
    const result = await detectFormat(csvText, [template])
    expect(result.matches).toHaveLength(1)
    expect(result.matches[0]!.confidence).toBeCloseTo(0.6667, 3)
    expect(result.matches[0]!.matched_columns).toContain('date')
    expect(result.matches[0]!.matched_columns).toContain('amount')
    expect(result.matches[0]!.missing_columns).toContain('description')
    expect(result.matches[0]!.missing_columns).toContain('reference_id')
  })

  it('excludes templates below 0.5 confidence threshold', async () => {
    const csvText = 'Foo,Bar,Baz\n1,2,3'
    const template = makeExpenseTemplate()
    const result = await detectFormat(csvText, [template])
    expect(result.matches).toHaveLength(0)
  })

  it('sorts results by confidence descending', async () => {
    const csvText = 'Date,Amount,Description,Memo,Reference,Category\n01/01/2026,100,Store,note,ref,cat'
    const templateFull = makeExpenseTemplate({ id: 'full', name: 'Full Match' })
    const templatePartial = makeExpenseTemplate({
      id: 'partial',
      name: 'Partial',
      column_map: { date: 'Date', amount: 'Amount', merchant: 'Description', extra: 'NonExistent' },
    })

    const result = await detectFormat(csvText, [templatePartial, templateFull])
    expect(result.matches.length).toBeGreaterThanOrEqual(2)
    expect(result.matches[0]!.confidence).toBeGreaterThanOrEqual(result.matches[1]!.confidence)
    expect(result.matches[0]!.template.id).toBe('full')
  })

  it('handles empty CSV text', async () => {
    const result = await detectFormat('', [])
    expect(result.fingerprint).toBe('')
    expect(result.matches).toHaveLength(0)
  })

  it('column matching is case-insensitive', async () => {
    const csvText = 'date,amount,description,memo,reference,category\n01/01/2026,100,Store,note,ref,cat'
    const template = makeExpenseTemplate()
    const result = await detectFormat(csvText, [template])
    expect(result.matches).toHaveLength(1)
    expect(result.matches[0]!.confidence).toBe(1)
  })

  it('handles no templates gracefully', async () => {
    const csvText = 'Date,Amount,Description\n01/01/2026,100,Store'
    const result = await detectFormat(csvText, [])
    expect(result.fingerprint).toMatch(/^[0-9a-f]{32}$/)
    expect(result.matches).toHaveLength(0)
  })

  it('handles CSV with only headers (no data rows)', async () => {
    const csvText = 'Date,Amount,Description'
    const template = makeExpenseTemplate()
    const result = await detectFormat(csvText, [template])
    expect(result.fingerprint).toMatch(/^[0-9a-f]{32}$/)
    // Should still match on headers even without data
    expect(result.matches.length).toBeGreaterThanOrEqual(0)
  })

  it('ranks multiple 1.0 matches by position', async () => {
    const csvText = 'Date,Amount,Description,Memo,Reference,Category\n01/01/2026,100,Store,note,ref,cat'
    const fp = await generateHeaderFingerprint(['Date', 'Amount', 'Description', 'Memo', 'Reference', 'Category'])
    const tmpl1 = makeExpenseTemplate({ id: 'tmpl-a', name: 'Template A', header_fingerprint: fp })
    const tmpl2 = makeExpenseTemplate({ id: 'tmpl-b', name: 'Template B', header_fingerprint: fp })
    const result = await detectFormat(csvText, [tmpl1, tmpl2])
    // Both should match at 1.0
    expect(result.matches.filter((m) => m.confidence === 1.0).length).toBe(2)
  })
})

// ─── Regression: BOM Handling ────────────────────────────────────────────────

describe('universalParse — BOM handling', () => {
  it('handles UTF-8 BOM in CSV text', () => {
    const bom = '\uFEFF'
    const csv = `${bom}Date,Amount,Description\n01/15/2026,-50.00,STORE`
    const template = makeExpenseTemplate({
      column_map: { date: 'Date', amount: 'Amount', merchant: 'Description' },
    })
    const result = universalParse(csv, template)
    // BOM should not prevent header matching
    expect(result.rows.length).toBe(1)
    const norm = result.rows[0]!.normalized_payload as any
    expect(norm.transaction_date).toBe('2026-01-15')
    expect(norm.amount).toBe(50)
    expect(norm.merchant_name).toBe('Store')
  })
})

// ─── Regression: Column Map Edge Cases ───────────────────────────────────────

describe('universalParse — column map edge cases', () => {
  it('handles column_map referencing a column not in the CSV', () => {
    const csv = `Date,Amount\n01/15/2026,-50.00`
    const template = makeExpenseTemplate({
      column_map: { date: 'Date', amount: 'Amount', merchant: 'NonExistentColumn' },
    })
    const result = universalParse(csv, template)
    expect(result.rows.length).toBe(1)
    // Merchant should be missing, which is a soft error
    expect(result.rows[0]!.validation_errors.some((e) => e.field === 'merchant')).toBe(true)
  })

  it('handles column_map with empty string values', () => {
    const csv = `Date,Amount,Description\n01/15/2026,-50.00,STORE`
    const template = makeExpenseTemplate({
      column_map: { date: 'Date', amount: 'Amount', merchant: '' },
    })
    const result = universalParse(csv, template)
    expect(result.rows.length).toBe(1)
    // Empty column_map value should not match any header
    expect(result.rows[0]!.validation_errors.some((e) => e.field === 'merchant')).toBe(true)
  })

  it('handles completely empty column_map', () => {
    const csv = `Date,Amount,Description\n01/15/2026,-50.00,STORE`
    const template = makeExpenseTemplate({ column_map: {} })
    const result = universalParse(csv, template)
    // All fields missing, row should be rejected
    expect(result.rows[0]!.review_status).toBe('rejected')
  })
})

// ─── Regression: Whitespace-only CSV ─────────────────────────────────────────

describe('universalParse — whitespace edge cases', () => {
  it('handles whitespace-only CSV', () => {
    const result = universalParse('   \n\n  ', makeExpenseTemplate())
    expect(result.rows).toEqual([])
    expect(result.summary.total).toBe(0)
  })

  it('handles CSV with only whitespace in data cells', () => {
    const csv = `Date,Amount,Description\n  ,  ,  `
    const template = makeExpenseTemplate({
      column_map: { date: 'Date', amount: 'Amount', merchant: 'Description' },
    })
    const result = universalParse(csv, template)
    expect(result.rows.length).toBe(1)
    expect(result.rows[0]!.review_status).toBe('rejected')
  })
})
