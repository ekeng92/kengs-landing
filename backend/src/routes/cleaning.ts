import { Hono } from 'hono'
import { requireAuth, type AuthVariables } from '../lib/auth'
import { createSupabaseClient } from '../lib/supabase'
import type { Env } from '../types/env'

type Bindings = Env
type Variables = AuthVariables

// ─── Public routes (no auth — token-based access) ─────────────────────────────

export const cleanPublicRouter = new Hono<{ Bindings: Bindings }>()

/** Validate token and create a new cleaning session */
cleanPublicRouter.get('/:token', async (c) => {
  const token = c.req.param('token')
  const supabase = createSupabaseClient(c.env)

  // Look up the cleaning link
  const { data: link, error: linkError } = await supabase
    .from('cleaning_links')
    .select('id, property_id, workspace_id, cleaner_name, cleaning_type, is_active, expires_at')
    .eq('token', token)
    .single()

  if (linkError || !link) {
    return c.json({ error: 'Invalid or expired link' }, 404)
  }

  if (!link.is_active) {
    return c.json({ error: 'This cleaning link has been deactivated' }, 403)
  }

  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    return c.json({ error: 'This cleaning link has expired' }, 403)
  }

  // Rate limit: max 10 sessions per token per day
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { count } = await supabase
    .from('cleaning_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('link_id', link.id)
    .gte('opened_at', dayAgo)

  if ((count ?? 0) >= 10) {
    return c.json({ error: 'Too many sessions today. Please try again tomorrow.' }, 429)
  }

  // Get property name if linked
  let propertyName = 'Property'
  if (link.property_id) {
    const { data: prop } = await supabase
      .from('properties')
      .select('name')
      .eq('id', link.property_id)
      .single()
    if (prop) propertyName = prop.name
  }

  // Extract Cloudflare request metadata
  const cf = (c.req.raw as unknown as { cf?: Record<string, unknown> }).cf
  const ipAddress = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || ''
  const city = (cf?.city as string) || ''
  const country = (cf?.country as string) || ''
  const cfTimezone = (cf?.timezone as string) || ''
  const userAgent = c.req.header('user-agent') || ''

  // Create a new cleaning session
  const { data: session, error: sessionError } = await supabase
    .from('cleaning_sessions')
    .insert({
      link_id: link.id,
      workspace_id: link.workspace_id,
      ip_address: ipAddress,
      city,
      country,
      timezone: cfTimezone,
      user_agent: userAgent,
      status: 'in_progress',
    })
    .select('id, opened_at')
    .single()

  if (sessionError) {
    return c.json({ error: 'Failed to create cleaning session' }, 500)
  }

  return c.json({
    session_id: session.id,
    property_name: propertyName,
    cleaner_name: link.cleaner_name,
    cleaning_type: link.cleaning_type,
    opened_at: session.opened_at,
  })
})

