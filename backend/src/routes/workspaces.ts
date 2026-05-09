import { Hono } from 'hono'
import { requireAuth, type AuthVariables } from '../lib/auth'
import { createSupabaseClient } from '../lib/supabase'
import { requireWorkspaceFeature, validFeatureAccess, VALID_ROLES, type FeatureAccess } from '../lib/permissions'
import type { Env } from '../types/env'

type Bindings = Env
type Variables = AuthVariables

export const workspacesRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>()

workspacesRouter.use('*', requireAuth)

/** List workspaces the authenticated user belongs to */
workspacesRouter.get('/', async (c) => {
  const userId = c.get('userId')
  const supabase = createSupabaseClient(c.env)

  const { data, error } = await supabase
    .from('workspace_memberships')
    .select('workspace_id, role, display_name, email, feature_access, workspaces(*)')
    .eq('user_id', userId)

  if (error) return c.json({ error: error.message }, 500)
  return c.json({ data })
})

/** Create a new workspace and assign the creator as owner */
workspacesRouter.post('/', async (c) => {
  const userId = c.get('userId')
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
  const userId = c.get('userId')
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
  const supabase = createSupabaseClient(c.env)
  const id = c.req.param('id')
  const body = await c.req.json<{ name?: string }>()

  const forbidden = await requireWorkspaceFeature(c, id, 'settings', 'admin')
  if (forbidden) return forbidden

  const { data, error } = await supabase
    .from('workspaces')
    .update({ name: body.name, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return c.json({ error: error.message }, 500)
  return c.json({ data })
})

// ─── User Profile (self-service) ──────────────────────────────────────────────

/**
 * Get the authenticated user's own membership in a workspace.
 * No admin permission required — users can always read their own profile.
 */
workspacesRouter.get('/:id/profile', async (c) => {
  const supabase = createSupabaseClient(c.env)
  const workspaceId = c.req.param('id')
  const userId = c.get('userId')

  const { data, error } = await supabase
    .from('workspace_memberships')
    .select('id, user_id, role, display_name, email, feature_access, created_at, updated_at')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return c.json({ error: 'Not a member of this workspace' }, 404)
    return c.json({ error: error.message }, 500)
  }
  return c.json({ data })
})

/**
 * Update the authenticated user's own display_name.
 * No admin permission required — users can always update their own profile.
 */
workspacesRouter.patch('/:id/profile', async (c) => {
  const supabase = createSupabaseClient(c.env)
  const workspaceId = c.req.param('id')
  const userId = c.get('userId')

  const body = await c.req.json<{ display_name?: string }>()

  if (!body.display_name || typeof body.display_name !== 'string' || body.display_name.trim().length === 0) {
    return c.json({ error: 'display_name is required and must be a non-empty string' }, 400)
  }

  if (body.display_name.length > 200) {
    return c.json({ error: 'display_name must be 200 characters or less' }, 400)
  }

  const { data, error } = await supabase
    .from('workspace_memberships')
    .update({ display_name: body.display_name.trim(), updated_at: new Date().toISOString() })
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) {
    if (error.code === 'PGRST116') return c.json({ error: 'Not a member of this workspace' }, 404)
    return c.json({ error: error.message }, 500)
  }
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

  const forbidden = await requireWorkspaceFeature(c, workspaceId, 'users', 'read')
  if (forbidden) return forbidden

  const { data, error } = await supabase
    .from('workspace_memberships')
    .select('id, user_id, role, display_name, email, feature_access, created_at, updated_at')
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
 * Humans can be added by existing Supabase user_id, or by email invite when Supabase Admin is available.
 * Agents can use role='agent' and omit user_id; a placeholder UUID is generated.
 */
workspacesRouter.post('/:id/members', async (c) => {
  const supabase = createSupabaseClient(c.env)
  const workspaceId = c.req.param('id')

  const forbidden = await requireWorkspaceFeature(c, workspaceId, 'users', 'admin')
  if (forbidden) return forbidden

  const body = await c.req.json<{
    display_name?: string
    email?: string
    role?: string
    user_id?: string
    feature_access?: FeatureAccess
    send_invite?: boolean
  }>()

  const role = body.role ?? 'reviewer'
  if (!VALID_ROLES.includes(role)) {
    return c.json({ error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` }, 400)
  }
  if (!validFeatureAccess(body.feature_access)) {
    return c.json({ error: 'Invalid feature_access. Values must be one of: none, read, write, admin' }, 400)
  }

  const displayName = body.display_name || body.email || (role === 'agent' ? 'Agent' : '')
  if (!displayName) return c.json({ error: 'display_name or email is required' }, 400)

  let userId = body.user_id
  if (!userId && role === 'agent') userId = crypto.randomUUID()

  if (!userId && body.email) {
    const admin = (supabase as any).auth?.admin
    if (!admin?.inviteUserByEmail) {
      return c.json({ error: 'user_id is required when email invite is unavailable' }, 400)
    }
    const invite = await admin.inviteUserByEmail(body.email)
    if (invite.error || !invite.data?.user?.id) {
      return c.json({ error: invite.error?.message ?? 'Failed to invite user' }, 500)
    }
    userId = invite.data.user.id
  }

  if (!userId) return c.json({ error: 'user_id or email is required' }, 400)

  const row: Record<string, unknown> = {
    workspace_id: workspaceId,
    user_id: userId,
    role,
    display_name: displayName,
    email: body.email ?? null,
    feature_access: body.feature_access ?? {},
  }

  const { data, error } = await supabase
    .from('workspace_memberships')
    .insert(row)
    .select()
    .single()

  if (error) return c.json({ error: error.message }, 500)
  return c.json({ data }, 201)
})

/**
 * Update a workspace member (display name, role, email, or feature access).
 */
workspacesRouter.patch('/:id/members/:memberId', async (c) => {
  const supabase = createSupabaseClient(c.env)
  const workspaceId = c.req.param('id')
  const memberId = c.req.param('memberId')

  const forbidden = await requireWorkspaceFeature(c, workspaceId, 'users', 'admin')
  if (forbidden) return forbidden

  const body = await c.req.json<{
    display_name?: string
    email?: string | null
    role?: string
    feature_access?: FeatureAccess
  }>()

  if (body.role !== undefined && !VALID_ROLES.includes(body.role)) {
    return c.json({ error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` }, 400)
  }
  if (!validFeatureAccess(body.feature_access)) {
    return c.json({ error: 'Invalid feature_access. Values must be one of: none, read, write, admin' }, 400)
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.display_name !== undefined) patch.display_name = body.display_name
  if (body.email !== undefined) patch.email = body.email
  if (body.role !== undefined) patch.role = body.role
  if (body.feature_access !== undefined) patch.feature_access = body.feature_access

  const { data, error } = await supabase
    .from('workspace_memberships')
    .update(patch)
    .eq('id', memberId)
    .eq('workspace_id', workspaceId)
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
  const workspaceId = c.req.param('id')
  const memberId = c.req.param('memberId')

  const forbidden = await requireWorkspaceFeature(c, workspaceId, 'users', 'admin')
  if (forbidden) return forbidden

  const { error } = await supabase
    .from('workspace_memberships')
    .delete()
    .eq('id', memberId)
    .eq('workspace_id', workspaceId)

  if (error) return c.json({ error: error.message }, 500)
  return c.json({ success: true })
})
