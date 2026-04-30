import { describe, expect, it, vi } from 'vitest'
import { checkDedup, normalizeAirbnbRow, parseCsvText, type NormalizedBookingRow } from './airbnb-parser'

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
