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

const sampleList = {
  id: 'list-1',
  workspace_id: 'ws-1',
  name: '360 CR Turnover Checklist',
  description: 'Full cleaning checklist',
  property_id: 'prop-1',
  is_template: false,
  created_by: 'user-1',
  created_at: '2026-05-08T12:00:00Z',
  updated_at: '2026-05-08T12:00:00Z',
}

const sampleItem = {
  id: 'item-1',
  list_id: 'list-1',
  item_key: 'turnover.laundry.strip_beds',
  item_label: 'Strip all beds',
  item_hint: 'Start now!',
  section: 'turnover',
  group_name: 'Laundry & Linens',
  sort_order: 10,
  frequency_days: null,
  is_required: true,
  created_at: '2026-05-08T12:00:00Z',
}

// ─── GET /cleaning-lists/ — List all ──────────────────────────────────────────

describe('GET /cleaning-lists/', () => {
  it('returns lists for workspace', async () => {
    const mock = createMockSupabase([
      { data: [sampleList], error: null },
    ])
    const res = await app.request('/cleaning-lists?workspace_id=ws-1', {}, makeEnv(mock.client))
    expect(res.status).toBe(200)
    const body: any = await res.json()
    expect(body.data).toEqual([sampleList])
  })

  it('returns 400 without workspace_id', async () => {
    const mock = createMockSupabase([])
    const res = await app.request('/cleaning-lists', {}, makeEnv(mock.client))
    expect(res.status).toBe(400)
  })

  it('returns 500 on DB error', async () => {
    const mock = createMockSupabase([
      { data: null, error: { message: 'DB error' } },
    ])
    const res = await app.request('/cleaning-lists?workspace_id=ws-1', {}, makeEnv(mock.client))
    expect(res.status).toBe(500)
  })
})

// ─── GET /cleaning-lists/:id — Get single ─────────────────────────────────────

describe('GET /cleaning-lists/:id', () => {
  it('returns list with items', async () => {
    const mock = createMockSupabase([
      { data: sampleList, error: null },
      { data: [sampleItem], error: null },
    ])
    const res = await app.request('/cleaning-lists/list-1', {}, makeEnv(mock.client))
    expect(res.status).toBe(200)
    const body: any = await res.json()
    expect(body.name).toBe('360 CR Turnover Checklist')
    expect(body.items).toHaveLength(1)
  })

  it('returns 404 when not found', async () => {
    const mock = createMockSupabase([
      { data: null, error: { message: 'not found', code: 'PGRST116' } },
    ])
    const res = await app.request('/cleaning-lists/bad-id', {}, makeEnv(mock.client))
    expect(res.status).toBe(404)
  })
})

// ─── POST /cleaning-lists/ — Create ──────────────────────────────────────────

describe('POST /cleaning-lists/', () => {
  it('creates a new list', async () => {
    const mock = createMockSupabase([
      { data: { ...sampleList, id: 'list-new' }, error: null },
      { data: null, error: null }, // change log insert
    ])
    const res = await app.request('/cleaning-lists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspace_id: 'b0604861-b7ae-4f1e-a7cb-fe066d57c623', name: 'New List' }),
    }, makeEnv(mock.client))
    expect(res.status).toBe(201)
    const body: any = await res.json()
    expect(body.id).toBeDefined()
  })

  it('returns 400 for missing name', async () => {
    const mock = createMockSupabase([])
    const res = await app.request('/cleaning-lists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspace_id: 'b0604861-b7ae-4f1e-a7cb-fe066d57c623' }),
    }, makeEnv(mock.client))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid workspace_id', async () => {
    const mock = createMockSupabase([])
    const res = await app.request('/cleaning-lists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspace_id: 'not-a-uuid', name: 'Test' }),
    }, makeEnv(mock.client))
    expect(res.status).toBe(400)
  })
})

// ─── PATCH /cleaning-lists/:id — Update ──────────────────────────────────────

describe('PATCH /cleaning-lists/:id', () => {
  it('updates list name', async () => {
    const updated = { ...sampleList, name: 'Updated Name' }
    const mock = createMockSupabase([
      { data: sampleList, error: null }, // get current
      { data: updated, error: null },    // update
      { data: null, error: null },       // change log
    ])
    const res = await app.request('/cleaning-lists/list-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated Name' }),
    }, makeEnv(mock.client))
    expect(res.status).toBe(200)
  })

  it('returns 404 when list not found', async () => {
    const mock = createMockSupabase([
      { data: null, error: { message: 'not found' } },
    ])
    const res = await app.request('/cleaning-lists/bad-id', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test' }),
    }, makeEnv(mock.client))
    expect(res.status).toBe(404)
  })
})

// ─── DELETE /cleaning-lists/:id ───────────────────────────────────────────────

