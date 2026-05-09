import { Hono } from 'hono'
import { z } from 'zod'
import { requireAuth, type AuthVariables } from '../lib/auth'
import { createSupabaseClient } from '../lib/supabase'
import type { Env } from '../types/env'

type Bindings = Env
type Variables = AuthVariables

export const cleaningListsRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>()

cleaningListsRouter.use('*', requireAuth)

// ─── Schemas ──────────────────────────────────────────────────────────────────

const createListSchema = z.object({
  workspace_id: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  property_id: z.string().uuid().optional(),
  is_template: z.boolean().optional(),
})

const updateListSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  property_id: z.string().uuid().nullable().optional(),
  is_template: z.boolean().optional(),
})

const createItemSchema = z.object({
  item_key: z.string().min(1).max(200),
  item_label: z.string().min(1).max(500),
  item_hint: z.string().max(500).optional(),
  section: z.string().min(1).max(100),
  group_name: z.string().max(200).optional(),
  sort_order: z.number().int().optional(),
  frequency_days: z.number().int().positive().nullable().optional(),
  is_required: z.boolean().optional(),
})

const updateItemSchema = z.object({
  item_label: z.string().min(1).max(500).optional(),
  item_hint: z.string().max(500).nullable().optional(),
  section: z.string().min(1).max(100).optional(),
  group_name: z.string().max(200).nullable().optional(),
  sort_order: z.number().int().optional(),
  frequency_days: z.number().int().positive().nullable().optional(),
  is_required: z.boolean().optional(),
})

const reorderSchema = z.object({
  items: z.array(z.object({
    id: z.string().uuid(),
    sort_order: z.number().int(),
  })).min(1),
})

// ─── Helper: record change ───────────────────────────────────────────────────

async function recordChange(
  supabase: ReturnType<typeof createSupabaseClient>,
  listId: string,
  itemId: string | null,
  changedBy: string,
  changeType: string,
  fieldName?: string | null,
  oldValue?: string | null,
  newValue?: string | null,
) {
  await supabase.from('cleaning_list_changes').insert({
    list_id: listId,
    item_id: itemId,
    changed_by: changedBy,
    change_type: changeType,
    field_name: fieldName || null,
    old_value: oldValue || null,
    new_value: newValue || null,
  })
}

// ─── List CRUD ────────────────────────────────────────────────────────────────

/** List all cleaning lists for a workspace */
cleaningListsRouter.get('/', async (c) => {
  const supabase = createSupabaseClient(c.env)
  const workspaceId = c.req.query('workspace_id')

  if (!workspaceId) {
    return c.json({ error: 'workspace_id is required' }, 400)
  }

  const { data, error } = await supabase
    .from('cleaning_lists')
    .select('*, cleaning_list_items(count)')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })

  if (error) {
    return c.json({ error: 'Failed to fetch cleaning lists' }, 500)
  }

  return c.json({ data })
})

/** Get a single list with all its items */
cleaningListsRouter.get('/:id', async (c) => {
  const id = c.req.param('id')
  const supabase = createSupabaseClient(c.env)

  const { data: list, error: listError } = await supabase
    .from('cleaning_lists')
    .select('*')
    .eq('id', id)
    .single()

  if (listError || !list) {
    return c.json({ error: 'List not found' }, 404)
  }

  const { data: items, error: itemsError } = await supabase
    .from('cleaning_list_items')
    .select('*')
    .eq('list_id', id)
    .order('sort_order', { ascending: true })

  if (itemsError) {
    return c.json({ error: 'Failed to fetch items' }, 500)
  }

  return c.json({ ...list, items: items || [] })
})

/** Create a new cleaning list */
cleaningListsRouter.post('/', async (c) => {
  const body: any = await c.req.json()
  const parsed = createListSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400)
  }

  const supabase = createSupabaseClient(c.env)
  const userEmail = c.get('userId') || 'unknown'

  const { data, error } = await supabase
    .from('cleaning_lists')
    .insert({ ...parsed.data, created_by: userEmail })
    .select()
    .single()

  if (error) {
    return c.json({ error: 'Failed to create list' }, 500)
  }

  await recordChange(supabase, data.id, null, userEmail, 'create', 'list', null, data.name)

  return c.json(data, 201)
})

