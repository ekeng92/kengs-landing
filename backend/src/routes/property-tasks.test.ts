import { describe, it, expect } from 'vitest'
import { app } from '../index'
import { createMockSupabase } from '../../test/mock-supabase'

function makeEnv(supabase: unknown) {
  return {
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-key',
    DEV_BYPASS_AUTH: 'true',
    DEV_USER_ID: 'user-1',
    DEV_WORKSPACE_ID: 'ws-1',
    TEST_SUPABASE: supabase,
  }
}

const sampleTask = {
  id: 'pt-1',
  workspace_id: 'ws-1',
  property_id: 'prop-1',
  title: 'Replace air filters',
  description: 'Change HVAC filters in all units',
  status: 'pending',
  priority: 'medium',
  due_date: '2026-06-01',
  auto_expire: false,
  notes: null,
  created_by: 'user-1',
  created_at: '2026-05-08T12:00:00Z',
  updated_at: '2026-05-08T12:00:00Z',
}

// ─── GET /property-tasks/ — List ──────────────────────────────────────────────

describe('GET /property-tasks/', () => {
  it('returns list with total count', async () => {
    const mock = createMockSupabase([
      // Auto-expire update
      { data: null, error: null },
      // List query
      { data: [sampleTask], error: null, count: 1 },
    ])

    const res = await app.request('/property-tasks?workspace_id=ws-1', {}, makeEnv(mock.client))
    expect(res.status).toBe(200)
    const body: any = await res.json()
    expect(body.data).toEqual([sampleTask])
    expect(body.total).toBe(1)
    expect(body.limit).toBe(100)
    expect(body.offset).toBe(0)
  })

  it('returns 400 when workspace_id is missing', async () => {
    const mock = createMockSupabase([])

    const res = await app.request('/property-tasks', {}, makeEnv(mock.client))
    expect(res.status).toBe(400)
    const body: any = await res.json()
    expect(body.error).toContain('workspace_id')
  })

  it('applies property_id, status, and priority filters', async () => {
    const mock = createMockSupabase([
      // Auto-expire update
      { data: null, error: null },
      // List query
      { data: [sampleTask], error: null, count: 1 },
    ])

    const res = await app.request(
      '/property-tasks?workspace_id=ws-1&property_id=prop-1&status=pending&priority=high',
      {},
      makeEnv(mock.client),
    )
    expect(res.status).toBe(200)

    // Verify filter calls on the list query builder (index 1, after auto-expire)
    const listBuilder = mock.builders[1]
    expect(listBuilder?.calls).toEqual(
      expect.arrayContaining([
        { method: 'eq', args: ['property_id', 'prop-1'] },
        { method: 'eq', args: ['status', 'pending'] },
        { method: 'eq', args: ['priority', 'high'] },
      ]),
    )
  })

  it('fires auto-expire update before listing', async () => {
    const mock = createMockSupabase([
      // Auto-expire update
      { data: null, error: null },
      // List query
      { data: [], error: null, count: 0 },
    ])

    const res = await app.request('/property-tasks?workspace_id=ws-1', {}, makeEnv(mock.client))
    expect(res.status).toBe(200)

    // First call is property_tasks (auto-expire), second is property_tasks (list)
    expect(mock.tableCalls).toEqual(['property_tasks', 'property_tasks'])

    // Auto-expire builder should have update + status/auto_expire/due_date filters
    const expireBuilder = mock.builders[0]
    expect(expireBuilder?.calls).toEqual(
      expect.arrayContaining([
        { method: 'update', args: [expect.objectContaining({ status: 'expired' })] },
        { method: 'eq', args: ['workspace_id', 'ws-1'] },
        { method: 'eq', args: ['status', 'pending'] },
        { method: 'eq', args: ['auto_expire', true] },
      ]),
    )
  })

  it('returns 500 on DB error', async () => {
    const mock = createMockSupabase([
      // Auto-expire
      { data: null, error: null },
      // List query fails
      { data: null, error: { message: 'connection failed', code: 'XX000' } },
    ])

    const res = await app.request('/property-tasks?workspace_id=ws-1', {}, makeEnv(mock.client))
    expect(res.status).toBe(500)
    const body: any = await res.json()
    expect(body.error).toBe('Internal server error')
  })
})

