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

// ─── Public Routes: GET /clean/:token ─────────────────────────────────────────

describe('GET /clean/:token', () => {
  it('returns 404 for invalid token', async () => {
    const mock = createMockSupabase([
      { data: null, error: { message: 'not found', code: 'PGRST116' } },
    ])

    const res = await app.request('/clean/bad_token', {}, makeEnv(mock.client))
    expect(res.status).toBe(404)
    const body: any = await res.json()
    expect(body.error).toContain('Invalid')
  })

  it('returns 403 for deactivated link', async () => {
    const mock = createMockSupabase([
      { data: { id: 'link-1', property_id: null, workspace_id: 'ws-1', cleaner_name: 'Julie', cleaning_type: 'all', is_active: false, expires_at: null }, error: null },
    ])

    const res = await app.request('/clean/test_token', {}, makeEnv(mock.client))
    expect(res.status).toBe(403)
  })

  it('returns 403 for expired link', async () => {
    const mock = createMockSupabase([
      { data: { id: 'link-1', property_id: null, workspace_id: 'ws-1', cleaner_name: 'Julie', cleaning_type: 'all', is_active: true, expires_at: '2020-01-01T00:00:00Z' }, error: null },
    ])

    const res = await app.request('/clean/test_token', {}, makeEnv(mock.client))
    expect(res.status).toBe(403)
  })

  it('creates session for valid token', async () => {
    const mock = createMockSupabase([
      // Link lookup
      { data: { id: 'link-1', property_id: 'prop-1', workspace_id: 'ws-1', cleaner_name: 'Julie', cleaning_type: 'all', is_active: true, expires_at: null }, error: null },
      // Rate limit check
      { data: [], error: null, count: 2 },
      // Property lookup
      { data: { name: '360 County Road' }, error: null },
      // Session insert
      { data: { id: 'session-1', opened_at: '2026-05-07T12:00:00Z' }, error: null },
    ])

    const res = await app.request('/clean/valid_token', {}, makeEnv(mock.client))
    expect(res.status).toBe(200)
    const body: any = await res.json()
    expect(body.session_id).toBe('session-1')
    expect(body.property_name).toBe('360 County Road')
    expect(body.cleaner_name).toBe('Julie')
  })

  it('returns 429 when rate limit exceeded', async () => {
    const mock = createMockSupabase([
      // Link lookup
      { data: { id: 'link-1', property_id: null, workspace_id: 'ws-1', cleaner_name: 'Julie', cleaning_type: 'all', is_active: true, expires_at: null }, error: null },
      // Rate limit check — 10 sessions today
      { data: [], error: null, count: 10 },
    ])

    const res = await app.request('/clean/valid_token', {}, makeEnv(mock.client))
    expect(res.status).toBe(429)
  })
})

// ─── Public Routes: POST /clean/:token/submit ─────────────────────────────────

