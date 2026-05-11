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

const sampleProperty = {
  id: 'prop-001',
  workspace_id: TEST_WORKSPACE,
  name: '360 County Road',
  code: '360CR',
  placed_in_service_date: '2025-12-15',
  ownership_type: 'series_llc',
  market: 'Freestone County',
}

describe('properties route contracts', () => {
  it('requires workspace_id when listing properties', async () => {
    const mock = createMockSupabase([])
    const res = await app.request('/properties', {}, { ...baseEnv, TEST_SUPABASE: mock.client })

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: 'workspace_id is required' })
  })

  it('lists properties for a workspace', async () => {
    const mock = createMockSupabase([{ data: [sampleProperty], error: null }])
    const res = await app.request(
      `/properties?workspace_id=${TEST_WORKSPACE}`,
      {},
      { ...baseEnv, TEST_SUPABASE: mock.client }
    )

    expect(res.status).toBe(200)
    const json: any = await res.json()
    expect(json.data).toEqual([sampleProperty])
    expect(mock.builders[0]?.calls).toEqual([
      { method: 'select', args: ['*'] },
      { method: 'eq', args: ['workspace_id', TEST_WORKSPACE] },
      { method: 'order', args: ['name'] },
    ])
  })

  it('creates a property and returns 201', async () => {
    const mock = createMockSupabase([{ data: sampleProperty, error: null }])
    const res = await app.request('/properties', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspace_id: TEST_WORKSPACE,
        name: '360 County Road',
        code: '360CR',
      }),
    }, { ...baseEnv, TEST_SUPABASE: mock.client })

    expect(res.status).toBe(201)
    const json: any = await res.json()
    expect(json.data).toEqual(sampleProperty)
  })

  it('gets a single property by ID', async () => {
    const mock = createMockSupabase([
      { data: { workspace_id: TEST_WORKSPACE }, error: null },
      { data: sampleProperty, error: null },
    ])
    const res = await app.request('/properties/prop-001', {}, { ...baseEnv, TEST_SUPABASE: mock.client })

    expect(res.status).toBe(200)
    const json: any = await res.json()
    expect(json.data).toEqual(sampleProperty)
  })

  it('forbids a property from another workspace', async () => {
    const mock = createMockSupabase([{ data: { workspace_id: 'other-workspace' }, error: null }])
    const res = await app.request('/properties/prop-001', {}, { ...baseEnv, TEST_SUPABASE: mock.client })

    expect(res.status).toBe(403)
  })

  it('returns 404 for non-existent property', async () => {
    const mock = createMockSupabase([{ data: null, error: { message: 'not found' } }])
    const res = await app.request('/properties/bad-id', {}, { ...baseEnv, TEST_SUPABASE: mock.client })

    expect(res.status).toBe(404)
  })

  it('updates a property with PATCH', async () => {
    const updated = { ...sampleProperty, market: 'Travis County' }
    const mock = createMockSupabase([
      { data: { workspace_id: TEST_WORKSPACE }, error: null },  // workspace lookup
      { data: updated, error: null },  // update
    ])
    const res = await app.request('/properties/prop-001', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ market: 'Travis County' }),
    }, { ...baseEnv, TEST_SUPABASE: mock.client })

    expect(res.status).toBe(200)
    const json: any = await res.json()
    expect(json.data.market).toBe('Travis County')
  })
})
