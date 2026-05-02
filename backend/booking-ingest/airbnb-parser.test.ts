import { describe, expect, it, vi } from 'vitest'
import { checkDedup, filterReservationRows, normalizeAirbnbRow, parseCsvText, type NormalizedBookingRow } from './airbnb-parser'

const validRow = {
  'Confirmation Code': 'HMABC123',
  'Guest Name': 'Jane Guest',
  'Start Date': '03/01/2026',
  'End Date': '03/04/2026',
  Nights: '3',
  'Gross Earnings': '$525.00',
  'Cleaning Fee': '$75.00',
  'Host Service Fee': '($15.25)',
  Taxes: '$42.10',
  Amount: '$509.75',
}

describe('Airbnb CSV parser', () => {
  it('parses quoted CSV fields containing commas', () => {
    const csv = [
      'Confirmation Code,Guest Name,Start Date,End Date,Nights,Gross Earnings,Cleaning Fee,Host Service Fee,Taxes,Amount',
      'HMABC123,"Guest, Jane",03/01/2026,03/04/2026,3,"$525.00","$75.00","($15.25)",$42.10,$509.75',
    ].join('\n')

    expect(parseCsvText(csv)).toEqual([
      {
        'Confirmation Code': 'HMABC123',
        'Guest Name': 'Guest, Jane',
        'Start Date': '03/01/2026',
        'End Date': '03/04/2026',
        Nights: '3',
        'Gross Earnings': '$525.00',
        'Cleaning Fee': '$75.00',
        'Host Service Fee': '($15.25)',
        Taxes: '$42.10',
        Amount: '$509.75',
      },
    ])
  })

  it('normalizes a valid Airbnb row into a pending booking candidate', () => {
    const parsed = normalizeAirbnbRow(validRow)

    expect(parsed.initial_review_status).toBe('pending')
    expect(parsed.validation_errors).toEqual([])
    expect(parsed.dedupe_key_template).toBe('airbnb:HMABC123:{PROPERTY_ID}')
    expect(parsed.normalized).toMatchObject({
      source_platform: 'airbnb',
      source_confirmation_code: 'HMABC123',
      guest_name: 'Jane Guest',
      check_in_date: '2026-03-01',
      check_out_date: '2026-03-04',
      nights: 3,
      gross_revenue_amount: 525,
      cleaning_fee_amount: 75,
      platform_fee_amount: -15.25,
      tax_amount: 42.1,
      net_payout_amount: 509.75,
    })
  })

  it('derives nights and flags mismatched Airbnb nights softly', () => {
    const parsed = normalizeAirbnbRow({ ...validRow, Nights: '2' })

    expect(parsed.initial_review_status).toBe('flagged')
    expect(parsed.normalized.nights).toBe(3)
    expect(parsed.validation_errors).toEqual([
      expect.objectContaining({ field: 'nights', severity: 'soft' }),
    ])
  })

  it('rejects rows with blocking date and payout errors', () => {
    const parsed = normalizeAirbnbRow({
      ...validRow,
      'Start Date': 'bad-date',
      'End Date': '03/01/2026',
      Amount: '$0.00',
    })

    expect(parsed.initial_review_status).toBe('rejected')
    expect(parsed.validation_errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'check_in_date', severity: 'blocking' }),
        expect.objectContaining({ field: 'net_payout_amount', severity: 'blocking' }),
      ])
    )
  })

  it('flags missing confirmation code and builds a fallback dedupe template', () => {
    const parsed = normalizeAirbnbRow({ ...validRow, 'Confirmation Code': '' })

    expect(parsed.initial_review_status).toBe('flagged')
    expect(parsed.dedupe_key_template).toBe('airbnb:nonce-2026-03-01-2026-03-04-Jane Guest:{PROPERTY_ID}')
    expect(parsed.validation_errors).toEqual([
      expect.objectContaining({ field: 'source_confirmation_code', severity: 'soft' }),
    ])
  })

  it('uses a controlled clock for stale/future booking warnings', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-30T12:00:00Z'))

    const oldBooking = normalizeAirbnbRow({ ...validRow, 'Start Date': '01/01/2022', 'End Date': '01/04/2022' })
    const futureBooking = normalizeAirbnbRow({ ...validRow, 'Start Date': '12/01/2026', 'End Date': '12/04/2026' })

    expect(oldBooking.initial_review_status).toBe('flagged')
    expect(oldBooking.validation_errors).toContainEqual(
      expect.objectContaining({ field: 'check_in_date', reason: 'Check-in date is more than 3 years in the past' })
    )
    expect(futureBooking.initial_review_status).toBe('flagged')
    expect(futureBooking.validation_errors).toContainEqual(
      expect.objectContaining({ field: 'check_in_date', reason: 'Check-in date is more than 180 days in the future' })
    )

    vi.useRealTimers()
  })
})