describe('POST /clean/:token/submit', () => {
  it('returns 404 for invalid token', async () => {
    const mock = createMockSupabase([
      { data: null, error: { message: 'not found' } },
    ])

    const res = await app.request('/clean/bad_token/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: 's-1', items: [] }),
    }, makeEnv(mock.client))

    expect(res.status).toBe(404)
  })

  it('returns 400 when session_id or items missing', async () => {
    const mock = createMockSupabase([
      { data: { id: 'link-1', is_active: true }, error: null },
    ])

    const res = await app.request('/clean/valid_token/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }, makeEnv(mock.client))

    expect(res.status).toBe(400)
  })

  it('returns 409 for already submitted session', async () => {
    const mock = createMockSupabase([
      // Link lookup
      { data: { id: 'link-1', is_active: true }, error: null },
      // Session lookup
      { data: { id: 'session-1', link_id: 'link-1', status: 'submitted' }, error: null },
    ])

    const res = await app.request('/clean/valid_token/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: 'session-1', items: [{ key: 'a', label: 'A', section: 'turnover', checked: true }] }),
    }, makeEnv(mock.client))

    expect(res.status).toBe(409)
  })

  it('returns 403 when session does not belong to link', async () => {
    const mock = createMockSupabase([
      // Link lookup
      { data: { id: 'link-1', is_active: true }, error: null },
      // Session lookup — different link_id
      { data: { id: 'session-1', link_id: 'link-99', status: 'in_progress' }, error: null },
    ])

    const res = await app.request('/clean/valid_token/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: 'session-1', items: [{ key: 'a', label: 'A', section: 'turnover', checked: true }] }),
    }, makeEnv(mock.client))

    expect(res.status).toBe(403)
  })

  it('submits successfully with items and metadata', async () => {
    const mock = createMockSupabase([
      // Link lookup
      { data: { id: 'link-1', is_active: true }, error: null },
      // Session lookup
      { data: { id: 'session-1', link_id: 'link-1', status: 'in_progress' }, error: null },
      // Session update
      { data: null, error: null },
      // Items insert
      { data: null, error: null },
    ])

    const res = await app.request('/clean/valid_token/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: 'session-1',
        items: [
          { key: 'turnover.laundry.strip_beds', label: 'Strip all beds', section: 'turnover', checked: true },
          { key: 'turnover.laundry.remake_beds', label: 'Remake beds', section: 'turnover', checked: false },
        ],
        notes: 'Mouse caught in trap 2',
        client_metadata: {
          screen_size: '390x844',
          language: 'en-US',
          timezone: 'America/Chicago',
        },
      }),
    }, makeEnv(mock.client))

    expect(res.status).toBe(200)
    const body: any = await res.json()
    expect(body.success).toBe(true)
    expect(body.summary.checked).toBe(1)
    expect(body.summary.unchecked).toBe(1)
    expect(body.summary.total_items).toBe(2)
  })
})

// ─── Admin Routes: POST /cleaning/links ───────────────────────────────────────

describe('POST /cleaning/links', () => {
  it('creates a cleaning link', async () => {
    const mock = createMockSupabase([
      { data: { id: 'link-1', token: 'kl_c_abc123', cleaner_name: 'Julie', workspace_id: 'ws-1' }, error: null },
    ])

    const res = await app.request('/cleaning/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspace_id: 'ws-1', cleaner_name: 'Julie' }),
    }, makeEnv(mock.client))

    expect(res.status).toBe(201)
    const body: any = await res.json()
    expect(body.cleaner_name).toBe('Julie')
  })

  it('returns 400 when workspace_id missing', async () => {
    const mock = createMockSupabase([])

    const res = await app.request('/cleaning/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cleaner_name: 'Julie' }),
    }, makeEnv(mock.client))

    expect(res.status).toBe(400)
  })
})

// ─── Admin Routes: GET /cleaning/links ────────────────────────────────────────

describe('GET /cleaning/links', () => {
  it('returns 400 without workspace_id', async () => {
    const mock = createMockSupabase([])

    const res = await app.request('/cleaning/links', {}, makeEnv(mock.client))
    expect(res.status).toBe(400)
  })

  it('returns links for workspace', async () => {
    const links = [
      { id: 'link-1', token: 'kl_c_abc', cleaner_name: 'Julie', is_active: true },
    ]
    const mock = createMockSupabase([{ data: links, error: null }])

    const res = await app.request('/cleaning/links?workspace_id=ws-1', {}, makeEnv(mock.client))
    expect(res.status).toBe(200)
    const body: any = await res.json()
    expect(body.data).toHaveLength(1)
  })
})

// ─── Admin Routes: GET /cleaning/sessions ─────────────────────────────────────

describe('GET /cleaning/sessions', () => {
  it('returns 400 without workspace_id', async () => {
    const mock = createMockSupabase([])

    const res = await app.request('/cleaning/sessions', {}, makeEnv(mock.client))
    expect(res.status).toBe(400)
  })

  it('returns sessions for workspace', async () => {
    const sessions = [
      { id: 'session-1', link_id: 'link-1', status: 'submitted', opened_at: '2026-05-07T12:00:00Z' },
    ]
    const mock = createMockSupabase([{ data: sessions, error: null }])

    const res = await app.request('/cleaning/sessions?workspace_id=ws-1', {}, makeEnv(mock.client))
    expect(res.status).toBe(200)
    const body: any = await res.json()
    expect(body.data).toHaveLength(1)
  })
})

