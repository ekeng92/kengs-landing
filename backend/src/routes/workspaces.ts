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

// ─── Workspace Members (assignee management) ─────────────────────────────────

/**
 * List all members/assignees for a workspace.
 * Returns both human users and agents.
 * The frontend uses this to populate assignee dropdowns.
 */
workspacesRouter.get('/:id/members', async (c) => {
  const supabase = createSupabaseClient(c.env)
  const workspaceId = c.req.param('id')

  const { data, error } = await supabase
    .from('workspace_memberships')
    .select('id, user_id, role, display_name, created_at')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: true })

  if (error) {
    // If display_name column doesn't exist yet, fall back without it
    if (error.message?.includes('display_name')) {
      const { data: fallback, error: fallbackErr } = await supabase
        .from('workspace_memberships')
        .select('id, user_id, role, created_at')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: true })
      if (fallbackErr) return c.json({ error: fallbackErr.message }, 500)
      return c.json({ data: fallback })
    }
    return c.json({ error: error.message }, 500)
  }
  return c.json({ data })
})

/**
 * Add a member or agent to a workspace.
 * For agents: provide display_name and role='agent'. user_id is auto-generated.
 * For humans: provide user_id and display_name.
 */
workspacesRouter.post('/:id/members', async (c) => {
  const supabase = createSupabaseClient(c.env)
  const workspaceId = c.req.param('id')
  const body = await c.req.json<{
    display_name: string
    role?: string
    user_id?: string
  }>()

  if (!body.display_name) {
    return c.json({ error: 'display_name is required' }, 400)
  }

  const role = body.role ?? 'reviewer'
  const validRoles = ['owner', 'reviewer', 'accountant', 'agent']
  if (!validRoles.includes(role)) {
    return c.json({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` }, 400)
  }

  // For agents, generate a random UUID as user_id placeholder
  const userId = body.user_id ?? crypto.randomUUID()

  const row: Record<string, unknown> = {
    workspace_id: workspaceId,
    user_id: userId,
    role,
  }

  // display_name may not exist in DB yet (V017 migration)
  const { data, error } = await supabase
    .from('workspace_memberships')
    .insert({ ...row, display_name: body.display_name })
    .select()
    .single()

  if (error) {
    if (error.message?.includes('display_name')) {
      const { data: fallback, error: fallbackErr } = await supabase
        .from('workspace_memberships')
        .insert(row)
        .select()
        .single()
      if (fallbackErr) return c.json({ error: fallbackErr.message }, 500)
      return c.json({ data: fallback }, 201)
    }
    return c.json({ error: error.message }, 500)
  }
  return c.json({ data }, 201)
})

/**
 * Update a workspace member (change display_name or role).
 */
workspacesRouter.patch('/:id/members/:memberId', async (c) => {
  const supabase = createSupabaseClient(c.env)
  const memberId = c.req.param('memberId')
  const body = await c.req.json<{
    display_name?: string
    role?: string
  }>()

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  if (body.display_name !== undefined) patch.display_name = body.display_name
  if (body.role !== undefined) patch.role = body.role

  const { data, error } = await supabase
    .from('workspace_memberships')
    .update(patch)
    .eq('id', memberId)
    .select()
    .single()

  if (error) return c.json({ error: error.message }, 500)
  return c.json({ data })
})

/**
 * Remove a member from a workspace.
 */
workspacesRouter.delete('/:id/members/:memberId', async (c) => {
  const supabase = createSupabaseClient(c.env)
  const memberId = c.req.param('memberId')

  const { error } = await supabase
    .from('workspace_memberships')
    .delete()
    .eq('id', memberId)

  if (error) return c.json({ error: error.message }, 500)
  return c.json({ success: true })
})
