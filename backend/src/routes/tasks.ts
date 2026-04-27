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

  if (!workspaceId) return c.json({ error: 'workspace_id is required' }, 400)

  let query = supabase
    .from('tasks')
    .select('*')
    .eq('workspace_id', workspaceId)

  if (status) query = query.eq('status', status)
  if (project) query = query.eq('project', project)
  if (priority) query = query.eq('priority', priority)

  const { data, error } = await query.order('created_at', { ascending: false })
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
  }>()

  if (!body.workspace_id || !body.title) {
    return c.json({ error: 'workspace_id and title are required' }, 400)
  }

  const userId = c.var.userId

  const { data, error } = await supabase
    .from('tasks')
    .insert({
      workspace_id: body.workspace_id,
      title: body.title,
      description: body.description ?? null,
      status: body.status ?? 'backlog',
      priority: body.priority ?? 'medium',
      project: body.project ?? null,
      tags: body.tags ?? [],
      created_by: userId,
      assigned_to: body.assigned_to ?? null,
    })
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

  const validStatuses = ['backlog', 'todo', 'in_progress', 'done', 'archived']
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
    }>
  }>()

  if (!workspace_id || !tasks?.length) {
    return c.json({ error: 'workspace_id and tasks array are required' }, 400)
  }

  const rows = tasks.map(t => ({
    workspace_id,
    title: t.title,
    description: t.description ?? null,
    status: t.status ?? 'backlog',
    priority: t.priority ?? 'medium',
    project: t.project ?? null,
    tags: t.tags ?? [],
    created_by: userId,
  }))

  const { data, error } = await supabase
    .from('tasks')
    .insert(rows)
    .select()

  if (error) return c.json({ error: error.message }, 500)
  return c.json({ data, count: data.length }, 201)
})