/** Update a cleaning list */
cleaningListsRouter.patch('/:id', async (c) => {
  const id = c.req.param('id')
  const body: any = await c.req.json()
  const parsed = updateListSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400)
  }

  const supabase = createSupabaseClient(c.env)
  const userEmail = c.get('userId') || 'unknown'

  // Get current values for audit
  const { data: current } = await supabase
    .from('cleaning_lists')
    .select('*')
    .eq('id', id)
    .single()

  if (!current) {
    return c.json({ error: 'List not found' }, 404)
  }

  const updates = { ...parsed.data, updated_at: new Date().toISOString() }
  const { data, error } = await supabase
    .from('cleaning_lists')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return c.json({ error: 'Failed to update list' }, 500)
  }

  // Record changes
  for (const [key, val] of Object.entries(parsed.data)) {
    const oldVal = (current as Record<string, unknown>)[key]
    if (JSON.stringify(oldVal) !== JSON.stringify(val)) {
      await recordChange(supabase, id, null, userEmail, 'edit', key, String(oldVal ?? ''), String(val ?? ''))
    }
  }

  return c.json(data)
})

/** Delete a cleaning list */
cleaningListsRouter.delete('/:id', async (c) => {
  const id = c.req.param('id')
  const supabase = createSupabaseClient(c.env)

  const { error } = await supabase
    .from('cleaning_lists')
    .delete()
    .eq('id', id)

  if (error) {
    return c.json({ error: 'Failed to delete list' }, 500)
  }

  return c.json({ success: true })
})

/** Copy a cleaning list */
cleaningListsRouter.post('/:id/copy', async (c) => {
  const id = c.req.param('id')
  const supabase = createSupabaseClient(c.env)
  const userEmail = c.get('userId') || 'unknown'

  const body: any = await c.req.json().catch(() => ({}))
  const newName = body?.name

  // Get original list
  const { data: original } = await supabase
    .from('cleaning_lists')
    .select('*')
    .eq('id', id)
    .single()

  if (!original) {
    return c.json({ error: 'List not found' }, 404)
  }

  // Get original items
  const { data: items } = await supabase
    .from('cleaning_list_items')
    .select('*')
    .eq('list_id', id)
    .order('sort_order', { ascending: true })

  // Create copy
  const { data: copy, error: copyError } = await supabase
    .from('cleaning_lists')
    .insert({
      workspace_id: original.workspace_id,
      name: newName || original.name + ' (copy)',
      description: original.description,
      property_id: original.property_id,
      is_template: original.is_template,
      created_by: userEmail,
    })
    .select()
    .single()

  if (copyError || !copy) {
    return c.json({ error: 'Failed to copy list' }, 500)
  }

  // Copy items
  if (items && items.length > 0) {
    const newItems = items.map((item: any) => ({
      list_id: copy.id,
      item_key: item.item_key,
      item_label: item.item_label,
      item_hint: item.item_hint,
      section: item.section,
      group_name: item.group_name,
      sort_order: item.sort_order,
      frequency_days: item.frequency_days,
      is_required: item.is_required,
    }))

    await supabase.from('cleaning_list_items').insert(newItems)
  }

  await recordChange(supabase, copy.id, null, userEmail, 'copy', 'source_list', id, copy.id)

  return c.json(copy, 201)
})

// ─── Item CRUD ────────────────────────────────────────────────────────────────

/** Add item to a list */
cleaningListsRouter.post('/:id/items', async (c) => {
  const listId = c.req.param('id')
  const body: any = await c.req.json()
  const parsed = createItemSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400)
  }

  const supabase = createSupabaseClient(c.env)
  const userEmail = c.get('userId') || 'unknown'

  // Verify list exists
  const { data: list } = await supabase
    .from('cleaning_lists')
    .select('id')
    .eq('id', listId)
    .single()

  if (!list) {
    return c.json({ error: 'List not found' }, 404)
  }

  const { data, error } = await supabase
    .from('cleaning_list_items')
    .insert({ ...parsed.data, list_id: listId })
    .select()
    .single()

  if (error) {
    return c.json({ error: 'Failed to add item' }, 500)
  }

  await recordChange(supabase, listId, data.id, userEmail, 'add', 'item', null, data.item_label)

  // Update list timestamp
  await supabase.from('cleaning_lists').update({ updated_at: new Date().toISOString() }).eq('id', listId)

  return c.json(data, 201)
})

