import { Hono } from 'hono'
import { requireAuth, type AuthVariables } from '../lib/auth'
import { createSupabaseClient } from '../lib/supabase'
import type { Env } from '../types/env'

type Bindings = Env
type Variables = AuthVariables

export const tasksRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>()

tasksRouter.use('*', requireAuth)

/** List tasks with optional filters */
tasksRouter.get('/', async (c) => {
  const supabase = createSupabaseClient(c.env)
  const workspaceId = c.req.query('workspace_id')
  const status = c.req.query('status')
  const project = c.req.query('project')
  const priority = c.req.query('priority')
  const context = c.req.query('context')
  const assignedTo = c.req.query('assigned_to')

  if (!workspaceId) return c.json({ error: 'workspace_id is required' }, 400)

  let query = supabase
    .from('tasks')
    .select('*')
    .eq('workspace_id', workspaceId)

  if (status) query = query.eq('status', status)
  if (project) query = query.eq('project', project)
  if (priority) query = query.eq('priority', priority)
  if (context) query = query.eq('context', context)
  if (assignedTo === 'unassigned') {
    query = query.is('assigned_to', null)
  } else if (assignedTo) {
    query = query.eq('assigned_to', assignedTo)
  }

  const { data, error } = await query
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ data })
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
  return c.json({ data })
})

/** Create a task */
tasksRouter.post('/', async (c) => {
  const supabase = createSupabaseClient(c.env)
  const body = await c.req.json<{
    workspace_id: string
    title: string
    description?: string
    status?: string
    priority?: string
    project?: string
    tags?: string[]
    assigned_to?: string
    due_date?: string | null
    effort?: string | null
    context?: string | null
    blocked_reason?: string | null
  }>()

  if (!body.workspace_id || !body.title) {
    return c.json({ error: 'workspace_id and title are required' }, 400)
  }

  const userId = c.var.userId

  // Build insert payload with only fields that the DB has.
  // V016 fields (due_date, effort, context, blocked_reason) may not exist yet.
  const row: Record<string, unknown> = {
    workspace_id: body.workspace_id,
    title: body.title,
    description: body.description ?? null,
    status: body.status ?? 'backlog',
    priority: body.priority ?? 'medium',
    project: body.project ?? null,
    tags: body.tags ?? [],
    created_by: userId,
    assigned_to: body.assigned_to ?? null,
  }

  // Conditionally include V016 fields only if provided
  if (body.due_date !== undefined) row.due_date = body.due_date
  if (body.effort !== undefined) row.effort = body.effort
  if (body.context !== undefined) row.context = body.context
  if (body.blocked_reason !== undefined) row.blocked_reason = body.blocked_reason

  const { data, error } = await supabase
    .from('tasks')
    .insert(row)
    .select()
    .single()

  if (error) return c.json({ error: error.message }, 500)
  return c.json({ data }, 201)
})

/** Update a task (partial update) */
tasksRouter.patch('/:idOrRef', async (c) => {
  const supabase = createSupabaseClient(c.env)
  const param = c.req.param('idOrRef')
  const body = await c.req.json<Partial<{
    title: string
    description: string
    status: string
    priority: string
    project: string
    tags: string[]
    assigned_to: string
    due_date: string | null
    effort: string | null
    context: string | null
    blocked_reason: string | null
  }>>()

  const isRef = /^AEON-\d+$/i.test(param)
  const column = isRef ? 'ref_code' : 'id'

  const { data, error } = await supabase
    .from('tasks')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq(column, isRef ? param.toUpperCase() : param)
    .select()
    .single()

  if (error) return c.json({ error: error.message }, 500)
  return c.json({ data })
})

/** Move a task to a new status (convenience endpoint) */
tasksRouter.patch('/:idOrRef/move', async (c) => {
  const supabase = createSupabaseClient(c.env)
  const param = c.req.param('idOrRef')
  const { status } = await c.req.json<{ status: string }>()

  const validStatuses = ['backlog', 'todo', 'in_progress', 'waiting', 'done', 'archived']
  if (!validStatuses.includes(status)) {
    return c.json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }, 400)
  }

  const isRef = /^AEON-\d+$/i.test(param)
  const column = isRef ? 'ref_code' : 'id'

  const { data, error } = await supabase
    .from('tasks')
    .update({ status, updated_at: new Date().toISOString() })
    .eq(column, isRef ? param.toUpperCase() : param)
    .select()
    .single()

  if (error) return c.json({ error: error.message }, 500)
  return c.json({ data })
})

/** Delete a task */
tasksRouter.delete('/:idOrRef', async (c) => {
  const supabase = createSupabaseClient(c.env)
  const param = c.req.param('idOrRef')

  const isRef = /^AEON-\d+$/i.test(param)
  const column = isRef ? 'ref_code' : 'id'

  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq(column, isRef ? param.toUpperCase() : param)

  if (error) return c.json({ error: error.message }, 500)
  return c.json({ success: true })
})

/** Bulk create tasks (for brainstorm dumps) */
tasksRouter.post('/bulk', async (c) => {
  const supabase = createSupabaseClient(c.env)
  const userId = c.var.userId
  const { workspace_id, tasks } = await c.req.json<{
    workspace_id: string
    tasks: Array<{
      title: string
      description?: string
      status?: string
      priority?: string
      project?: string
      tags?: string[]
      due_date?: string | null
      effort?: string | null
      context?: string | null
      blocked_reason?: string | null
    }>
  }>()

  if (!workspace_id || !tasks?.length) {
    return c.json({ error: 'workspace_id and tasks array are required' }, 400)
  }

  const rows = tasks.map(t => {
    const row: Record<string, unknown> = {
      workspace_id,
      title: t.title,
      description: t.description ?? null,
      status: t.status ?? 'backlog',
      priority: t.priority ?? 'medium',
      project: t.project ?? null,
      tags: t.tags ?? [],
      created_by: userId,
    }
    if (t.due_date !== undefined) row.due_date = t.due_date
    if (t.effort !== undefined) row.effort = t.effort
    if (t.context !== undefined) row.context = t.context
    if (t.blocked_reason !== undefined) row.blocked_reason = t.blocked_reason
    return row
  })

  const { data, error } = await supabase
    .from('tasks')
    .insert(rows)
    .select()

  if (error) return c.json({ error: error.message }, 500)
  return c.json({ data, count: data.length }, 201)
})
