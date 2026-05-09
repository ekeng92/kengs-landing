import { Hono } from 'hono'
import { requireAuth, type AuthVariables } from '../lib/auth'
import { createSupabaseClient } from '../lib/supabase'
import { requireWorkspaceFeature } from '../lib/permissions'
import type { Env } from '../types/env'
import {
  PropertyTaskListQuery,
  CreatePropertyTaskBody,
  UpdatePropertyTaskBody,
  formatZodError,
  mapDbError,
} from '../lib/validation'

type Bindings = Env
type Variables = AuthVariables

export const propertyTasksRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>()

propertyTasksRouter.use('*', requireAuth)

/** List property tasks with auto-expire logic */
propertyTasksRouter.get('/', async (c) => {
  const supabase = createSupabaseClient(c.env)

  const parsed = PropertyTaskListQuery.safeParse({
    workspace_id: c.req.query('workspace_id'),
    property_id: c.req.query('property_id') || undefined,
    status: c.req.query('status') || undefined,
    priority: c.req.query('priority') || undefined,
    limit: c.req.query('limit') || undefined,
    offset: c.req.query('offset') || undefined,
  })

  if (!parsed.success) return c.json({ error: formatZodError(parsed.error) }, 400)

  const { workspace_id, property_id, status, priority, limit, offset } = parsed.data

  const forbidden = await requireWorkspaceFeature(c, workspace_id, 'cleaning', 'read')
  if (forbidden) return forbidden

  // Auto-expire: mark pending tasks with auto_expire=true and past due_date as expired
  const today = new Date().toISOString().split('T')[0]
  await supabase
    .from('property_tasks')
    .update({ status: 'expired', updated_at: new Date().toISOString() })
    .eq('workspace_id', workspace_id)
    .eq('status', 'pending')
    .eq('auto_expire', true)
    .lt('due_date', today)

  let query = supabase
    .from('property_tasks')
    .select('*', { count: 'exact' })
    .eq('workspace_id', workspace_id)

  if (property_id) query = query.eq('property_id', property_id)
  if (status) query = query.eq('status', status)
  if (priority) query = query.eq('priority', priority)

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    const mapped = mapDbError(error)
    return c.json({ error: mapped.message }, mapped.status as any)
  }

  return c.json({ data, total: count, limit, offset })
})

/** Create a property task */
propertyTasksRouter.post('/', async (c) => {
  const supabase = createSupabaseClient(c.env)

  const raw = await c.req.json().catch(() => null)
  if (!raw) return c.json({ error: 'Invalid JSON' }, 400)

  const parsed = CreatePropertyTaskBody.safeParse(raw)
  if (!parsed.success) return c.json({ error: formatZodError(parsed.error) }, 400)

  const body = parsed.data

  const forbidden = await requireWorkspaceFeature(c, body.workspace_id, 'cleaning', 'write')
  if (forbidden) return forbidden

  // Verify property belongs to this workspace
  const { data: property } = await supabase
    .from('properties')
    .select('id')
    .eq('id', body.property_id)
    .eq('workspace_id', body.workspace_id)
    .single()

  if (!property) return c.json({ error: 'Property not found in this workspace' }, 422)

  const { data, error } = await supabase
    .from('property_tasks')
    .insert({
      ...body,
      created_by: c.var.userId,
    })
    .select()
    .single()

  if (error) {
    const mapped = mapDbError(error)
    return c.json({ error: mapped.message }, mapped.status as any)
  }

  return c.json({ data }, 201)
})

/** Get a single property task */
propertyTasksRouter.get('/:id', async (c) => {
  const supabase = createSupabaseClient(c.env)

  const { data, error } = await supabase
    .from('property_tasks')
    .select('*')
    .eq('id', c.req.param('id'))
    .single()

  if (error || !data) return c.json({ error: 'Not found' }, 404)

  const forbidden = await requireWorkspaceFeature(c, data.workspace_id, 'cleaning', 'read')
  if (forbidden) return forbidden

  return c.json({ data })
})

/** Update a property task */
propertyTasksRouter.patch('/:id', async (c) => {
  const supabase = createSupabaseClient(c.env)

  const raw = await c.req.json().catch(() => null)
  if (!raw) return c.json({ error: 'Invalid JSON' }, 400)

  const parsed = UpdatePropertyTaskBody.safeParse(raw)
  if (!parsed.success) return c.json({ error: formatZodError(parsed.error) }, 400)

  // Fetch existing to check workspace ownership
  const { data: existing } = await supabase
    .from('property_tasks')
    .select('workspace_id')
    .eq('id', c.req.param('id'))
    .single()

  if (!existing) return c.json({ error: 'Not found' }, 404)

  const forbidden = await requireWorkspaceFeature(c, existing.workspace_id, 'cleaning', 'write')
  if (forbidden) return forbidden

  const { data, error } = await supabase
    .from('property_tasks')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', c.req.param('id'))
    .select()
    .single()

  if (error) {
    const mapped = mapDbError(error)
    return c.json({ error: mapped.message }, mapped.status as any)
  }

  return c.json({ data })
})

/** Delete a property task */
propertyTasksRouter.delete('/:id', async (c) => {
  const supabase = createSupabaseClient(c.env)

  // Fetch existing to check workspace ownership
  const { data: existing } = await supabase
    .from('property_tasks')
    .select('workspace_id')
    .eq('id', c.req.param('id'))
    .single()

  if (!existing) return c.json({ error: 'Not found' }, 404)

  const forbidden = await requireWorkspaceFeature(c, existing.workspace_id, 'cleaning', 'write')
  if (forbidden) return forbidden

  const { error } = await supabase
    .from('property_tasks')
    .delete()
    .eq('id', c.req.param('id'))

  if (error) {
    const mapped = mapDbError(error)
    return c.json({ error: mapped.message }, mapped.status as any)
  }

  return c.json({ success: true })
})