/** Update an item */
cleaningListsRouter.patch('/:id/items/:itemId', async (c) => {
  const listId = c.req.param('id')
  const itemId = c.req.param('itemId')
  const body: any = await c.req.json()
  const parsed = updateItemSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400)
  }

  const supabase = createSupabaseClient(c.env)
  const userEmail = c.get('userId') || 'unknown'

  // Get current for audit
  const { data: current } = await supabase
    .from('cleaning_list_items')
    .select('*')
    .eq('id', itemId)
    .eq('list_id', listId)
    .single()

  if (!current) {
    return c.json({ error: 'Item not found' }, 404)
  }

  const { data, error } = await supabase
    .from('cleaning_list_items')
    .update(parsed.data)
    .eq('id', itemId)
    .eq('list_id', listId)
    .select()
    .single()

  if (error) {
    return c.json({ error: 'Failed to update item' }, 500)
  }

  // Record changes
  for (const [key, val] of Object.entries(parsed.data)) {
    const oldVal = (current as Record<string, unknown>)[key]
    if (JSON.stringify(oldVal) !== JSON.stringify(val)) {
      await recordChange(supabase, listId, itemId, userEmail, 'edit', key, String(oldVal ?? ''), String(val ?? ''))
    }
  }

  await supabase.from('cleaning_lists').update({ updated_at: new Date().toISOString() }).eq('id', listId)

  return c.json(data)
})

/** Delete an item */
cleaningListsRouter.delete('/:id/items/:itemId', async (c) => {
  const listId = c.req.param('id')
  const itemId = c.req.param('itemId')
  const supabase = createSupabaseClient(c.env)
  const userEmail = c.get('userId') || 'unknown'

  // Get item for audit
  const { data: item } = await supabase
    .from('cleaning_list_items')
    .select('item_label')
    .eq('id', itemId)
    .eq('list_id', listId)
    .single()

  if (!item) {
    return c.json({ error: 'Item not found' }, 404)
  }

  const { error } = await supabase
    .from('cleaning_list_items')
    .delete()
    .eq('id', itemId)
    .eq('list_id', listId)

  if (error) {
    return c.json({ error: 'Failed to delete item' }, 500)
  }

  await recordChange(supabase, listId, null, userEmail, 'delete', 'item', item.item_label, null)
  await supabase.from('cleaning_lists').update({ updated_at: new Date().toISOString() }).eq('id', listId)

  return c.json({ success: true })
})

/** Reorder items */
cleaningListsRouter.patch('/:id/reorder', async (c) => {
  const listId = c.req.param('id')
  const body: any = await c.req.json()
  const parsed = reorderSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400)
  }

  const supabase = createSupabaseClient(c.env)
  const userEmail = c.get('userId') || 'unknown'

  // Update each item's sort_order
  for (const item of parsed.data.items) {
    await supabase
      .from('cleaning_list_items')
      .update({ sort_order: item.sort_order })
      .eq('id', item.id)
      .eq('list_id', listId)
  }

  await recordChange(supabase, listId, null, userEmail, 'reorder', null, null, null)
  await supabase.from('cleaning_lists').update({ updated_at: new Date().toISOString() }).eq('id', listId)

  return c.json({ success: true })
})

// ─── Change History ───────────────────────────────────────────────────────────

/** Get change history for a list */
cleaningListsRouter.get('/:id/changes', async (c) => {
  const listId = c.req.param('id')
  const supabase = createSupabaseClient(c.env)

  const { data, error } = await supabase
    .from('cleaning_list_changes')
    .select('*')
    .eq('list_id', listId)
    .order('changed_at', { ascending: false })
    .limit(100)

  if (error) {
    return c.json({ error: 'Failed to fetch changes' }, 500)
  }

  return c.json({ data })
})