/** Submit completed checklist */
cleanPublicRouter.post('/:token/submit', async (c) => {
  const token = c.req.param('token')
  const supabase = createSupabaseClient(c.env)

  // Validate token
  const { data: link, error: linkError } = await supabase
    .from('cleaning_links')
    .select('id, is_active')
    .eq('token', token)
    .single()

  if (linkError || !link || !link.is_active) {
    return c.json({ error: 'Invalid or expired link' }, 404)
  }

  const body = await c.req.json()
  const {
    session_id,
    items,
    notes,
    completed_by,
    cleaned_date,
    client_metadata,
  } = body as {
    session_id: string
    items: Array<{ key: string; label: string; section: string; checked: boolean; checked_at?: string }>
    notes?: string
    completed_by?: string
    cleaned_date?: string
    client_metadata?: {
      screen_size?: string
      language?: string
      connection_type?: string
      timezone?: string
      latitude?: number
      longitude?: number
      geo_accuracy?: number
      referrer?: string
    }
  }

  if (!session_id || !Array.isArray(items)) {
    return c.json({ error: 'session_id and items[] are required' }, 400)
  }

  // Verify session exists and belongs to this token's link
  const { data: session, error: sessionError } = await supabase
    .from('cleaning_sessions')
    .select('id, link_id, status')
    .eq('id', session_id)
    .single()

  if (sessionError || !session) {
    return c.json({ error: 'Session not found' }, 404)
  }

  if (session.link_id !== link.id) {
    return c.json({ error: 'Session does not belong to this link' }, 403)
  }

  if (session.status === 'submitted') {
    return c.json({ error: 'This session has already been submitted' }, 409)
  }

  // Update session with submission data
  const now = new Date().toISOString()
  const updateData: Record<string, unknown> = {
    submitted_at: now,
    status: 'submitted',
    notes: notes || null,
    completed_by: completed_by || null,
    cleaned_date: cleaned_date || null,
  }

  if (client_metadata) {
    if (client_metadata.screen_size) updateData.screen_size = client_metadata.screen_size
    if (client_metadata.language) updateData.language = client_metadata.language
    if (client_metadata.connection_type) updateData.connection_type = client_metadata.connection_type
    if (client_metadata.timezone) updateData.timezone = client_metadata.timezone
    if (client_metadata.latitude != null) updateData.latitude = client_metadata.latitude
    if (client_metadata.longitude != null) updateData.longitude = client_metadata.longitude
    if (client_metadata.geo_accuracy != null) updateData.geo_accuracy = client_metadata.geo_accuracy
    if (client_metadata.referrer) updateData.referrer = client_metadata.referrer
  }

  const { error: updateError } = await supabase
    .from('cleaning_sessions')
    .update(updateData)
    .eq('id', session_id)

  if (updateError) {
    return c.json({ error: 'Failed to update session' }, 500)
  }

  // Insert checklist items
  if (items.length > 0) {
    const rows = items.map((item) => ({
      session_id,
      item_key: item.key,
      item_label: item.label,
      section: item.section || null,
      checked: item.checked,
      checked_at: item.checked ? (item.checked_at || now) : null,
    }))

    const { error: itemsError } = await supabase
      .from('cleaning_items')
      .insert(rows)

    if (itemsError) {
      return c.json({ error: 'Failed to save checklist items' }, 500)
    }
  }

  const checkedCount = items.filter((i) => i.checked).length
  return c.json({
    success: true,
    session_id,
    submitted_at: now,
    summary: {
      total_items: items.length,
      checked: checkedCount,
      unchecked: items.length - checkedCount,
    },
  })
})

/** List pending property tasks for this cleaning link's property */
cleanPublicRouter.get('/:token/tasks', async (c) => {
  const token = c.req.param('token')
  const supabase = createSupabaseClient(c.env)

  const { data: link, error: linkError } = await supabase
    .from('cleaning_links')
    .select('id, property_id, is_active, expires_at')
    .eq('token', token)
    .single()

  if (linkError || !link) {
    return c.json({ error: 'Invalid or expired link' }, 404)
  }

  if (!link.is_active) {
    return c.json({ error: 'This cleaning link has been deactivated' }, 403)
  }

  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    return c.json({ error: 'This cleaning link has expired' }, 403)
  }

  if (!link.property_id) {
    return c.json({ data: [] })
  }

  const { data, error } = await supabase
    .from('property_tasks')
    .select('id, title, description, priority, due_date, status')
    .eq('property_id', link.property_id)
    .in('status', ['pending', 'in_progress'])
    .order('priority', { ascending: true })
    .order('created_at', { ascending: false })

  if (error) {
    return c.json({ error: 'Failed to fetch tasks' }, 500)
  }

  return c.json({ data: data || [] })
})

/** Mark a property task as completed by the cleaner */
cleanPublicRouter.patch('/:token/tasks/:taskId/complete', async (c) => {
  const token = c.req.param('token')
  const taskId = c.req.param('taskId')
  const supabase = createSupabaseClient(c.env)

  const { data: link, error: linkError } = await supabase
    .from('cleaning_links')
    .select('id, property_id, cleaner_name, is_active, expires_at')
    .eq('token', token)
    .single()

  if (linkError || !link) {
    return c.json({ error: 'Invalid or expired link' }, 404)
  }

  if (!link.is_active) {
    return c.json({ error: 'This cleaning link has been deactivated' }, 403)
  }

  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    return c.json({ error: 'This cleaning link has expired' }, 403)
  }

  // Verify task exists and belongs to the same property
  const { data: task, error: taskError } = await supabase
    .from('property_tasks')
    .select('id, property_id, status')
    .eq('id', taskId)
    .single()

  if (taskError || !task) {
    return c.json({ error: 'Task not found' }, 404)
  }

  if (task.property_id !== link.property_id) {
    return c.json({ error: 'Task does not belong to this property' }, 403)
  }

  if (task.status === 'completed') {
    return c.json({ error: 'Task is already completed' }, 409)
  }

  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('property_tasks')
    .update({
      status: 'completed',
      completed_by: link.cleaner_name,
      completed_at: now,
      updated_at: now,
    })
    .eq('id', taskId)
    .select()
    .single()

  if (error) {
    return c.json({ error: 'Failed to complete task' }, 500)
  }

  return c.json({ success: true, data })
})

