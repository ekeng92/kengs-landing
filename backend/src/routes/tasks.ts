import { Hono } from 'hono'
import { requireAuth, type AuthVariables } from '../lib/auth'
import { createSupabaseClient } from '../lib/supabase'
import { requireWorkspaceFeature } from '../lib/permissions'
import {
  TaskListQuery,
  CreateTaskBody,
  UpdateTaskBody,
  MoveTaskBody,
  BulkCreateTasksBody,
} from '../lib/validation'
import type { Env } from '../types/env'
import { type ZodError } from 'zod'

type Bindings = Env
type Variables = AuthVariables

export const tasksRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>()

tasksRouter.use('*', requireAuth)

/** Format Zod errors into a client-friendly message */
function formatZodError(err: ZodError): string {
  return err.issues.map(e => `${e.path.join('.')}: ${e.message}`).join('; ')
}

/** Map Supabase/Postgres errors to safe client responses */
function mapDbError(error: { code?: string; message?: string }): { status: number; message: string } {
  if (error.code === '23505') return { status: 409, message: 'Duplicate entry' }
  if (error.code === '23503') return { status: 422, message: 'Referenced entity not found' }
  return { status: 500, message: 'Internal server error' }
}

/** List tasks with optional filters */
tasksRouter.get('/', async (c) => {
  const supabase = createSupabaseClient(c.env)

  if (!c.req.query('workspace_id')) return c.json({ error: 'workspace_id is required' }, 400)

  const parsed = TaskListQuery.safeParse({
    workspace_id: c.req.query('workspace_id'),
    status: c.req.query('status') || undefined,
    project: c.req.query('project') || undefined,
    priority: c.req.query('priority') || undefined,
    context: c.req.query('context') || undefined,
    assigned_to: c.req.query('assigned_to') || undefined,
  })

  if (!parsed.success) {
    return c.json({ error: formatZodError(parsed.error) }, 400)
  }

  const { workspace_id, status, project, priority, context, assigned_to } = parsed.data

  const forbidden = await requireWorkspaceFeature(c, workspace_id, 'tasks', 'read')
  if (forbidden) return forbidden

  let query = supabase
    .from('tasks')
    .select('*')
    .eq('workspace_id', workspace_id)

  if (status) query = query.eq('status', status)
  if (project) query = query.eq('project', project)
  if (priority) query = query.eq('priority', priority)
  if (context) query = query.eq('context', context)
  if (assigned_to === 'unassigned') {
    query = query.is('assigned_to', null)
  } else if (assigned_to) {
    query = query.eq('assigned_to', assigned_to)
  }

  // Try ordering by due_date first (V016); fall back to created_at only if column doesn't exist
  let result = await query
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (result.error?.code === '42703') {
    // Column doesn't exist yet (V016 not applied) — retry without it
    let fallback = supabase
      .from('tasks')
      .select('*')
      .eq('workspace_id', workspace_id)

    if (status) fallback = fallback.eq('status', status)
    if (project) fallback = fallback.eq('project', project)
    if (priority) fallback = fallback.eq('priority', priority)
    if (assigned_to === 'unassigned') {
      fallback = fallback.is('assigned_to', null)
    } else if (assigned_to) {
      fallback = fallback.eq('assigned_to', assigned_to)
    }

    result = await fallback.order('created_at', { ascending: false })
  }

  if (result.error) {
    const mapped = mapDbError(result.error)
    return c.json({ error: mapped.message }, mapped.status as any)
  }
  return c.json({ data: result.data })
})

/** Get a single task by ID or ref_code */
tasksRouter.get('/:idOrRef', async (c) => {
  const supabase = createSupabaseClient(c.env)
  const param = c.req.param('idOrRef')

  // If it matches AEON-NNN pattern, look up by ref_code
  const isRef = /^AEON-\d+$/i.test(param)
  const column = isRef ? 'ref_code' : 'id'

  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq(column, isRef ? param.toUpperCase() : param)
    .single()

  if (error || !data) return c.json({ error: 'Not found' }, 404)

  const forbidden = await requireWorkspaceFeature(c, (data as { workspace_id?: string }).workspace_id, 'tasks', 'read')
  if (forbidden) return forbidden

  return c.json({ data })
})

/** Create a task */
tasksRouter.post('/', async (c) => {
  const supabase = createSupabaseClient(c.env)

  const raw = await c.req.json().catch(() => null)
  if (!raw) return c.json({ error: 'Invalid JSON' }, 400)

  if (!raw.workspace_id || !raw.title) {
    return c.json({ error: 'workspace_id and title are required' }, 400)
  }

  const parsed = CreateTaskBody.safeParse(raw)
  if (!parsed.success) {
    return c.json({ error: formatZodError(parsed.error) }, 400)
  }

  const body = parsed.data
  const forbidden = await requireWorkspaceFeature(c, body.workspace_id, 'tasks', 'write')
  if (forbidden) return forbidden

  const userId = c.get('userId')

  // Build insert payload — V016 fields conditionally included
  const row: Record<string, unknown> = {
    workspace_id: body.workspace_id,
    title: body.title,
    description: body.description ?? null,
    status: body.status,
    priority: body.priority,
    project: body.project ?? null,
    tags: body.tags,
    created_by: userId,
    assigned_to: body.assigned_to ?? null,
  }

  if (body.due_date !== undefined) row.due_date = body.due_date
  if (body.effort !== undefined) row.effort = body.effort
  if (body.context !== undefined) row.context = body.context
  if (body.blocked_reason !== undefined) row.blocked_reason = body.blocked_reason
  if (body.completion_notes !== undefined) row.completion_notes = body.completion_notes

  const { data, error } = await supabase
    .from('tasks')
    .insert(row)
    .select()
    .single()

  if (error) {
    const mapped = mapDbError(error)
    return c.json({ error: mapped.message }, mapped.status as any)
  }
  return c.json({ data }, 201)
})