// ─── Public: get list items for a token ───────────────────────────────────────
// This is used by the public cleaning page to load items from DB instead of hardcoded HTML.
// Mounted separately as it needs no auth.

export const cleaningListPublicRouter = new Hono<{ Bindings: Bindings }>()

/** Get cleaning list items for a token's linked list */
cleaningListPublicRouter.get('/:token/list', async (c) => {
  const token = c.req.param('token')
  const supabase = createSupabaseClient(c.env)

  // Look up the link
  const { data: link, error: linkError } = await supabase
    .from('cleaning_links')
    .select('id, list_id, is_active, expires_at')
    .eq('token', token)
    .single()

  if (linkError || !link) {
    return c.json({ error: 'Invalid token' }, 404)
  }

  if (!link.is_active) {
    return c.json({ error: 'Link deactivated' }, 403)
  }

  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    return c.json({ error: 'Link expired' }, 403)
  }

  if (!link.list_id) {
    return c.json({ error: 'No checklist assigned to this link' }, 404)
  }

  // Get list metadata
  const { data: list } = await supabase
    .from('cleaning_lists')
    .select('id, name, description')
    .eq('id', link.list_id)
    .single()

  if (!list) {
    return c.json({ error: 'Checklist not found' }, 404)
  }

  // Get items
  const { data: items, error: itemsError } = await supabase
    .from('cleaning_list_items')
    .select('id, item_key, item_label, item_hint, section, group_name, sort_order, frequency_days, is_required')
    .eq('list_id', link.list_id)
    .order('sort_order', { ascending: true })

  if (itemsError) {
    return c.json({ error: 'Failed to fetch items' }, 500)
  }

  // Get last completion timestamps for frequency-based items
  // Query the most recent checked_at for each item_key from cleaning_items
  const frequencyItems = (items || []).filter((i: any) => i.frequency_days != null)
  let lastDoneMap: Record<string, string> = {}

  if (frequencyItems.length > 0) {
    // Get all sessions for links pointing to this list
    const { data: linkIds } = await supabase
      .from('cleaning_links')
      .select('id')
      .eq('list_id', link.list_id)

    if (linkIds && linkIds.length > 0) {
      const ids = linkIds.map((l: any) => l.id)
      const { data: sessions } = await supabase
        .from('cleaning_sessions')
        .select('id')
        .in('link_id', ids)
        .eq('status', 'submitted')

      if (sessions && sessions.length > 0) {
        const sessionIds = sessions.map((s: any) => s.id)
        const itemKeys = frequencyItems.map((i: any) => i.item_key)

        const { data: checkedItems } = await supabase
          .from('cleaning_items')
          .select('item_key, checked_at')
          .in('session_id', sessionIds)
          .in('item_key', itemKeys)
          .eq('checked', true)
          .order('checked_at', { ascending: false })

        if (checkedItems) {
          for (const ci of checkedItems) {
            if (!lastDoneMap[ci.item_key] || (ci.checked_at && ci.checked_at > (lastDoneMap[ci.item_key] || ''))) {
              lastDoneMap[ci.item_key] = ci.checked_at || ''
            }
          }
        }
      }
    }
  }

  // Enrich items with last_done and overdue status
  const enrichedItems = (items || []).map((item: any) => {
    const result: any = { ...item }
    if (item.frequency_days != null) {
      const lastDone = lastDoneMap[item.item_key] || null
      result.last_done = lastDone
      if (lastDone) {
        const daysSince = Math.floor((Date.now() - new Date(lastDone).getTime()) / (1000 * 60 * 60 * 24))
        result.days_since_done = daysSince
        result.is_overdue = daysSince >= item.frequency_days
      } else {
        result.days_since_done = null
        result.is_overdue = true // Never done = overdue
      }
    }
    return result
  })

  return c.json({
    list: { id: list.id, name: list.name, description: list.description },
    items: enrichedItems,
  })
})
