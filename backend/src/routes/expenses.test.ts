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
}

const sampleExpense = {
  id: 'exp-001',
  workspace_id: TEST_WORKSPACE,
  property_id: 'prop-001',
  transaction_date: '2026-04-15',
  merchant_name: 'Home Depot',
  description: 'Cleaning supplies',
  amount: 45.99,
  category: 'Supplies',
  review_state: 'Business',
  status: 'draft',
}

describe('expenses route contracts', () => {
  it('requires workspace_id when listing expenses', async () => {
    const mock = createMockSupabase([])
    const res = await app.request('/expenses', {}, { ...baseEnv, TEST_SUPABASE: mock.client })

    expect(res.status).toBe(400)
    const json: any = await res.json()
    expect(json.error).toContain('workspace_id')
    expect(mock.tableCalls).toEqual([])
  })

  it('lists expenses with optional filters', async () => {
    const mock = createMockSupabase([{ data: [sampleExpense], error: null }])
    const res = await app.request(
      `/expenses?workspace_id=${TEST_WORKSPACE}&review_state=Business`,
      {},
      { ...baseEnv, TEST_SUPABASE: mock.client }
    )

    expect(res.status).toBe(200)
    const json: any = await res.json()
    expect(json.data).toEqual([sampleExpense])
    expect(mock.tableCalls).toEqual(['expenses'])
    expect(mock.builders[0]?.calls).toEqual([
      { method: 'select', args: ['*'] },
      { method: 'eq', args: ['workspace_id', TEST_WORKSPACE] },
      { method: 'eq', args: ['review_state', 'Business'] },
      { method: 'order', args: ['transaction_date', { ascending: false }] },
    ])
  })

  it('creates an expense and returns 201', async () => {
    const mock = createMockSupabase([{ data: sampleExpense, error: null }])
    const res = await app.request('/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspace_id: TEST_WORKSPACE,
        property_id: 'prop-001',
        transaction_date: '2026-04-15',
        merchant_name: 'Home Depot',
        amount: 45.99,
      }),
    }, { ...baseEnv, TEST_SUPABASE: mock.client })

    expect(res.status).toBe(201)
    const json: any = await res.json()
    expect(json.data).toEqual(sampleExpense)
    expect(mock.builders[0]?.calls[0]?.method).toBe('insert')
  })

  it('gets a single expense by ID', async () => {
    const mock = createMockSupabase([{ data: sampleExpense, error: null }])
    const res = await app.request('/expenses/exp-001', {}, { ...baseEnv, TEST_SUPABASE: mock.client })

    expect(res.status).toBe(200)
    const json: any = await res.json()
    expect(json.data).toEqual(sampleExpense)
  })

  it('returns 404 for non-existent expense', async () => {
    const mock = createMockSupabase([{ data: null, error: { message: 'not found' } }])
    const res = await app.request('/expenses/bad-id', {}, { ...baseEnv, TEST_SUPABASE: mock.client })

    expect(res.status).toBe(404)
  })

  it('updates an expense with PATCH', async () => {
    const updated = { ...sampleExpense, review_state: 'Personal' }
    const mock = createMockSupabase([{ data: updated, error: null }])
    const res = await app.request('/expenses/exp-001', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ review_state: 'Personal' }),
    }, { ...baseEnv, TEST_SUPABASE: mock.client })

    expect(res.status).toBe(200)
    const json: any = await res.json()
    expect(json.data.review_state).toBe('Personal')
  })

  it('commits a draft expense', async () => {
    const mock = createMockSupabase([
      { data: { status: 'draft' }, error: null },  // SELECT existing
      { data: { ...sampleExpense, status: 'committed' }, error: null },  // UPDATE
    ])
    const res = await app.request('/expenses/exp-001/commit', {
      method: 'PATCH',
    }, { ...baseEnv, TEST_SUPABASE: mock.client })

    expect(res.status).toBe(200)
    const json: any = await res.json()
    expect(json.data.status).toBe('committed')
  })

  it('rejects committing a non-draft expense', async () => {
    const mock = createMockSupabase([
      { data: { status: 'committed' }, error: null },
    ])
    const res = await app.request('/expenses/exp-001/commit', {
      method: 'PATCH',
    }, { ...baseEnv, TEST_SUPABASE: mock.client })

    expect(res.status).toBe(422)
    const json: any = await res.json()
    expect(json.error).toContain('Cannot commit')
  })

  it('returns 500 with safe message on DB error during list', async () => {
    const mock = createMockSupabase([{ data: null, error: { message: 'column xyz does not exist' } }])
    const res = await app.request(
      `/expenses?workspace_id=${TEST_WORKSPACE}`,
      {},
      { ...baseEnv, TEST_SUPABASE: mock.client }
    )

    expect(res.status).toBe(500)
  })
})