describe('Airbnb booking dedupe', () => {
  const normalized: NormalizedBookingRow = {
    source_platform: 'airbnb',
    source_confirmation_code: 'HMABC123',
    guest_name: 'Jane Guest',
    check_in_date: '2026-03-01',
    check_out_date: '2026-03-04',
    nights: 3,
    gross_revenue_amount: 525,
    cleaning_fee_amount: 75,
    platform_fee_amount: -15.25,
    tax_amount: 42.1,
    net_payout_amount: 509.75,
  }

  const existing = [{
    id: 'booking-1',
    source_platform: 'airbnb',
    source_confirmation_code: 'HMABC123',
    check_in_date: '2026-03-01',
    check_out_date: '2026-03-04',
    guest_name: 'Jane Guest',
    net_payout_amount: 509.75,
    gross_revenue_amount: 525,
  }]

  it('detects exact duplicates by source confirmation code', () => {
    expect(checkDedup(normalized, 'property-1', existing)).toEqual({
      outcome: 'duplicate_exact',
      existing_booking_id: 'booking-1',
    })
  })

  it('detects durable-field conflicts for duplicate confirmation codes', () => {
    expect(checkDedup({ ...normalized, net_payout_amount: 499 }, 'property-1', existing)).toEqual({
      outcome: 'duplicate_conflict',
      existing_booking_id: 'booking-1',
      conflict_fields: ['net_payout_amount'],
    })
  })

  it('falls back to stay-window/guest matching when confirmation code is missing', () => {
    expect(checkDedup({ ...normalized, source_confirmation_code: null }, 'property-1', existing)).toEqual({
      outcome: 'fallback_match',
      candidate_booking_ids: ['booking-1'],
    })
  })

  it('returns new when no duplicate signal exists', () => {
    expect(checkDedup({ ...normalized, source_confirmation_code: 'HMNEW999' }, 'property-1', existing)).toEqual({
      outcome: 'new',
    })
  })
})

// ─── New Format (April 2026+) ─────────────────────────────────────────────────

const newFormatRow = {
  Type: 'Reservation',
  'Confirmation code': 'HMABC456',
  Guest: 'John Doe',
  'Start date': '04/10/2026',
  'End date': '04/13/2026',
  Nights: '3',
  'Gross earnings': '$610.00',
  'Cleaning fee': '$85.00',
  'Service fee': '($18.30)',
  'Airbnb remitted tax': '$48.80',
  Amount: '$591.70',
}

