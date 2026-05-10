import { Hono } from 'hono'
import { requireAuth, type AuthVariables } from '../lib/auth'
import { createSupabaseClient } from '../lib/supabase'
import { requireWorkspaceFeature, validFeatureAccess, type FeatureAccess } from '../lib/permissions'
import { sendTransactionalEmail } from '../lib/email'
import type { Env } from '../types/env'

type Bindings = Env
type Variables = AuthVariables

// ─── Email validation ─────────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const FRONTEND_BASE = 'https://kengs-landing.pages.dev'

async function sendInviteEmails(params: {
  env: Env
  supabase: ReturnType<typeof createSupabaseClient>
  workspaceId: string
  inviteEmail: string
  inviterUserId: string
  token: string
  expiresAt: string
}) {
  if (!params.env.RESEND_API_KEY || !params.env.EMAIL_FROM) {
    return
  }

  const frontendBase = params.env.FRONTEND_BASE_URL || FRONTEND_BASE
  const inviteUrl = `${frontendBase}/register/?token=${params.token}`

  const { data: workspace } = await params.supabase
    .from('workspaces')
    .select('name')
    .eq('id', params.workspaceId)
    .single()

  const workspaceName = workspace?.name || 'Keng\'s Landing'

  const inviteeSubject = `You're invited to join ${workspaceName}`
  const inviteeText = [
    `You're invited to join ${workspaceName}.`,
    '',
    `Email: ${params.inviteEmail}`,
    `Invite link: ${inviteUrl}`,
    `Expires: ${params.expiresAt}`,
  ].join('\n')
  const inviteeHtml = `<p>You're invited to join <strong>${workspaceName}</strong>.</p><p>Email: ${params.inviteEmail}</p><p><a href="${inviteUrl}">${inviteUrl}</a></p><p>Expires: ${params.expiresAt}</p>`

  await sendTransactionalEmail(params.env, {
    to: params.inviteEmail,
    subject: inviteeSubject,
    text: inviteeText,
    html: inviteeHtml,
  })

  const { data: inviter } = await params.supabase.auth.admin.getUserById(params.inviterUserId)
  const inviterEmail = inviter?.user?.email
  if (!inviterEmail) return

  const inviterSubject = `Invite sent to ${params.inviteEmail}`
  const inviterText = [
    `Your access grant was successfully sent for ${workspaceName}.`,
    '',
    `Invitee email: ${params.inviteEmail}`,
    `Invite link: ${inviteUrl}`,
    `Expires: ${params.expiresAt}`,
  ].join('\n')
  const inviterHtml = `<p>Your access grant was successfully sent for <strong>${workspaceName}</strong>.</p><p>Invitee email: ${params.inviteEmail}</p><p><a href="${inviteUrl}">${inviteUrl}</a></p><p>Expires: ${params.expiresAt}</p>`

  await sendTransactionalEmail(params.env, {
    to: inviterEmail,
    subject: inviterSubject,
    text: inviterText,
    html: inviterHtml,
  })
}

// ─── Public routes (no auth — token-based invite acceptance) ──────────────────

export const invitePublicRouter = new Hono<{ Bindings: Bindings }>()