// ─── Admin routes (auth required) ─────────────────────────────────────────────

export const cleaningAdminRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>()

cleaningAdminRouter.use('*', requireAuth)

/** Create a new cleaning link */
cleaningAdminRouter.post('/links', async (c) => {
  const supabase = createSupabaseClient(c.env)
  const body = await c.req.json()

  const { workspace_id, property_id, cleaner_name, cleaner_contact, cleaning_type, expires_at, list_id } = body as {
    workspace_id: string
    property_id?: string
    cleaner_name: string
    cleaner_contact?: string
    cleaning_type?: string
    expires_at?: string
    list_id?: string
  }

  if (!workspace_id || !cleaner_name) {
    return c.json({ error: 'workspace_id and cleaner_name are required' }, 400)
  }

  // Generate a secure random token
  const token = 'kl_c_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16)

  const { data, error } = await supabase
    .from('cleaning_links')
    .insert({
      token,
      property_id: property_id || null,
      workspace_id,
      cleaner_name,
      cleaner_contact: cleaner_contact || null,
      cleaning_type: cleaning_type || 'all',
      list_id: list_id || null,
      expires_at: expires_at || null,
    })
    .select()
    .single()

  if (error) {
    return c.json({ error: 'Failed to create cleaning link' }, 500)
  }

  return c.json(data, 201)
})

/** List cleaning links for a workspace */
cleaningAdminRouter.get('/links', async (c) => {
  const supabase = createSupabaseClient(c.env)
  const workspaceId = c.req.query('workspace_id')

  if (!workspaceId) {
    return c.json({ error: 'workspace_id is required' }, 400)
  }

  const { data, error } = await supabase
    .from('cleaning_links')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })

  if (error) {
    return c.json({ error: 'Failed to fetch cleaning links' }, 500)
  }

  return c.json({ data })
})

/** Deactivate a cleaning link */
cleaningAdminRouter.patch('/links/:id', async (c) => {
  const id = c.req.param('id')
  const supabase = createSupabaseClient(c.env)
  const body = await c.req.json()

  const { is_active, list_id } = body as { is_active?: boolean; list_id?: string }

  const updates: Record<string, unknown> = {}
  if (is_active !== undefined) updates.is_active = is_active
  if (list_id !== undefined) updates.list_id = list_id

  const { data, error } = await supabase
    .from('cleaning_links')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return c.json({ error: 'Failed to update cleaning link' }, 500)
  }

  return c.json(data)
})

/** List cleaning sessions (history) for a workspace */
cleaningAdminRouter.get('/sessions', async (c) => {
  const supabase = createSupabaseClient(c.env)
  const workspaceId = c.req.query('workspace_id')
  const linkId = c.req.query('link_id')

  if (!workspaceId) {
    return c.json({ error: 'workspace_id is required' }, 400)
  }

  let query = supabase
    .from('cleaning_sessions')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('opened_at', { ascending: false })

  if (linkId) {
    query = query.eq('link_id', linkId)
  }

  const { data, error } = await query

  if (error) {
    return c.json({ error: 'Failed to fetch cleaning sessions' }, 500)
  }

  return c.json({ data })
})

/** Get session detail with items */
cleaningAdminRouter.get('/sessions/:id', async (c) => {
  const id = c.req.param('id')
  const supabase = createSupabaseClient(c.env)

  const { data: session, error: sessionError } = await supabase
    .from('cleaning_sessions')
    .select('*')
    .eq('id', id)
    .single()

  if (sessionError || !session) {
    return c.json({ error: 'Session not found' }, 404)
  }

  const { data: items, error: itemsError } = await supabase
    .from('cleaning_items')
    .select('*')
    .eq('session_id', id)
    .order('section', { ascending: true })

  if (itemsError) {
    return c.json({ error: 'Failed to fetch session items' }, 500)
  }

  return c.json({ ...session, items: items || [] })
})
