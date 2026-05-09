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

const sampleTemplate = {
  id: 'tpl-1',
  workspace_id: 'ws-1',
  name: 'Airbnb Earnings',
  entity_type: 'booking',
  header_fingerprint: 'abc123',
  column_map: { date: 'Date', amount: 'Amount', type: 'Type' },
  row_filter: null,
  amount_sign: 'negative_is_debit',
  date_format: 'auto',
  is_builtin: false,
  created_at: '2026-05-08T12:00:00Z',
  updated_at: '2026-05-08T12:00:00Z',
}

// ─── GET /csv-templates/ — List ───────────────────────────────────────────────

describe('GET /csv-templates/', () => {
  it('returns list with pagination', async () => {
    const mock = createMockSupabase([
      { data: [sampleTemplate], error: null, count: 1 },
    ])

    const res = await app.request('/csv-templates?workspace_id=ws-1', {}, makeEnv(mock.client))
    expect(res.status).toBe(200)
    const body: any = await res.json()
    expect(body.data).toEqual([sampleTemplate])
    expect(body.total).toBe(1)
    expect(body.limit).toBe(100)
    expect(body.offset).toBe(0)
  })

  it('returns 400 when workspace_id is missing', async () => {
    const mock = createMockSupabase([])

    const res = await app.request('/csv-templates', {}, makeEnv(mock.client))
    expect(res.status).toBe(400)
    const body: any = await res.json()
    expect(body.error).toContain('workspace_id')
  })

  it('filters by entity_type when provided', async () => {
    const mock = createMockSupabase([
      { data: [sampleTemplate], error: null, count: 1 },
    ])

    const res = await app.request(
      '/csv-templates?workspace_id=ws-1&entity_type=booking',
      {},
      makeEnv(mock.client),
    )
    expect(res.status).toBe(200)

    const listBuilder = mock.builders[0]
    expect(listBuilder?.calls).toEqual(
      expect.arrayContaining([
        { method: 'eq', args: ['entity_type', 'booking'] },
      ]),
    )
  })
})

// ─── POST /csv-templates/ — Create ───────────────────────────────────────────

describe('POST /csv-templates/', () => {
  it('creates template successfully', async () => {
    const mock = createMockSupabase([
      { data: sampleTemplate, error: null },
    ])

    const res = await app.request('/csv-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspace_id: 'ws-1',
        name: 'Airbnb Earnings',
        entity_type: 'booking',
        column_map: { date: 'Date', amount: 'Amount', type: 'Type' },
      }),
    }, makeEnv(mock.client))

    expect(res.status).toBe(201)
    const body: any = await res.json()
    expect(body.data).toEqual(sampleTemplate)
  })

  it('returns 400 for missing required fields', async () => {
    const mock = createMockSupabase([])

    const res = await app.request('/csv-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspace_id: 'ws-1' }),
    }, makeEnv(mock.client))

    expect(res.status).toBe(400)
    const body: any = await res.json()
    expect(body.error).toContain('name')
  })

  it('returns 409 for duplicate name', async () => {
    const mock = createMockSupabase([
      { data: null, error: { message: 'duplicate key', code: '23505' } },
    ])

    const res = await app.request('/csv-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspace_id: 'ws-1',
        name: 'Airbnb Earnings',
        entity_type: 'booking',
        column_map: { date: 'Date' },
      }),
    }, makeEnv(mock.client))

    expect(res.status).toBe(409)
    const body: any = await res.json()
    expect(body.error).toBe('Duplicate entry')
  })

  it('returns 400 for invalid JSON body', async () => {
    const mock = createMockSupabase([])

    const res = await app.request('/csv-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    }, makeEnv(mock.client))

    expect(res.status).toBe(400)
    const body: any = await res.json()
    expect(body.error).toBe('Invalid JSON')
  })
})

// ─── GET /csv-templates/:id — Get single ──────────────────────────────────────

describe('GET /csv-templates/:id', () => {
  it('returns single template', async () => {
    const mock = createMockSupabase([
      { data: sampleTemplate, error: null },
    ])

    const res = await app.request('/csv-templates/tpl-1', {}, makeEnv(mock.client))
    expect(res.status).toBe(200)
    const body: any = await res.json()
    expect(body.data).toEqual(sampleTemplate)
  })

  it('returns 404 when not found', async () => {
    const mock = createMockSupabase([
      { data: null, error: { message: 'not found', code: 'PGRST116' } },
    ])

    const res = await app.request('/csv-templates/nonexistent', {}, makeEnv(mock.client))
    expect(res.status).toBe(404)
    const body: any = await res.json()
    expect(body.error).toBe('Not found')
  })
})

