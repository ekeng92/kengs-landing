import { Hono } from 'hono'
import { requireAuth, type AuthVariables } from '../lib/auth'
import { createSupabaseClient } from '../lib/supabase'
import type { Env } from '../types/env'

type Bindings = Env
type Variables = AuthVariables

export const workspacesRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>()

workspacesRouter.use('*', requireAuth)

/** List workspaces the authenticated user belongs to */
workspacesRouter.get('/', async (c) => {
  const userId = c.var.userId
  const supabase = createSupabaseClient(c.env)

  const { data, error } = await supabase
    .from('workspace_memberships')
    .select('workspace_id, role, workspaces(*)')
    .eq('user_id', userId)

  if (error) return c.json({ error: error.message }, 500)
  return c.json({ data })
})

/** Create a new workspace and assign the creator as owner */
workspacesRouter.post('/', async (c) => {
  const userId = c.var.userId
  const supabase = createSupabaseClient(c.env)
  const body = await c.req.json<{ name: string }>()

  const { data: workspace, error: wErr } = await supabase
    .from('workspaces')
    .insert({ name: body.name })
    .select()
    .single()

  if (wErr || !workspace) return c.json({ error: wErr?.message ?? 'Failed to create workspace' }, 500)

  const { error: mErr } = await supabase
    .from('workspace_memberships')
    .insert({ workspace_id: workspace.id, user_id: userId, role: 'owner' })

  if (mErr) return c.json({ error: mErr.message }, 500)
  return c.json({ data: workspace }, 201)
})

/** Get a single workspace (requires membership) */
workspacesRouter.get('/:id', async (c) => {
  const userId = c.var.userId
  const supabase = createSupabaseClient(c.env)
  const id = c.req.param('id')

  const { data: membership } = await supabase
    .from('workspace_memberships')
    .select('role')
    .eq('workspace_id', id)
    .eq('user_id', userId)
    .single()

  if (!membership) return c.json({ error: 'Not found' }, 404)

  const { data, error } = await supabase.from('workspaces').select('*').eq('id', id).single()
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ data })
})

/** Update workspace name (owner only) */
workspacesRouter.patch('/:id', async (c) => {
  const userId = c.var.userId
  const supabase = createSupabaseClient(c.env)
  const id = c.req.param('id')
  const body = await c.req.json<{ name?: string }>()

  const { data: membership } = await supabase
    .from('workspace_memberships')
    .select('role')
    .eq('workspace_id', id)
    .eq('user_id', userId)
    .single()

  if (!membership || membership.role !== 'owner') return c.json({ error: 'Forbidden' }, 403)

  const { data, error } = await supabase
    .from('workspaces')
    .update({ name: body.name, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return c.json({ error: error.message }, 500)
  return c.json({ data })
})