// ─── POST /property-tasks/ — Create ──────────────────────────────────────────

describe('POST /property-tasks/', () => {
  it('creates and returns 201', async () => {
    const mock = createMockSupabase([
      // Property lookup
      { data: { id: 'prop-1' }, error: null },
      // Insert
      { data: sampleTask, error: null },
    ])

    const res = await app.request('/property-tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspace_id: 'ws-1',
        property_id: 'prop-1',
        title: 'Replace air filters',
        description: 'Change HVAC filters in all units',
      }),
    }, makeEnv(mock.client))

    expect(res.status).toBe(201)
    const body: any = await res.json()
    expect(body.data).toEqual(sampleTask)

    // Verify insert included created_by
    expect(mock.builders[1]?.calls[0]).toEqual({
      method: 'insert',
      args: [expect.objectContaining({
        workspace_id: 'ws-1',
        property_id: 'prop-1',
        title: 'Replace air filters',
        created_by: 'user-1',
      })],
    })
  })

  it('returns 400 when required fields are missing', async () => {
    const mock = createMockSupabase([])

    const res = await app.request('/property-tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspace_id: 'ws-1' }),
    }, makeEnv(mock.client))

    expect(res.status).toBe(400)
    const body: any = await res.json()
    expect(body.error).toContain('property_id')
  })

  it('returns 422 when property not in workspace', async () => {
    const mock = createMockSupabase([
      // Property lookup returns nothing
      { data: null, error: { message: 'not found', code: 'PGRST116' } },
    ])

    const res = await app.request('/property-tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspace_id: 'ws-1',
        property_id: 'prop-wrong',
        title: 'Some task',
      }),
    }, makeEnv(mock.client))

    expect(res.status).toBe(422)
    const body: any = await res.json()
    expect(body.error).toContain('Property not found')
  })

  it('returns 400 for invalid status value', async () => {
    const mock = createMockSupabase([])

    const res = await app.request('/property-tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspace_id: 'ws-1',
        property_id: 'prop-1',
        title: 'Some task',
        status: 'invalid_status',
      }),
    }, makeEnv(mock.client))

    expect(res.status).toBe(400)
    const body: any = await res.json()
    expect(body.error).toContain('status')
  })

  it('returns 400 for invalid JSON body', async () => {
    const mock = createMockSupabase([])

    const res = await app.request('/property-tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    }, makeEnv(mock.client))

    expect(res.status).toBe(400)
    const body: any = await res.json()
    expect(body.error).toBe('Invalid JSON')
  })

  it('returns 500 on DB insert error', async () => {
    const mock = createMockSupabase([
      // Property lookup
      { data: { id: 'prop-1' }, error: null },
      // Insert fails
      { data: null, error: { message: 'insert failed', code: 'XX000' } },
    ])

    const res = await app.request('/property-tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspace_id: 'ws-1',
        property_id: 'prop-1',
        title: 'Some task',
      }),
    }, makeEnv(mock.client))

    expect(res.status).toBe(500)
    const body: any = await res.json()
    expect(body.error).toBe('Internal server error')
  })
})

// ─── GET /property-tasks/:id — Get single ─────────────────────────────────────

describe('GET /property-tasks/:id', () => {
  it('returns a single task', async () => {
    const mock = createMockSupabase([
      { data: sampleTask, error: null },
    ])

    const res = await app.request('/property-tasks/pt-1', {}, makeEnv(mock.client))
    expect(res.status).toBe(200)
    const body: any = await res.json()
    expect(body.data).toEqual(sampleTask)
  })

  it('returns 404 when not found', async () => {
    const mock = createMockSupabase([
      { data: null, error: { message: 'not found', code: 'PGRST116' } },
    ])

    const res = await app.request('/property-tasks/nonexistent', {}, makeEnv(mock.client))
    expect(res.status).toBe(404)
    const body: any = await res.json()
    expect(body.error).toBe('Not found')
  })
})