// ─── PATCH /csv-templates/:id — Update ────────────────────────────────────────

describe('PATCH /csv-templates/:id', () => {
  it('updates template successfully', async () => {
    const updated = { ...sampleTemplate, name: 'Airbnb Earnings v2' }
    const mock = createMockSupabase([
      // Fetch existing (not builtin)
      { data: { is_builtin: false }, error: null },
      // Update
      { data: updated, error: null },
    ])

    const res = await app.request('/csv-templates/tpl-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Airbnb Earnings v2' }),
    }, makeEnv(mock.client))

    expect(res.status).toBe(200)
    const body: any = await res.json()
    expect(body.data).toEqual(updated)
  })

  it('returns 400 for empty body', async () => {
    const mock = createMockSupabase([])

    const res = await app.request('/csv-templates/tpl-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }, makeEnv(mock.client))

    expect(res.status).toBe(400)
    const body: any = await res.json()
    expect(body.error).toContain('At least one field')
  })

  it('returns 403 when template is builtin', async () => {
    const mock = createMockSupabase([
      // Fetch existing (builtin)
      { data: { is_builtin: true }, error: null },
    ])

    const res = await app.request('/csv-templates/tpl-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Hacked' }),
    }, makeEnv(mock.client))

    expect(res.status).toBe(403)
    const body: any = await res.json()
    expect(body.error).toBe('Cannot modify built-in template')
  })

  it('returns 404 when template not found', async () => {
    const mock = createMockSupabase([
      { data: null, error: { message: 'not found', code: 'PGRST116' } },
    ])

    const res = await app.request('/csv-templates/nonexistent', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated' }),
    }, makeEnv(mock.client))

    expect(res.status).toBe(404)
    const body: any = await res.json()
    expect(body.error).toBe('Not found')
  })

  it('returns 400 for invalid JSON body', async () => {
    const mock = createMockSupabase([])

    const res = await app.request('/csv-templates/tpl-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    }, makeEnv(mock.client))

    expect(res.status).toBe(400)
    const body: any = await res.json()
    expect(body.error).toBe('Invalid JSON')
  })
})

// ─── DELETE /csv-templates/:id — Delete ───────────────────────────────────────

describe('DELETE /csv-templates/:id', () => {
  it('deletes template successfully', async () => {
    const mock = createMockSupabase([
      // Fetch existing (not builtin)
      { data: { is_builtin: false }, error: null },
      // Delete
      { data: null, error: null },
    ])

    const res = await app.request('/csv-templates/tpl-1', {
      method: 'DELETE',
    }, makeEnv(mock.client))

    expect(res.status).toBe(204)
  })

  it('returns 403 when template is builtin', async () => {
    const mock = createMockSupabase([
      // Fetch existing (builtin)
      { data: { is_builtin: true }, error: null },
    ])

    const res = await app.request('/csv-templates/tpl-1', {
      method: 'DELETE',
    }, makeEnv(mock.client))

    expect(res.status).toBe(403)
    const body: any = await res.json()
    expect(body.error).toBe('Cannot delete built-in template')
  })

  it('returns 404 when template not found', async () => {
    const mock = createMockSupabase([
      { data: null, error: { message: 'not found', code: 'PGRST116' } },
    ])

    const res = await app.request('/csv-templates/nonexistent', {
      method: 'DELETE',
    }, makeEnv(mock.client))

    expect(res.status).toBe(404)
    const body: any = await res.json()
    expect(body.error).toBe('Not found')
  })

  it('returns 500 on DB delete error', async () => {
    const mock = createMockSupabase([
      // Fetch existing (not builtin)
      { data: { is_builtin: false }, error: null },
      // Delete fails
      { data: null, error: { message: 'delete failed', code: 'XX000' } },
    ])

    const res = await app.request('/csv-templates/tpl-1', {
      method: 'DELETE',
    }, makeEnv(mock.client))

    expect(res.status).toBe(500)
    const body: any = await res.json()
    expect(body.error).toBe('Internal server error')
  })
})
