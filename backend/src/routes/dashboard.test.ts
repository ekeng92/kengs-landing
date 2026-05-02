import { describe, expect, it } from 'vitest'
import { app } from '../index'
import { createMockSupabase } from '../../test/mock-supabase'

const TEST_WORKSPACE = 'b0604861-b7ae-4f1e-a7cb-fe066d57c623'
const TEST_USER = '63687e6d-c20b-4ea2-9324-64987410e687'
const TEST_PROPERTY = 'prop-001'

const baseEnv = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
  DEV_BYPASS_AUTH: 'true',
  DEV_USER_ID: TEST_USER,
}

const sampleBookings = [
  {
    id: 'b1', gross_revenue_amount: 500, net_payout_amount: 420,
    platform_fee_amount: 80, nights: 3, status: 'committed',
  },
  {
    id: 'b2', gross_revenue_amount: 300, net_payout_amount: 250,
    platform_fee_amount: 50, nights: 2, status: 'committed',
  },
]

const sampleExpenses = [
  { id: 'e1', amount: 100, review_state: 'Business', tax_period: 'Operational' },
  { id: 'e2', amount: 50, review_state: 'Business', tax_period: 'Pre-Service' },
]

const sampleMileage = [
  { id: 'm1', miles: 25 },
  { id: 'm2', miles: 40 },
]

describe('dashboard route contracts', () => {
  it('requires all four query params for metrics', async () => {
    const mock = createMockSupabase([])
    const res = await app.request(
      `/dashboard/metrics?workspace_id=${TEST_WORKSPACE}`,
      {},
      { ...baseEnv, TEST_SUPABASE: mock.client }
    )

    expect(res.status).toBe(400)
    const json: any = await res.json()
    expect(json.error).toContain('property_id')
  })

  it('computes metrics correctly from bookings, expenses, and mileage', async () => {
    const mock = createMockSupabase([
      { data: sampleBookings, error: null },   // bookings
      { data: sampleExpenses, error: null },    // expenses
      { data: sampleMileage, error: null },     // mileage
    ])
    const res = await app.request(
      `/dashboard/metrics?workspace_id=${TEST_WORKSPACE}&property_id=${TEST_PROPERTY}&date_from=2026-01-01&date_to=2026-12-31`,
      {},
      { ...baseEnv, TEST_SUPABASE: mock.client }
    )

    expect(res.status).toBe(200)
    const json: any = await res.json()

    // Revenue: 500 + 300 = 800
    expect(json.gross_booking_revenue).toBe(800)
    // Net payout: 420 + 250 = 670
    expect(json.net_payout_revenue).toBe(670)
    // Platform fees: 80 + 50 = 130
    expect(json.platform_fees).toBe(130)
    // Business operating expenses: only Operational tax_period = 100
    expect(json.business_operating_expenses).toBe(100)
    // Pre-service: 50
    expect(json.pre_service_expenses).toBe(50)
    // Net operating result: 670 - 100 = 570
    expect(json.net_operating_result).toBe(570)
    // Nights booked: 3 + 2 = 5
    expect(json.nights_booked).toBe(5)
    // Mileage: 25 + 40 = 65
    expect(json.mileage_total).toBe(65)
    // Occupancy rate: a number between 0 and 100
    expect(json.occupancy_rate).toBeGreaterThanOrEqual(0)
    expect(json.occupancy_rate).toBeLessThanOrEqual(100)
  })

  it('returns zeros when no data exists', async () => {
    const mock = createMockSupabase([
      { data: [], error: null },   // bookings
      { data: [], error: null },   // expenses
      { data: [], error: null },   // mileage
    ])
    const res = await app.request(
      `/dashboard/metrics?workspace_id=${TEST_WORKSPACE}&property_id=${TEST_PROPERTY}&date_from=2026-01-01&date_to=2026-12-31`,
      {},
      { ...baseEnv, TEST_SUPABASE: mock.client }
    )

    expect(res.status).toBe(200)
    const json: any = await res.json()
    expect(json.gross_booking_revenue).toBe(0)
    expect(json.net_payout_revenue).toBe(0)
    expect(json.business_operating_expenses).toBe(0)
    expect(json.nights_booked).toBe(0)
    expect(json.mileage_total).toBe(0)
  })

  it('returns 500 when bookings query fails', async () => {
    const mock = createMockSupabase([
      { data: null, error: { message: 'DB error' } },
    ])
    const res = await app.request(
      `/dashboard/metrics?workspace_id=${TEST_WORKSPACE}&property_id=${TEST_PROPERTY}&date_from=2026-01-01&date_to=2026-12-31`,
      {},
      { ...baseEnv, TEST_SUPABASE: mock.client }
    )

    expect(res.status).toBe(500)
  })

  it('requires all four params for expense export', async () => {
    const mock = createMockSupabase([])
    const res = await app.request(
      `/dashboard/export/expenses?workspace_id=${TEST_WORKSPACE}`,
      {},
      { ...baseEnv, TEST_SUPABASE: mock.client }
    )

    expect(res.status).toBe(400)
  })

  it('exports expenses as CSV with correct headers', async () => {
    const mock = createMockSupabase([{
      data: [{
        transaction_date: '2026-04-15', merchant_name: 'Home Depot',
        description: 'Supplies', category: 'Maintenance', amount: 45.99,
        payment_method: 'card', review_state: 'Business', tax_period: 'Operational',
        documentation_status: 'documented', property_code: '360CR',
      }],
      error: null,
    }])
    const res = await app.request(
      `/dashboard/export/expenses?workspace_id=${TEST_WORKSPACE}&property_id=${TEST_PROPERTY}&date_from=2026-01-01&date_to=2026-12-31`,
      {},
      { ...baseEnv, TEST_SUPABASE: mock.client }
    )

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('text/csv')
    const body = await res.text()
    expect(body).toContain('transaction_date,merchant_name')
    expect(body).toContain('Home Depot')
  })

  it('requires all four params for booking export', async () => {
    const mock = createMockSupabase([])
    const res = await app.request(
      `/dashboard/export/bookings?workspace_id=${TEST_WORKSPACE}`,
      {},
      { ...baseEnv, TEST_SUPABASE: mock.client }
    )

    expect(res.status).toBe(400)
  })
})