// ─── PATCH /property-tasks/:id — Update ───────────────────────────────────────

describe('PATCH /property-tasks/:id', () => {
  it('updates a task', async () => {
    const updated = { ...sampleTask, title: 'Replace HVAC filters' }
    const mock = createMockSupabase([
      // Fetch existing
      { data: { workspace_id: 'ws-1' }, error: null },
      // Update
      { data: updated, error: null },
    ])

    const res = await app.request('/property-tasks/pt-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Replace HVAC filters' }),
    }, makeEnv(mock.client))

    expect(res.status).toBe(200)
    const body: any = await res.json()
    expect(body.data).toEqual(updated)
  })

  it('returns 400 for empty body', async () => {
    const mock = createMockSupabase([])

    const res = await app.request('/property-tasks/pt-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }, makeEnv(mock.client))

    expect(res.status).toBe(400)
    const body: any = await res.json()
    expect(body.error).toContain('At least one field')
  })

  it('returns 404 when task not found', async () => {
    const mock = createMockSupabase([
      // Fetch existing — not found
      { data: null, error: { message: 'not found', code: 'PGRST116' } },
    ])

    const res = await app.request('/property-tasks/nonexistent', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Updated' }),
    }, makeEnv(mock.client))

    expect(res.status).toBe(404)
    const body: any = await res.json()
    expect(body.error).toBe('Not found')
  })

  it('returns 400 for invalid JSON body', async () => {
    const mock = createMockSupabase([])

    const res = await app.request('/property-tasks/pt-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    }, makeEnv(mock.client))

    expect(res.status).toBe(400)
    const body: any = await res.json()
    expect(body.error).toBe('Invalid JSON')
  })

  it('returns 500 on DB update error', async () => {
    const mock = createMockSupabase([
      // Fetch existing
      { data: { workspace_id: 'ws-1' }, error: null },
      // Update fails
      { data: null, error: { message: 'update failed', code: 'XX000' } },
    ])

    const res = await app.request('/property-tasks/pt-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Updated' }),
    }, makeEnv(mock.client))

    expect(res.status).toBe(500)
    const body: any = await res.json()
    expect(body.error).toBe('Internal server error')
  })
})

// ─── DELETE /property-tasks/:id — Delete ──────────────────────────────────────

describe('DELETE /property-tasks/:id', () => {
  it('deletes and returns success', async () => {
    const mock = createMockSupabase([
      // Fetch existing
      { data: { workspace_id: 'ws-1' }, error: null },
      // Delete
      { data: null, error: null },
    ])

    const res = await app.request('/property-tasks/pt-1', {
      method: 'DELETE',
    }, makeEnv(mock.client))

    expect(res.status).toBe(200)
    const body: any = await res.json()
    expect(body.success).toBe(true)
  })

  it('returns 404 when task not found', async () => {
    const mock = createMockSupabase([
      // Fetch existing — not found
      { data: null, error: { message: 'not found', code: 'PGRST116' } },
    ])

    const res = await app.request('/property-tasks/nonexistent', {
      method: 'DELETE',
    }, makeEnv(mock.client))

    expect(res.status).toBe(404)
    const body: any = await res.json()
    expect(body.error).toBe('Not found')
  })

  it('returns 500 on DB delete error', async () => {
    const mock = createMockSupabase([
      // Fetch existing
      { data: { workspace_id: 'ws-1' }, error: null },
      // Delete fails
      { data: null, error: { message: 'delete failed', code: 'XX000' } },
    ])

    const res = await app.request('/property-tasks/pt-1', {
      method: 'DELETE',
    }, makeEnv(mock.client))

    expect(res.status).toBe(500)
    const body: any = await res.json()
    expect(body.error).toBe('Internal server error')
  })
})