// ─── Admin Routes: GET /cleaning/sessions/:id ─────────────────────────────────

describe('GET /cleaning/sessions/:id', () => {
  it('returns session with items', async () => {
    const mock = createMockSupabase([
      { data: { id: 'session-1', link_id: 'link-1', status: 'submitted' }, error: null },
      { data: [{ id: 'item-1', item_key: 'turnover.laundry.strip_beds', checked: true }], error: null },
    ])

    const res = await app.request('/cleaning/sessions/session-1', {}, makeEnv(mock.client))
    expect(res.status).toBe(200)
    const body: any = await res.json()
    expect(body.items).toHaveLength(1)
  })

  it('returns 404 for unknown session', async () => {
    const mock = createMockSupabase([
      { data: null, error: { message: 'not found' } },
    ])

    const res = await app.request('/cleaning/sessions/bad-id', {}, makeEnv(mock.client))
    expect(res.status).toBe(404)
  })
})

// ─── Public Routes: GET /clean/:token/tasks ───────────────────────────────────

describe('GET /clean/:token/tasks', () => {
  it('returns pending tasks for valid token', async () => {
    const tasks = [
      { id: 'pt-1', title: 'Replace air filters', description: null, priority: 'medium', due_date: null, status: 'pending' },
      { id: 'pt-2', title: 'Check smoke detectors', description: null, priority: 'high', due_date: null, status: 'in_progress' },
    ]
    const mock = createMockSupabase([
      // Link lookup
      { data: { id: 'link-1', property_id: 'prop-1', is_active: true, expires_at: null }, error: null },
      // Tasks query
      { data: tasks, error: null },
    ])

    const res = await app.request('/clean/valid_token/tasks', {}, makeEnv(mock.client))
    expect(res.status).toBe(200)
    const body: any = await res.json()
    expect(body.data).toEqual(tasks)
    expect(body.data).toHaveLength(2)
  })

  it('returns 404 for invalid token', async () => {
    const mock = createMockSupabase([
      { data: null, error: { message: 'not found', code: 'PGRST116' } },
    ])

    const res = await app.request('/clean/bad_token/tasks', {}, makeEnv(mock.client))
    expect(res.status).toBe(404)
    const body: any = await res.json()
    expect(body.error).toContain('Invalid')
  })

  it('returns 403 for deactivated link', async () => {
    const mock = createMockSupabase([
      { data: { id: 'link-1', property_id: 'prop-1', is_active: false, expires_at: null }, error: null },
    ])

    const res = await app.request('/clean/test_token/tasks', {}, makeEnv(mock.client))
    expect(res.status).toBe(403)
    const body: any = await res.json()
    expect(body.error).toContain('deactivated')
  })

  it('returns 403 for expired link', async () => {
    const mock = createMockSupabase([
      { data: { id: 'link-1', property_id: 'prop-1', is_active: true, expires_at: '2020-01-01T00:00:00Z' }, error: null },
    ])

    const res = await app.request('/clean/test_token/tasks', {}, makeEnv(mock.client))
    expect(res.status).toBe(403)
    const body: any = await res.json()
    expect(body.error).toContain('expired')
  })

  it('returns empty array when link has no property_id', async () => {
    const mock = createMockSupabase([
      { data: { id: 'link-1', property_id: null, is_active: true, expires_at: null }, error: null },
    ])

    const res = await app.request('/clean/test_token/tasks', {}, makeEnv(mock.client))
    expect(res.status).toBe(200)
    const body: any = await res.json()
    expect(body.data).toEqual([])
  })
})

// ─── Public Routes: PATCH /clean/:token/tasks/:taskId/complete ────────────────