/** Validate an invite token — powers the registration page */
invitePublicRouter.get('/:token', async (c) => {
  const token = c.req.param('token')
  const supabase = createSupabaseClient(c.env)

  const { data: invite, error } = await supabase
    .from('workspace_invites')
    .select(`
      id, email, status, expires_at, invited_at,
      workspace_id,
      role_id, custom_scopes
    `)
    .eq('token', token)
    .eq('status', 'pending')
    .single()

  if (error || !invite) {
    return c.json({ error: 'Invalid or expired invite' }, 404)
  }

  if (new Date(invite.expires_at) < new Date()) {
    return c.json({ error: 'This invite has expired' }, 410)
  }

  // Fetch workspace name
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('name')
    .eq('id', invite.workspace_id)
    .single()

  // Fetch role name if role_id is set
  let roleName: string | null = null
  if (invite.role_id) {
    const { data: role } = await supabase
      .from('workspace_roles')
      .select('name')
      .eq('id', invite.role_id)
      .single()
    roleName = role?.name ?? null
  }

  // Fetch inviter display name
  const { data: inviterMembership } = await supabase
    .from('workspace_memberships')
    .select('display_name')
    .eq('workspace_id', invite.workspace_id)
    .eq('user_id', invite.id) // invited_by not selected, use a separate query
    .single()

  // Re-fetch invited_by separately (not exposed in public response)
  const { data: inviteFull } = await supabase
    .from('workspace_invites')
    .select('invited_by')
    .eq('id', invite.id)
    .single()

  let inviterName: string | null = null
  if (inviteFull?.invited_by) {
    const { data: inviter } = await supabase
      .from('workspace_memberships')
      .select('display_name')
      .eq('workspace_id', invite.workspace_id)
      .eq('user_id', inviteFull.invited_by)
      .single()
    inviterName = inviter?.display_name ?? null
  }

  return c.json({
    data: {
      id: invite.id,
      email: invite.email,
      workspace_name: workspace?.name ?? 'Unknown workspace',
      role_name: roleName,
      invited_by_name: inviterName,
      expires_at: invite.expires_at,
    },
  })
})

/** Accept an invite — creates user + membership */
invitePublicRouter.post('/:token', async (c) => {
  const token = c.req.param('token')
  const supabase = createSupabaseClient(c.env)

  // Validate invite
  const { data: invite, error: inviteErr } = await supabase
    .from('workspace_invites')
    .select('id, email, workspace_id, role_id, custom_scopes, status, expires_at')
    .eq('token', token)
    .eq('status', 'pending')
    .single()

  if (inviteErr || !invite) {
    return c.json({ error: 'Invalid or expired invite' }, 404)
  }

  if (new Date(invite.expires_at) < new Date()) {
    return c.json({ error: 'This invite has expired' }, 410)
  }

  const body = await c.req.json<{
    first_name: string
    last_name: string
    password?: string
    use_magic_link?: boolean
  }>()

  if (!body.first_name?.trim() || !body.last_name?.trim()) {
    return c.json({ error: 'first_name and last_name are required' }, 400)
  }

  const displayName = `${body.first_name.trim()} ${body.last_name.trim()}`

  // Create Supabase auth user
  let userId: string
  let magicLink: string | null = null

  if (body.use_magic_link) {
    // Create user without password, generate magic link
    const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
      email: invite.email,
      email_confirm: true,
      user_metadata: { display_name: displayName },
    })
    if (createErr || !newUser.user) {
      if (createErr?.message?.includes('already been registered')) {
        return c.json({ error: 'A user with this email already exists' }, 409)
      }
      return c.json({ error: 'Failed to create user account' }, 500)
    }
    userId = newUser.user.id

    const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: invite.email,
    })
    if (!linkErr && linkData) {
      magicLink = linkData.properties?.action_link ?? null
    }
  } else {
    if (!body.password || body.password.length < 8) {
      return c.json({ error: 'Password must be at least 8 characters' }, 400)
    }

    const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
      email: invite.email,
      password: body.password,
      email_confirm: true,
      user_metadata: { display_name: displayName },
    })
    if (createErr || !newUser.user) {
      if (createErr?.message?.includes('already been registered')) {
        return c.json({ error: 'A user with this email already exists' }, 409)
      }
      return c.json({ error: 'Failed to create user account' }, 500)
    }
    userId = newUser.user.id
  }

  // Determine role + feature_access for membership
  let memberRole = 'custom'
  let featureAccess: FeatureAccess | null = null
  let roleId: string | null = invite.role_id

  if (invite.role_id) {
    const { data: role } = await supabase
      .from('workspace_roles')
      .select('scopes')
      .eq('id', invite.role_id)
      .single()
    featureAccess = (role?.scopes as FeatureAccess) ?? null
  } else if (invite.custom_scopes) {
    featureAccess = invite.custom_scopes as FeatureAccess
    roleId = null
  }

  // Create workspace membership
  const { error: memberErr } = await supabase
    .from('workspace_memberships')
    .insert({
      workspace_id: invite.workspace_id,
      user_id: userId,
      role: memberRole,
      role_id: roleId,
      display_name: displayName,
      email: invite.email,
      feature_access: featureAccess,
    })

  if (memberErr) {
    return c.json({ error: 'Failed to create workspace membership' }, 500)
  }

  // Mark invite as accepted
  const now = new Date().toISOString()
  await supabase
    .from('workspace_invites')
    .update({
      status: 'accepted',
      accepted_at: now,
      accepted_user_id: userId,
    })
    .eq('id', invite.id)

  // Log the acceptance event
  const cf = (c.req.raw as unknown as { cf?: Record<string, unknown> }).cf
  await supabase.from('user_access_log').insert({
    workspace_id: invite.workspace_id,
    user_id: userId,
    event_type: 'invite_accepted',
    ip_address: c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || null,
    user_agent: c.req.header('user-agent') || null,
    metadata: { invite_id: invite.id, cf_country: (cf?.country as string) || null },
  })

  return c.json({
    data: {
      user_id: userId,
      workspace_id: invite.workspace_id,
      display_name: displayName,
      magic_link: magicLink,
    },
  }, 201)
})