describe('DELETE /cleaning-lists/:id', () => {
  it('deletes a list', async () => {
    const mock = createMockSupabase([
      { data: null, error: null },
    ])
    const res = await app.request('/cleaning-lists/list-1', {
      method: 'DELETE',
    }, makeEnv(mock.client))
    expect(res.status).toBe(200)
    const body: any = await res.json()
    expect(body.success).toBe(true)
  })

  it('returns 500 on DB error', async () => {
    const mock = createMockSupabase([
      { data: null, error: { message: 'FK constraint' } },
    ])
    const res = await app.request('/cleaning-lists/list-1', {
      method: 'DELETE',
    }, makeEnv(mock.client))
    expect(res.status).toBe(500)
  })
})

// ─── POST /cleaning-lists/:id/copy — Copy ────────────────────────────────────

describe('POST /cleaning-lists/:id/copy', () => {
  it('copies a list with items', async () => {
    const copy = { ...sampleList, id: 'list-copy', name: '360 CR Turnover Checklist (copy)' }
    const mock = createMockSupabase([
      { data: sampleList, error: null },       // get original
      { data: [sampleItem], error: null },     // get items
      { data: copy, error: null },             // insert copy
      { data: null, error: null },             // insert copied items
      { data: null, error: null },             // change log
    ])
    const res = await app.request('/cleaning-lists/list-1/copy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }, makeEnv(mock.client))
    expect(res.status).toBe(201)
  })

  it('copies with custom name', async () => {
    const copy = { ...sampleList, id: 'list-copy', name: 'Ironwood Checklist' }
    const mock = createMockSupabase([
      { data: sampleList, error: null },
      { data: [], error: null },
      { data: copy, error: null },
      { data: null, error: null },
    ])
    const res = await app.request('/cleaning-lists/list-1/copy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Ironwood Checklist' }),
    }, makeEnv(mock.client))
    expect(res.status).toBe(201)
  })

  it('returns 404 when source not found', async () => {
    const mock = createMockSupabase([
      { data: null, error: { message: 'not found' } },
    ])
    const res = await app.request('/cleaning-lists/bad/copy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }, makeEnv(mock.client))
    expect(res.status).toBe(404)
  })
})

// ─── POST /cleaning-lists/:id/items — Add item ───────────────────────────────

describe('POST /cleaning-lists/:id/items', () => {
  it('adds an item', async () => {
    const newItem = { ...sampleItem, id: 'item-new' }
    const mock = createMockSupabase([
      { data: { id: 'list-1' }, error: null },  // verify list
      { data: newItem, error: null },            // insert
      { data: null, error: null },               // change log
      { data: null, error: null },               // update list timestamp
    ])
    const res = await app.request('/cleaning-lists/list-1/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        item_key: 'turnover.new.task',
        item_label: 'New task',
        section: 'turnover',
      }),
    }, makeEnv(mock.client))
    expect(res.status).toBe(201)
  })

  it('returns 400 for missing label', async () => {
    const mock = createMockSupabase([])
    const res = await app.request('/cleaning-lists/list-1/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_key: 'test', section: 'turnover' }),
    }, makeEnv(mock.client))
    expect(res.status).toBe(400)
  })

  it('returns 404 when list not found', async () => {
    const mock = createMockSupabase([
      { data: null, error: { message: 'not found' } },
    ])
    const res = await app.request('/cleaning-lists/bad-id/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        item_key: 'test.item',
        item_label: 'Test',
        section: 'turnover',
      }),
    }, makeEnv(mock.client))
    expect(res.status).toBe(404)
  })
})

// ─── PATCH /cleaning-lists/:id/items/:itemId — Update item ────────────────────

describe('PATCH /cleaning-lists/:id/items/:itemId', () => {
  it('updates an item', async () => {
    const updated = { ...sampleItem, item_label: 'Updated label' }
    const mock = createMockSupabase([
      { data: sampleItem, error: null },   // get current
      { data: updated, error: null },      // update
      { data: null, error: null },         // change log
      { data: null, error: null },         // update list timestamp
    ])
    const res = await app.request('/cleaning-lists/list-1/items/item-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_label: 'Updated label' }),
    }, makeEnv(mock.client))
    expect(res.status).toBe(200)
  })

  it('returns 404 when item not found', async () => {
    const mock = createMockSupabase([
      { data: null, error: { message: 'not found' } },
    ])
    const res = await app.request('/cleaning-lists/list-1/items/bad-id', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_label: 'Test' }),
    }, makeEnv(mock.client))
    expect(res.status).toBe(404)
  })
})

// ─── DELETE /cleaning-lists/:id/items/:itemId ─────────────────────────────────