describe('PATCH /clean/:token/tasks/:taskId/complete', () => {
  it('marks task as completed with cleaner name', async () => {
    const completedTask = {
      id: 'pt-1',
      property_id: 'prop-1',
      title: 'Replace air filters',
      status: 'completed',
      completed_by: 'Julie',
      completed_at: '2026-05-08T12:00:00Z',
    }
    const mock = createMockSupabase([
      // Link lookup
      { data: { id: 'link-1', property_id: 'prop-1', cleaner_name: 'Julie', is_active: true, expires_at: null }, error: null },
      // Task lookup
      { data: { id: 'pt-1', property_id: 'prop-1', status: 'pending' }, error: null },
      // Update
      { data: completedTask, error: null },
    ])

    const res = await app.request('/clean/valid_token/tasks/pt-1/complete', {
      method: 'PATCH',
    }, makeEnv(mock.client))

    expect(res.status).toBe(200)
    const body: any = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.status).toBe('completed')
    expect(body.data.completed_by).toBe('Julie')
  })

  it('returns 404 for invalid token', async () => {
    const mock = createMockSupabase([
      { data: null, error: { message: 'not found', code: 'PGRST116' } },
    ])

    const res = await app.request('/clean/bad_token/tasks/pt-1/complete', {
      method: 'PATCH',
    }, makeEnv(mock.client))

    expect(res.status).toBe(404)
    const body: any = await res.json()
    expect(body.error).toContain('Invalid')
  })

  it('returns 404 when task not found', async () => {
    const mock = createMockSupabase([
      // Link lookup
      { data: { id: 'link-1', property_id: 'prop-1', cleaner_name: 'Julie', is_active: true, expires_at: null }, error: null },
      // Task lookup — not found
      { data: null, error: { message: 'not found', code: 'PGRST116' } },
    ])

    const res = await app.request('/clean/valid_token/tasks/nonexistent/complete', {
      method: 'PATCH',
    }, makeEnv(mock.client))

    expect(res.status).toBe(404)
    const body: any = await res.json()
    expect(body.error).toContain('Task not found')
  })

  it('returns 403 when task does not belong to property', async () => {
    const mock = createMockSupabase([
      // Link lookup — property_id = prop-1
      { data: { id: 'link-1', property_id: 'prop-1', cleaner_name: 'Julie', is_active: true, expires_at: null }, error: null },
      // Task lookup — different property_id
      { data: { id: 'pt-1', property_id: 'prop-other', status: 'pending' }, error: null },
    ])

    const res = await app.request('/clean/valid_token/tasks/pt-1/complete', {
      method: 'PATCH',
    }, makeEnv(mock.client))

    expect(res.status).toBe(403)
    const body: any = await res.json()
    expect(body.error).toContain('does not belong')
  })

  it('returns 409 when task is already completed', async () => {
    const mock = createMockSupabase([
      // Link lookup
      { data: { id: 'link-1', property_id: 'prop-1', cleaner_name: 'Julie', is_active: true, expires_at: null }, error: null },
      // Task lookup — already completed
      { data: { id: 'pt-1', property_id: 'prop-1', status: 'completed' }, error: null },
    ])

    const res = await app.request('/clean/valid_token/tasks/pt-1/complete', {
      method: 'PATCH',
    }, makeEnv(mock.client))

    expect(res.status).toBe(409)
    const body: any = await res.json()
    expect(body.error).toContain('already completed')
  })

  it('returns 403 for deactivated link', async () => {
    const mock = createMockSupabase([
      { data: { id: 'link-1', property_id: 'prop-1', cleaner_name: 'Julie', is_active: false, expires_at: null }, error: null },
    ])

    const res = await app.request('/clean/valid_token/tasks/pt-1/complete', {
      method: 'PATCH',
    }, makeEnv(mock.client))

    expect(res.status).toBe(403)
    const body: any = await res.json()
    expect(body.error).toContain('deactivated')
  })
})
