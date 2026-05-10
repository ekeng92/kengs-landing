import { describe, expect, it } from 'vitest'
import { app } from '../index'
import { createMockSupabase } from '../../test/mock-supabase'

const TEST_WORKSPACE = 'b0604861-b7ae-4f1e-a7cb-fe066d57c623'
const TEST_USER = '63687e6d-c20b-4ea2-9324-64987410e687'

const baseEnv = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
  DEV_BYPASS_AUTH: 'true',
  DEV_USER_ID: TEST_USER,
  DEV_WORKSPACE_ID: TEST_WORKSPACE,
}

const sampleBooking = {
  id: 'book-001',
  workspace_id: TEST_WORKSPACE,
  property_id: 'prop-001',
  source_platform: 'airbnb',
  source_confirmation_code: 'HM123ABC',
  guest_name: 'Jane Doe',
  check_in_date: '2026-05-10',
  check_out_date: '2026-05-13',
  nights: 3,
  gross_revenue_amount: 450,
  net_payout_amount: 380,
  platform_fee_amount: 70,
  status: 'committed',
}

describe('bookings route contracts', () => {
  it('requires workspace_id when listing bookings', async () => {
    const mock = createMockSupabase([])
    const res = await app.request('/bookings', {}, { ...baseEnv, TEST_SUPABASE: mock.client })

    expect(res.status).toBe(400)
    const json: any = await res.json()
    expect(json.error).toContain('workspace_id')
  })

  it('lists bookings with optional filters', async () => {
    const mock = createMockSupabase([{ data: [sampleBooking], error: null }])
    const res = await app.request(
      `/bookings?workspace_id=${TEST_WORKSPACE}&status=committed`,
      {},
      { ...baseEnv, TEST_SUPABASE: mock.client }
    )

    expect(res.status).toBe(200)
    const json: any = await res.json()
    expect(json.data).toEqual([sampleBooking])
    expect(mock.builders[0]?.calls).toContainEqual(
      { method: 'eq', args: ['status', 'committed'] }
    )
  })

  it('gets a single booking by ID', async () => {
    const mock = createMockSupabase([
      { data: { workspace_id: TEST_WORKSPACE }, error: null },
      { data: sampleBooking, error: null },
    ])
    const res = await app.request('/bookings/book-001', {}, { ...baseEnv, TEST_SUPABASE: mock.client })

    expect(res.status).toBe(200)
    const json: any = await res.json()
    expect(json.data).toEqual(sampleBooking)
  })

  it('forbids a booking from another workspace', async () => {
    const mock = createMockSupabase([{ data: { workspace_id: 'other-workspace' }, error: null }])
    const res = await app.request('/bookings/book-001', {}, { ...baseEnv, TEST_SUPABASE: mock.client })

    expect(res.status).toBe(403)
  })

  it('returns 404 for non-existent booking', async () => {
    const mock = createMockSupabase([{ data: null, error: { message: 'not found' } }])
    const res = await app.request('/bookings/bad-id', {}, { ...baseEnv, TEST_SUPABASE: mock.client })

    expect(res.status).toBe(404)
  })

  it('creates a manual booking with required fields', async () => {
    const mock = createMockSupabase([
      { data: { id: 'prop-001', workspace_id: TEST_WORKSPACE }, error: null },  // property check
      { data: sampleBooking, error: null },  // insert
      { data: null, error: null },  // audit event
    ])
    const res = await app.request('/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspace_id: TEST_WORKSPACE,
        property_id: 'prop-001',
        check_in_date: '2026-05-10',
        check_out_date: '2026-05-13',
        net_payout_amount: 380,
        guest_name: 'Jane Doe',
      }),
    }, { ...baseEnv, TEST_SUPABASE: mock.client })

    expect(res.status).toBe(201)
    const json: any = await res.json()
    expect(json.data).toEqual(sampleBooking)
  })

  it('rejects booking creation missing required fields', async () => {
    const mock = createMockSupabase([])
    const res = await app.request('/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspace_id: TEST_WORKSPACE }),
    }, { ...baseEnv, TEST_SUPABASE: mock.client })

    expect(res.status).toBe(400)
  })

  it('rejects booking where check_out_date is before check_in_date', async () => {
    const mock = createMockSupabase([])
    const res = await app.request('/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspace_id: TEST_WORKSPACE,
        property_id: 'prop-001',
        check_in_date: '2026-05-13',
        check_out_date: '2026-05-10',
        net_payout_amount: 380,
      }),
    }, { ...baseEnv, TEST_SUPABASE: mock.client })

    expect(res.status).toBe(422)
    const json: any = await res.json()
    expect(json.error).toContain('check_out_date must be after')
  })

  it('commits a draft booking', async () => {
    const draft = { ...sampleBooking, status: 'draft' }
    const committed = { ...sampleBooking, status: 'committed' }
    const mock = createMockSupabase([
      { data: draft, error: null },       // SELECT existing
      { data: committed, error: null },    // UPDATE
      { data: null, error: null },         // audit event
    ])
    const res = await app.request('/bookings/book-001/commit', {
      method: 'PATCH',
    }, { ...baseEnv, TEST_SUPABASE: mock.client })

    expect(res.status).toBe(200)
    const json: any = await res.json()
    expect(json.data.status).toBe('committed')
  })

  it('rejects committing a non-draft booking', async () => {
    const mock = createMockSupabase([
      { data: { ...sampleBooking, status: 'committed' }, error: null },
    ])
    const res = await app.request('/bookings/book-001/commit', {
      method: 'PATCH',
    }, { ...baseEnv, TEST_SUPABASE: mock.client })

    expect(res.status).toBe(422)
    const json: any = await res.json()
    expect(json.error).toContain('Cannot commit')
  })

  it('returns 409 on duplicate confirmation code during commit', async () => {
    const mock = createMockSupabase([
      { data: { ...sampleBooking, status: 'draft' }, error: null },
      { data: null, error: { message: 'unique violation', code: '23505' } },
    ])
    const res = await app.request('/bookings/book-001/commit', {
      method: 'PATCH',
    }, { ...baseEnv, TEST_SUPABASE: mock.client })

    expect(res.status).toBe(409)
    const json: any = await res.json()
    expect(json.error).toContain('Duplicate booking')
  })

  it('voids a committed booking', async () => {
    const voided = { ...sampleBooking, status: 'voided' }
    const mock = createMockSupabase([
      { data: sampleBooking, error: null },    // SELECT existing
      { data: voided, error: null },           // UPDATE
      { data: null, error: null },             // audit event
    ])
    const res = await app.request('/bookings/book-001/void', {
      method: 'PATCH',
    }, { ...baseEnv, TEST_SUPABASE: mock.client })

    expect(res.status).toBe(200)
    const json: any = await res.json()
    expect(json.data.status).toBe('voided')
  })

  it('rejects voiding an already voided booking', async () => {
    const mock = createMockSupabase([
      { data: { ...sampleBooking, status: 'voided' }, error: null },
    ])
    const res = await app.request('/bookings/book-001/void', {
      method: 'PATCH',
    }, { ...baseEnv, TEST_SUPABASE: mock.client })

    expect(res.status).toBe(422)
    const json: any = await res.json()
    expect(json.error).toContain('Already voided')
  })
})