describe('DELETE /cleaning-lists/:id/items/:itemId', () => {
  it('deletes an item', async () => {
    const mock = createMockSupabase([
      { data: { item_label: 'Strip beds' }, error: null }, // get item
      { data: null, error: null },                          // delete
      { data: null, error: null },                          // change log
      { data: null, error: null },                          // update list timestamp
    ])
    const res = await app.request('/cleaning-lists/list-1/items/item-1', {
      method: 'DELETE',
    }, makeEnv(mock.client))
    expect(res.status).toBe(200)
    const body: any = await res.json()
    expect(body.success).toBe(true)
  })

  it('returns 404 when item not found', async () => {
    const mock = createMockSupabase([
      { data: null, error: { message: 'not found' } },
    ])
    const res = await app.request('/cleaning-lists/list-1/items/bad', {
      method: 'DELETE',
    }, makeEnv(mock.client))
    expect(res.status).toBe(404)
  })
})

// ─── PATCH /cleaning-lists/:id/reorder ────────────────────────────────────────

describe('PATCH /cleaning-lists/:id/reorder', () => {
  it('reorders items', async () => {
    const mock = createMockSupabase([
      { data: null, error: null }, // update item 1
      { data: null, error: null }, // update item 2
      { data: null, error: null }, // change log
      { data: null, error: null }, // update list timestamp
    ])
    const res = await app.request('/cleaning-lists/list-1/reorder', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [
          { id: 'a1111111-1111-4111-a111-111111111111', sort_order: 20 },
          { id: 'a2222222-2222-4222-a222-222222222222', sort_order: 10 },
        ],
      }),
    }, makeEnv(mock.client))
    expect(res.status).toBe(200)
    const body: any = await res.json()
    expect(body.success).toBe(true)
  })

  it('returns 400 for empty items array', async () => {
    const mock = createMockSupabase([])
    const res = await app.request('/cleaning-lists/list-1/reorder', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [] }),
    }, makeEnv(mock.client))
    expect(res.status).toBe(400)
  })
})

// ─── GET /cleaning-lists/:id/changes ──────────────────────────────────────────

describe('GET /cleaning-lists/:id/changes', () => {
  it('returns change history', async () => {
    const changes = [
      { id: 'ch-1', list_id: 'list-1', item_id: null, changed_by: 'user-1', change_type: 'create', changed_at: '2026-05-08T12:00:00Z' },
    ]
    const mock = createMockSupabase([
      { data: changes, error: null },
    ])
    const res = await app.request('/cleaning-lists/list-1/changes', {}, makeEnv(mock.client))
    expect(res.status).toBe(200)
    const body: any = await res.json()
    expect(body.data).toHaveLength(1)
  })
})

// ─── GET /clean/:token/list — Public list endpoint ────────────────────────────

describe('GET /clean/:token/list', () => {
  it('returns list items for valid token', async () => {
    const link = { id: 'link-1', list_id: 'list-1', is_active: true, expires_at: null }
    const list = { id: 'list-1', name: '360 CR Checklist', description: 'Test' }
    const items = [
      { ...sampleItem, frequency_days: null },
      { ...sampleItem, id: 'item-2', item_key: 'weekly.mouse_traps', frequency_days: 7 },
    ]
    const mock = createMockSupabase([
      { data: link, error: null },    // lookup link
      { data: list, error: null },    // get list
      { data: items, error: null },   // get items
      { data: [{ id: 'link-1' }], error: null },  // get all links for list
      { data: [{ id: 'session-1' }], error: null }, // get sessions
      { data: [{ item_key: 'weekly.mouse_traps', checked_at: '2026-05-01T12:00:00Z' }], error: null }, // checked items
    ])
    const res = await app.request('/clean/kl_c_test12345678/list', {}, makeEnv(mock.client))
    expect(res.status).toBe(200)
    const body: any = await res.json()
    expect(body.list.name).toBe('360 CR Checklist')
    expect(body.items).toHaveLength(2)
  })

  it('returns 404 for invalid token', async () => {
    const mock = createMockSupabase([
      { data: null, error: { message: 'not found' } },
    ])
    const res = await app.request('/clean/bad-token/list', {}, makeEnv(mock.client))
    expect(res.status).toBe(404)
  })

  it('returns 403 for deactivated link', async () => {
    const mock = createMockSupabase([
      { data: { id: 'link-1', list_id: 'list-1', is_active: false, expires_at: null }, error: null },
    ])
    const res = await app.request('/clean/kl_c_deactivated/list', {}, makeEnv(mock.client))
    expect(res.status).toBe(403)
  })

  it('returns 404 when no list assigned to link', async () => {
    const mock = createMockSupabase([
      { data: { id: 'link-1', list_id: null, is_active: true, expires_at: null }, error: null },
    ])
    const res = await app.request('/clean/kl_c_nolist/list', {}, makeEnv(mock.client))
    expect(res.status).toBe(404)
  })
})
