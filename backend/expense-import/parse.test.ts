import { describe, expect, it } from 'vitest'
import { buildDedupeKey, parseAmount, parseBankCsv, parseDate } from './parse'

describe('expense import parsing primitives', () => {
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
})

describe('expense import CSV parsing', () => {
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

  it('supports Chase-style transaction date and debit columns', () => {
    const csv = [
      'Transaction Date,Description,Debit,Ref #',
      '3/2/2026,ATMOS ENERGY,$88.12,CHASE-1',
    ].join('\n')

    const [row] = parseBankCsv(csv, [], new Set())

    expect(row).toMatchObject({
      review_status: 'approved',
      dedupe_key: '2026-03-02|88.12|atmos energy|CHASE-1',
    })
    expect(row?.normalized_payload).toMatchObject({
      transaction_date: '2026-03-02',
      merchant_name: 'Atmos Energy',
      candidate_category: 'Utilities',
      candidate_review_state: 'Business',
    })
  })

  it('supports Robinhood/card-style merchant and charge amount columns', () => {
    const csv = [
      'Posted Date,Merchant Name,Charge Amount,Transaction Category,Transaction ID',
      '2026-03-03,Walmart Supply,$44.50,Retail,RH-1',
    ].join('\n')

    const [row] = parseBankCsv(csv, [], new Set())

    expect(row).toMatchObject({
      review_status: 'approved',
      dedupe_key: '2026-03-03|44.50|walmart supply|RH-1',
    })
    expect(row?.normalized_payload).toMatchObject({
      merchant_name: 'Walmart Supply',
      candidate_category: 'Supplies',
    })
  })

  it('falls back to source category mapping when merchant keywords are ambiguous', () => {
    const csv = [
      'Date,Description,Amount,Category',
      '03/04/2026,Generic Online Store,$25.00,Internet Purchase',
    ].join('\n')

    const [row] = parseBankCsv(csv, [], new Set())

    expect(row?.review_status).toBe('approved')
    expect(row?.normalized_payload).toMatchObject({
      candidate_category: 'Supplies',
      candidate_review_state: 'Business',
    })
  })

  it('flags unknown categories for human review instead of guessing', () => {
    const csv = [
      'Date,Description,Amount',
      '03/05/2026,Unclear Merchant,$12.00',
    ].join('\n')

    const [row] = parseBankCsv(csv, [], new Set())

    expect(row?.review_status).toBe('flagged')
    expect(row?.confidence_score).toBe(0.7)
    expect(row?.normalized_payload).toMatchObject({
      candidate_category: null,
      candidate_review_state: 'Review',
    })
  })

  it('flags duplicate rows using existing dedupe keys', () => {
    const csv = [
      'Date,Description,Amount,Reference',
      '03/01/2026,Home Depot,$125.45,abc123',
    ].join('\n')

    const rows = parseBankCsv(csv, [], new Set(['2026-03-01|125.45|home depot|abc123']))

    expect(rows[0]).toMatchObject({
      review_status: 'flagged',
      validation_errors: ['Possible duplicate — a matching transaction was already imported'],
    })
    expect(rows[0].normalized_payload?.confidence_explanation).toContain('Possible duplicate')
  })

  it('handles quoted commas and multiline quoted cells', () => {
    const csv = [
      'Date,Description,Amount,Memo',
      '03/06/2026,"Home Depot, Fairfield",$10.00,"Line one',
      'line two"',
    ].join('\n')

    const [row] = parseBankCsv(csv, [], new Set())

    expect(row?.normalized_payload).toMatchObject({
      merchant_name: 'Home Depot, Fairfield',
      description: 'Line one\nline two',
      candidate_category: 'Repairs & maintenance',
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
