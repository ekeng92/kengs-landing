import { describe, expect, it } from 'vitest'
import { app } from '../index'
import { createMockSupabase } from '../../test/mock-supabase'

const baseEnv = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
  DEV_BYPASS_AUTH: 'true',
  DEV_USER_ID: 'user-1',
  DEV_WORKSPACE_ID: 'workspace-1',
}

const sampleTrip = {
  id: 'trip-1',
  workspace_id: 'workspace-1',
  property_id: 'property-1',
  trip_date: '2026-04-15',
  origin: 'Dallas, TX',
  destination: '360 County Road',
  miles: 120,
  purpose: 'Property inspection and guest turnover',
  deduction_rate: 0.70,
  deduction_amount: 84.00,
  created_at: '2026-04-15T10:00:00Z',
  updated_at: '2026-04-15T10:00:00Z',
}

describe('mileage route contracts', () => {
  it('requires workspace_id when listing mileage trips', async () => {
    const mock = createMockSupabase([])
    const res = await app.request('/mileage', {}, { ...baseEnv, TEST_SUPABASE: mock.client })

    expect(res.status).toBe(400)
    const json: any = await res.json()
    expect(json.error).toContain('workspace_id')
    expect(mock.tableCalls).toEqual([])
  })

  it('lists mileage trips filtered by workspace and property', async () => {
    const mock = createMockSupabase([{ data: [sampleTrip], error: null }])
    const res = await app.request(
      '/mileage?workspace_id=workspace-1&property_id=property-1',
      {},
      { ...baseEnv, TEST_SUPABASE: mock.client }
    )

    expect(res.status).toBe(200)
    const json: any = await res.json()
    expect(json.data).toEqual([sampleTrip])
    expect(json.limit).toBe(100)
    expect(json.offset).toBe(0)
    expect(mock.tableCalls).toEqual(['mileage_trips'])
    expect(mock.builders[0]?.calls).toEqual([
      { method: 'select', args: ['*', { count: 'exact' }] },
      { method: 'eq', args: ['workspace_id', 'workspace-1'] },
      { method: 'eq', args: ['property_id', 'property-1'] },
      { method: 'order', args: ['trip_date', { ascending: false }] },
      { method: 'range', args: [0, 99] },
    ])
  })

  it('gets a single mileage trip by id', async () => {
    const mock = createMockSupabase([
      { data: { workspace_id: 'workspace-1' }, error: null },
      { data: sampleTrip, error: null },
    ])
    const res = await app.request('/mileage/trip-1', {}, { ...baseEnv, TEST_SUPABASE: mock.client })

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ data: sampleTrip })
    expect(mock.tableCalls).toEqual(['mileage_trips', 'mileage_trips'])
  })

  it('forbids a mileage trip from another workspace', async () => {
    const mock = createMockSupabase([{ data: { workspace_id: 'other-workspace' }, error: null }])
    const res = await app.request('/mileage/trip-1', {}, { ...baseEnv, TEST_SUPABASE: mock.client })

    expect(res.status).toBe(403)
  })

  it('creates a mileage trip with auto-calculated deduction', async () => {
    // First call: property lookup. Second call: insert.
    const mock = createMockSupabase([
      { data: { id: 'property-1', workspace_id: 'workspace-1' }, error: null },
      { data: sampleTrip, error: null },
    ])
    const res = await app.request('/mileage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspace_id: 'workspace-1',
        property_id: 'property-1',
        trip_date: '2026-04-15',
        miles: 120,
        origin: 'Dallas, TX',
        destination: '360 County Road',
        purpose: 'Property inspection and guest turnover',
      }),
    }, { ...baseEnv, TEST_SUPABASE: mock.client })

    expect(res.status).toBe(201)
    await expect(res.json()).resolves.toEqual({ data: sampleTrip })
    // Property lookup
    expect(mock.tableCalls[0]).toBe('properties')
    // Insert
    expect(mock.tableCalls[1]).toBe('mileage_trips')
    expect(mock.builders[1]?.calls[0]).toEqual({
      method: 'insert',
      args: [expect.objectContaining({
        workspace_id: 'workspace-1',
        property_id: 'property-1',
        trip_date: '2026-04-15',
        miles: 120,
        deduction_rate: 0.70,
        deduction_amount: 84.00,
      })],
    })
  })

  it('rejects creation with missing required fields', async () => {
    const mock = createMockSupabase([])
    const res = await app.request('/mileage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspace_id: 'workspace-1' }),
    }, { ...baseEnv, TEST_SUPABASE: mock.client })

    expect(res.status).toBe(400)
    expect(mock.tableCalls).toEqual([])
  })

  it('rejects creation when property not in workspace', async () => {
    const mock = createMockSupabase([
      { data: null, error: { message: 'not found' } },
    ])
    const res = await app.request('/mileage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspace_id: 'workspace-1',
        property_id: 'bad-property',
        trip_date: '2026-04-15',
        miles: 50,
      }),
    }, { ...baseEnv, TEST_SUPABASE: mock.client })

    expect(res.status).toBe(422)
    await expect(res.json()).resolves.toEqual({ error: 'Property not found in this workspace' })
  })

  it('updates a mileage trip and recalculates deduction', async () => {
    const existing = { ...sampleTrip }
    const updated = { ...sampleTrip, miles: 200, deduction_amount: 140.00 }
    const mock = createMockSupabase([
      { data: existing, error: null },
      { data: updated, error: null },
    ])
    const res = await app.request('/mileage/trip-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ miles: 200 }),
    }, { ...baseEnv, TEST_SUPABASE: mock.client })

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ data: updated })
    // First call: fetch existing
    expect(mock.tableCalls[0]).toBe('mileage_trips')
    // Second call: update
    expect(mock.tableCalls[1]).toBe('mileage_trips')
    expect(mock.builders[1]?.calls[0]).toEqual({
      method: 'update',
      args: [expect.objectContaining({
        miles: 200,
        deduction_amount: 140.00,
      })],
    })
  })

  it('deletes a mileage trip', async () => {
    const mock = createMockSupabase([
      { data: { workspace_id: 'workspace-1' }, error: null },  // workspace lookup
      { error: null },  // delete
    ])
    const res = await app.request('/mileage/trip-1', {
      method: 'DELETE',
    }, { ...baseEnv, TEST_SUPABASE: mock.client })

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ success: true })
    expect(mock.tableCalls).toEqual(['mileage_trips', 'mileage_trips'])
  })
})