describe('Airbnb CSV parser — new format (April 2026+)', () => {
  it('normalizes new-format column names (case variations + renames)', () => {
    const parsed = normalizeAirbnbRow(newFormatRow)

    expect(parsed.initial_review_status).toBe('pending')
    expect(parsed.validation_errors).toEqual([])
    expect(parsed.normalized).toMatchObject({
      source_platform: 'airbnb',
      source_confirmation_code: 'HMABC456',
      guest_name: 'John Doe',
      check_in_date: '2026-04-10',
      check_out_date: '2026-04-13',
      nights: 3,
      gross_revenue_amount: 610,
      cleaning_fee_amount: 85,
      platform_fee_amount: -18.3,
      tax_amount: 48.8,
      net_payout_amount: 591.7,
    })
  })

  it('parses a new-format CSV with mixed headers', () => {
    const csv = [
      'Type,Confirmation code,Guest,Start date,End date,Nights,Gross earnings,Cleaning fee,Service fee,Airbnb remitted tax,Amount',
      'Reservation,HMABC456,John Doe,04/10/2026,04/13/2026,3,"$610.00","$85.00","($18.30)",$48.80,$591.70',
    ].join('\n')

    const rows = parseCsvText(csv)
    expect(rows).toHaveLength(1)
    expect(rows[0]['Confirmation code']).toBe('HMABC456')

    const parsed = normalizeAirbnbRow(rows[0])
    expect(parsed.initial_review_status).toBe('pending')
    expect(parsed.normalized.source_confirmation_code).toBe('HMABC456')
  })
})

describe('filterReservationRows', () => {
  it('keeps only Reservation rows when Type column is present', () => {
    const rows = [
      { Type: 'Reservation', 'Confirmation code': 'HM001', Amount: '$100' },
      { Type: 'Payout', 'Confirmation code': '', Amount: '$100' },
      { Type: 'Reservation', 'Confirmation code': 'HM002', Amount: '$200' },
    ]
    const filtered = filterReservationRows(rows)
    expect(filtered).toHaveLength(2)
    expect(filtered[0]['Confirmation code']).toBe('HM001')
    expect(filtered[1]['Confirmation code']).toBe('HM002')
  })

  it('keeps all rows when no Type column exists (old format backward compat)', () => {
    const rows = [
      { 'Confirmation Code': 'HM001', Amount: '$100' },
      { 'Confirmation Code': 'HM002', Amount: '$200' },
    ]
    const filtered = filterReservationRows(rows)
    expect(filtered).toHaveLength(2)
  })

  it('handles case-insensitive Type column matching', () => {
    const rows = [
      { type: 'reservation', 'Confirmation code': 'HM001', Amount: '$100' },
      { type: 'payout', 'Confirmation code': '', Amount: '$100' },
    ]
    const filtered = filterReservationRows(rows)
    expect(filtered).toHaveLength(1)
  })

  it('returns empty array for empty input', () => {
    expect(filterReservationRows([])).toEqual([])
  })

  it('filters a full mixed CSV with Payout and Reservation rows', () => {
    const csv = [
      'Type,Confirmation code,Guest,Start date,End date,Nights,Gross earnings,Cleaning fee,Service fee,Airbnb remitted tax,Amount,Paid out',
      'Payout,,,,,,,,,,,$318.74',
      'Reservation,HMXYZ789,Alice Smith,04/15/2026,04/18/2026,3,"$400.00","$50.00","($12.00)",$32.00,$318.74,',
      'Reservation,HMXYZ790,Bob Jones,04/20/2026,04/22/2026,2,"$300.00","$50.00","($9.00)",$24.00,$241.00,',
    ].join('\n')

    const allRows = parseCsvText(csv)
    expect(allRows).toHaveLength(3)

    const filtered = filterReservationRows(allRows)
    expect(filtered).toHaveLength(2)

    // Verify both reservation rows normalize correctly
    const first = normalizeAirbnbRow(filtered[0])
    expect(first.normalized.source_confirmation_code).toBe('HMXYZ789')
    expect(first.normalized.guest_name).toBe('Alice Smith')
    expect(first.initial_review_status).toBe('pending')

    const second = normalizeAirbnbRow(filtered[1])
    expect(second.normalized.source_confirmation_code).toBe('HMXYZ790')
    expect(second.normalized.guest_name).toBe('Bob Jones')
    expect(second.initial_review_status).toBe('pending')
  })
})