/** Update a task (partial update) */
tasksRouter.patch('/:idOrRef', async (c) => {
  const supabase = createSupabaseClient(c.env)
  const param = c.req.param('idOrRef')

  const raw = await c.req.json().catch(() => null)
  if (!raw) return c.json({ error: 'Invalid JSON' }, 400)

  const parsed = UpdateTaskBody.safeParse(raw)
  if (!parsed.success) {
    return c.json({ error: formatZodError(parsed.error) }, 400)
  }

  const body = parsed.data
  const isRef = /^AEON-\d+$/i.test(param)
  const column = isRef ? 'ref_code' : 'id'

  if (c.env.DEV_BYPASS_AUTH !== 'true' || c.env.DEV_WORKSPACE_ID) {
    const { data: existing } = await supabase
      .from('tasks')
      .select('workspace_id')
      .eq(column, isRef ? param.toUpperCase() : param)
      .single()
    const forbidden = await requireWorkspaceFeature(c, (existing as { workspace_id?: string } | null)?.workspace_id, 'tasks', 'write')
    if (forbidden) return forbidden
  }

  const { data, error } = await supabase
    .from('tasks')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq(column, isRef ? param.toUpperCase() : param)
    .select()
    .single()

  if (error) {
    const mapped = mapDbError(error)
    return c.json({ error: mapped.message }, mapped.status as any)
  }
  return c.json({ data })
})

/** Move a task to a new status (convenience endpoint) */
tasksRouter.patch('/:idOrRef/move', async (c) => {
  const supabase = createSupabaseClient(c.env)
  const param = c.req.param('idOrRef')

  const raw = await c.req.json().catch(() => null)
  if (!raw) return c.json({ error: 'Invalid JSON' }, 400)

  const parsed = MoveTaskBody.safeParse(raw)
  if (!parsed.success) {
    return c.json({ error: `Invalid status. Must be one of: ${MoveTaskBody.shape.status.options.join(', ')}` }, 400)
  }

  const { status } = parsed.data
  const isRef = /^AEON-\d+$/i.test(param)
  const column = isRef ? 'ref_code' : 'id'

  if (c.env.DEV_BYPASS_AUTH !== 'true' || c.env.DEV_WORKSPACE_ID) {
    const { data: existing } = await supabase
      .from('tasks')
      .select('workspace_id')
      .eq(column, isRef ? param.toUpperCase() : param)
      .single()
    const forbidden = await requireWorkspaceFeature(c, (existing as { workspace_id?: string } | null)?.workspace_id, 'tasks', 'write')
    if (forbidden) return forbidden
  }

  const { data, error } = await supabase
    .from('tasks')
    .update({ status, updated_at: new Date().toISOString() })
    .eq(column, isRef ? param.toUpperCase() : param)
    .select()
    .single()

  if (error) {
    const mapped = mapDbError(error)
    return c.json({ error: mapped.message }, mapped.status as any)
  }
  return c.json({ data })
})

/** Delete a task */
tasksRouter.delete('/:idOrRef', async (c) => {
  const supabase = createSupabaseClient(c.env)
  const param = c.req.param('idOrRef')

  const isRef = /^AEON-\d+$/i.test(param)
  const column = isRef ? 'ref_code' : 'id'

  if (c.env.DEV_BYPASS_AUTH !== 'true' || c.env.DEV_WORKSPACE_ID) {
    const { data: existing } = await supabase
      .from('tasks')
      .select('workspace_id')
      .eq(column, isRef ? param.toUpperCase() : param)
      .single()
    const forbidden = await requireWorkspaceFeature(c, (existing as { workspace_id?: string } | null)?.workspace_id, 'tasks', 'admin')
    if (forbidden) return forbidden
  }

  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq(column, isRef ? param.toUpperCase() : param)

  if (error) {
    const mapped = mapDbError(error)
    return c.json({ error: mapped.message }, mapped.status as any)
  }
  return c.json({ success: true })
})

/** Bulk create tasks (for brainstorm dumps) */
tasksRouter.post('/bulk', async (c) => {
  const supabase = createSupabaseClient(c.env)
  const userId = c.get('userId')

  const raw = await c.req.json().catch(() => null)
  if (!raw) return c.json({ error: 'Invalid JSON' }, 400)

  const parsed = BulkCreateTasksBody.safeParse(raw)
  if (!parsed.success) {
    return c.json({ error: formatZodError(parsed.error) }, 400)
  }

  const { workspace_id, tasks } = parsed.data

  const forbidden = await requireWorkspaceFeature(c, workspace_id, 'tasks', 'write')
  if (forbidden) return forbidden

  const rows = tasks.map(t => {
    const row: Record<string, unknown> = {
      workspace_id,
      title: t.title,
      description: t.description ?? null,
      status: t.status,
      priority: t.priority,
      project: t.project ?? null,
      tags: t.tags,
      created_by: userId,
    }
    if (t.due_date !== undefined) row.due_date = t.due_date
    if (t.effort !== undefined) row.effort = t.effort
    if (t.context !== undefined) row.context = t.context
    if (t.blocked_reason !== undefined) row.blocked_reason = t.blocked_reason
    if (t.completion_notes !== undefined) row.completion_notes = t.completion_notes
    return row
  })

  const { data, error } = await supabase
    .from('tasks')
    .insert(rows)
    .select()

  if (error) {
    const mapped = mapDbError(error)
    return c.json({ error: mapped.message }, mapped.status as any)
  }
  return c.json({ data, count: data.length }, 201)
})
