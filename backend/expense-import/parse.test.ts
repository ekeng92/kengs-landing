import { describe, expect, it } from 'vitest'
import { buildDedupeKey, parseAmount, parseBankCsv, parseDate } from './parse'

describe('expense import parsing', () => {
  it('parses supported date formats into ISO dates', () => {
    expect(parseDate('2026-03-01')).toBe('2026-03-01')
    expect(parseDate('3/1/2026')).toBe('2026-03-01')
    expect(parseDate('03/01/26')).toBe('2026-03-01')
    expect(parseDate('not a date')).toBeNull()
  })

  it('parses currency amounts without losing sign information', () => {
    expect(parseAmount('$1,234.56')).toBe(1234.56)
    expect(parseAmount(' -42.10 ')).toBe(-42.1)
    expect(parseAmount('')).toBeNull()
    expect(parseAmount('abc')).toBeNull()
  })

  it('builds stable dedupe keys from normalized merchant and amount', () => {
    expect(buildDedupeKey('2026-03-01', 12.3, '  Home   Depot  ', ' abc ')).toBe(
      '2026-03-01|12.30|home depot|abc'
    )
  })

  it('parses a deterministic bank CSV row into an approved expense candidate', () => {
    const csv = [
      'Date,Description,Amount,Reference',
      '03/01/2026,Home Depot,$125.45,abc123',
    ].join('\n')

    const rows = parseBankCsv(csv, [], new Set())

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      row_index: 1,
      review_status: 'approved',
      dedupe_key: '2026-03-01|125.45|home depot|abc123',
      confidence_score: 0.9,
      validation_errors: null,
    })
    expect(rows[0].normalized_payload).toMatchObject({
      transaction_date: '2026-03-01',
      amount: 125.45,
      merchant_name: 'Home Depot',
      candidate_category: 'Repairs & maintenance',
      candidate_review_state: 'Business',
    })
  })

  it('flags malformed or non-expense rows without throwing', () => {
    const csv = [
      'Date,Description,Amount',
      'bad-date,,not-money',
      '03/02/2026,Refund,-10.00',
    ].join('\n')

    const rows = parseBankCsv(csv, [], new Set())

    expect(rows).toHaveLength(2)
    expect(rows[0].review_status).toBe('flagged')
    expect(rows[0].normalized_payload).toBeNull()
    expect(rows[0].validation_errors).toEqual(
      expect.arrayContaining([
        'Unparseable date: "bad-date"',
        'Unparseable amount: "not-money"',
        'Missing merchant name',
      ])
    )
    expect(rows[1].review_status).toBe('flagged')
    expect(rows[1].normalized_payload).toBeNull()
    expect(rows[1].validation_errors).toEqual(
      expect.arrayContaining(['Non-positive amount (-10): treated as refund/credit, not an expense'])
    )
  })
})