// ─── Admin routes (auth required) ─────────────────────────────────────────────

export const inviteAdminRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>()

inviteAdminRouter.use('*', requireAuth)

// ─── Custom Roles CRUD ────────────────────────────────────────────────────────

/** Create a custom role */
inviteAdminRouter.post('/roles', async (c) => {
  const supabase = createSupabaseClient(c.env)
  const body = await c.req.json<{
    workspace_id: string
    name: string
    description?: string
    scopes: FeatureAccess
  }>()

  const forbidden = await requireWorkspaceFeature(c, body.workspace_id, 'users', 'admin')
  if (forbidden) return forbidden

  if (!body.name?.trim()) {
    return c.json({ error: 'name is required' }, 400)
  }

  if (!validFeatureAccess(body.scopes)) {
    return c.json({ error: 'Invalid scopes — each key must be a valid feature and value must be none|read|write|admin' }, 400)
  }

  const { data, error } = await supabase
    .from('workspace_roles')
    .insert({
      workspace_id: body.workspace_id,
      name: body.name.trim(),
      description: body.description?.trim() || null,
      scopes: body.scopes,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') return c.json({ error: 'A role with that name already exists in this workspace' }, 409)
    return c.json({ error: 'Failed to create role' }, 500)
  }
  return c.json({ data }, 201)
})

/** List workspace roles (including system roles) */
inviteAdminRouter.get('/roles', async (c) => {
  const workspaceId = c.req.query('workspace_id')

  const forbidden = await requireWorkspaceFeature(c, workspaceId, 'users', 'read')
  if (forbidden) return forbidden

  const supabase = createSupabaseClient(c.env)
  const { data, error } = await supabase
    .from('workspace_roles')
    .select('*')
    .eq('workspace_id', workspaceId!)
    .order('is_system', { ascending: false })
    .order('name', { ascending: true })

  if (error) return c.json({ error: 'Failed to list roles' }, 500)
  return c.json({ data })
})

/** Update a custom role */
inviteAdminRouter.patch('/roles/:id', async (c) => {
  const roleId = c.req.param('id')
  const supabase = createSupabaseClient(c.env)

  // Fetch the role to check ownership and system flag
  const { data: existing, error: fetchErr } = await supabase
    .from('workspace_roles')
    .select('id, workspace_id, is_system')
    .eq('id', roleId)
    .single()

  if (fetchErr || !existing) return c.json({ error: 'Role not found' }, 404)
  if (existing.is_system) return c.json({ error: 'Cannot edit system roles' }, 403)

  const forbidden = await requireWorkspaceFeature(c, existing.workspace_id, 'users', 'admin')
  if (forbidden) return forbidden

  const body = await c.req.json<{
    name?: string
    description?: string
    scopes?: FeatureAccess
  }>()

  if (body.scopes !== undefined && !validFeatureAccess(body.scopes)) {
    return c.json({ error: 'Invalid scopes — each key must be a valid feature and value must be none|read|write|admin' }, 400)
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.name !== undefined) updates.name = body.name.trim()
  if (body.description !== undefined) updates.description = body.description?.trim() || null
  if (body.scopes !== undefined) updates.scopes = body.scopes

  const { data, error } = await supabase
    .from('workspace_roles')
    .update(updates)
    .eq('id', roleId)
    .select()
    .single()

  if (error) {
    if (error.code === '23505') return c.json({ error: 'A role with that name already exists in this workspace' }, 409)
    return c.json({ error: 'Failed to update role' }, 500)
  }
  return c.json({ data })
})

/** Delete a custom role */
inviteAdminRouter.delete('/roles/:id', async (c) => {
  const roleId = c.req.param('id')
  const supabase = createSupabaseClient(c.env)

  const { data: existing, error: fetchErr } = await supabase
    .from('workspace_roles')
    .select('id, workspace_id, is_system')
    .eq('id', roleId)
    .single()

  if (fetchErr || !existing) return c.json({ error: 'Role not found' }, 404)
  if (existing.is_system) return c.json({ error: 'Cannot delete system roles' }, 403)

  const forbidden = await requireWorkspaceFeature(c, existing.workspace_id, 'users', 'admin')
  if (forbidden) return forbidden

  const { error } = await supabase
    .from('workspace_roles')
    .delete()
    .eq('id', roleId)

  if (error) return c.json({ error: 'Failed to delete role' }, 500)
  return c.json({ success: true })
})

// ─── Invite Management ────────────────────────────────────────────────────────

/** Send an invite */
inviteAdminRouter.post('/', async (c) => {
  const userId = c.get('userId')
  const supabase = createSupabaseClient(c.env)

  const body = await c.req.json<{
    workspace_id: string
    email: string
    role_id?: string
    custom_scopes?: FeatureAccess
    expires_in_days?: number
  }>()

  const forbidden = await requireWorkspaceFeature(c, body.workspace_id, 'users', 'admin')
  if (forbidden) return forbidden

  // Validate email
  if (!body.email?.trim() || !EMAIL_RE.test(body.email.trim())) {
    return c.json({ error: 'A valid email address is required' }, 400)
  }

  const email = body.email.trim().toLowerCase()

  // Must provide exactly one of role_id or custom_scopes
  if (body.role_id && body.custom_scopes) {
    return c.json({ error: 'Provide either role_id or custom_scopes, not both' }, 400)
  }
  if (!body.role_id && !body.custom_scopes) {
    return c.json({ error: 'Either role_id or custom_scopes is required' }, 400)
  }

  // Validate role_id exists
  if (body.role_id) {
    const { data: role, error: roleErr } = await supabase
      .from('workspace_roles')
      .select('id')
      .eq('id', body.role_id)
      .eq('workspace_id', body.workspace_id)
      .single()

    if (roleErr || !role) return c.json({ error: 'Role not found in this workspace' }, 404)
  }

  // Validate custom_scopes
  if (body.custom_scopes && !validFeatureAccess(body.custom_scopes)) {
    return c.json({ error: 'Invalid custom_scopes — each key must be a valid feature and value must be none|read|write|admin' }, 400)
  }

  // Check for existing pending invite to same email in same workspace
  const { data: existingInvite } = await supabase
    .from('workspace_invites')
    .select('id')
    .eq('workspace_id', body.workspace_id)
    .ilike('email', email)
    .eq('status', 'pending')
    .single()

  if (existingInvite) {
    return c.json({ error: 'A pending invite already exists for this email in this workspace' }, 409)
  }

  // Generate secure token
  const token = 'kl_inv_' + crypto.randomUUID().replace(/-/g, '')

  // Calculate expiry
  const expiresInDays = body.expires_in_days ?? 7
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('workspace_invites')
    .insert({
      workspace_id: body.workspace_id,
      email,
      token,
      role_id: body.role_id || null,
      custom_scopes: body.custom_scopes || null,
      invited_by: userId,
      expires_at: expiresAt,
    })
    .select()
    .single()

  if (error) return c.json({ error: 'Failed to create invite' }, 500)

  await sendInviteEmails({
    env: c.env,
    supabase,
    workspaceId: body.workspace_id,
    inviteEmail: email,
    inviterUserId: userId,
    token,
    expiresAt,
  }).catch((emailErr) => console.warn('invite email send failed:', emailErr))

  return c.json({
    data: {
      ...data,
      invite_url: `/invites/accept/${token}`,
    },
  }, 201)
})

/** List invites for a workspace */
inviteAdminRouter.get('/', async (c) => {
  const workspaceId = c.req.query('workspace_id')
  const status = c.req.query('status')

  const forbidden = await requireWorkspaceFeature(c, workspaceId, 'users', 'admin')
  if (forbidden) return forbidden

  const supabase = createSupabaseClient(c.env)

  let query = supabase
    .from('workspace_invites')
    .select('*')
    .eq('workspace_id', workspaceId!)
    .order('invited_at', { ascending: false })

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query

  if (error) return c.json({ error: 'Failed to list invites' }, 500)
  return c.json({ data })
})

/** Revoke a pending invite */
inviteAdminRouter.patch('/:id/revoke', async (c) => {
  const inviteId = c.req.param('id')
  const supabase = createSupabaseClient(c.env)

  // Fetch invite to check workspace + status
  const { data: invite, error: fetchErr } = await supabase
    .from('workspace_invites')
    .select('id, workspace_id, status')
    .eq('id', inviteId)
    .single()

  if (fetchErr || !invite) return c.json({ error: 'Invite not found' }, 404)

  const forbidden = await requireWorkspaceFeature(c, invite.workspace_id, 'users', 'admin')
  if (forbidden) return forbidden

  if (invite.status !== 'pending') {
    return c.json({ error: `Cannot revoke an invite with status '${invite.status}'` }, 400)
  }

  const { data, error } = await supabase
    .from('workspace_invites')
    .update({ status: 'revoked', revoked_at: new Date().toISOString() })
    .eq('id', inviteId)
    .select()
    .single()

  if (error) return c.json({ error: 'Failed to revoke invite' }, 500)
  return c.json({ data })
})

/** Resend an invite — generates new token, resets expiry */
inviteAdminRouter.post('/:id/resend', async (c) => {
  const inviteId = c.req.param('id')
  const supabase = createSupabaseClient(c.env)

  const { data: invite, error: fetchErr } = await supabase
    .from('workspace_invites')
    .select('id, workspace_id, status')
    .eq('id', inviteId)
    .single()

  if (fetchErr || !invite) return c.json({ error: 'Invite not found' }, 404)

  const forbidden = await requireWorkspaceFeature(c, invite.workspace_id, 'users', 'admin')
  if (forbidden) return forbidden

  if (invite.status !== 'pending') {
    return c.json({ error: `Cannot resend an invite with status '${invite.status}'` }, 400)
  }

  const newToken = 'kl_inv_' + crypto.randomUUID().replace(/-/g, '')
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('workspace_invites')
    .update({ token: newToken, expires_at: expiresAt })
    .eq('id', inviteId)
    .select()
    .single()

  if (error) return c.json({ error: 'Failed to resend invite' }, 500)

  const inviteEmail = (data as { email?: string } | null)?.email
  const workspaceId = invite.workspace_id
  if (inviteEmail) {
    await sendInviteEmails({
      env: c.env,
      supabase,
      workspaceId,
      inviteEmail,
      inviterUserId: c.get('userId'),
      token: newToken,
      expiresAt,
    }).catch((emailErr) => console.warn('invite resend email failed:', emailErr))
  }

  return c.json({
    data: {
      ...data,
      invite_url: `/invites/accept/${newToken}`,
    },
  })
})

// ─── Access Log ───────────────────────────────────────────────────────────────

/** Get user access history */
inviteAdminRouter.get('/access-log', async (c) => {
  const workspaceId = c.req.query('workspace_id')
  const userIdFilter = c.req.query('user_id')
  const eventType = c.req.query('event_type')
  const limitParam = c.req.query('limit')

  const forbidden = await requireWorkspaceFeature(c, workspaceId, 'users', 'admin')
  if (forbidden) return forbidden

  const supabase = createSupabaseClient(c.env)
  const limit = Math.min(parseInt(limitParam || '50', 10) || 50, 200)

  let query = supabase
    .from('user_access_log')
    .select('*')
    .eq('workspace_id', workspaceId!)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (userIdFilter) query = query.eq('user_id', userIdFilter)
  if (eventType) query = query.eq('event_type', eventType)

  const { data, error } = await query

  if (error) return c.json({ error: 'Failed to fetch access log' }, 500)
  return c.json({ data })
})
