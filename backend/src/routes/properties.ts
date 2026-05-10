import { Hono } from 'hono'
import { requireAuth, type AuthVariables } from '../lib/auth'
import { createSupabaseClient } from '../lib/supabase'
import { requireWorkspaceFeature } from '../lib/permissions'
import type { Env } from '../types/env'
import {
  CreatePropertyBody,
  UpdatePropertyBody,
  formatZodError,
  mapDbError,
} from '../lib/validation'

type Bindings = Env
type Variables = AuthVariables

export const propertiesRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>()

propertiesRouter.use('*', requireAuth)

/** List properties for a workspace */
propertiesRouter.get('/', async (c) => {
  const supabase = createSupabaseClient(c.env)
  const workspaceId = c.req.query('workspace_id')

  if (!workspaceId) return c.json({ error: 'workspace_id is required' }, 400)

  const { data, error } = await supabase
    .from('properties')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('name')

  if (error) return c.json({ error: error.message }, 500)
  return c.json({ data })
})

/** Create a property within a workspace */
propertiesRouter.post('/', async (c) => {
  const supabase = createSupabaseClient(c.env)

  const raw = await c.req.json().catch(() => null)
  if (!raw) return c.json({ error: 'Invalid JSON' }, 400)

  const parsed = CreatePropertyBody.safeParse(raw)
  if (!parsed.success) return c.json({ error: formatZodError(parsed.error) }, 400)

  const body = parsed.data

  const { data, error } = await supabase.from('properties').insert(body).select().single()
  if (error) {
    const mapped = mapDbError(error)
    return c.json({ error: mapped.message }, mapped.status as any)
  }
  return c.json({ data }, 201)
})

/** Get a single property */
propertiesRouter.get('/:id', async (c) => {
  const supabase = createSupabaseClient(c.env)
  const id = c.req.param('id')

  const { data: existing, error: existingError } = await supabase
    .from('properties')
    .select('workspace_id')
    .eq('id', id)
    .single()

  if (existingError || !existing) return c.json({ error: 'Not found' }, 404)

  const forbidden = await requireWorkspaceFeature(c, existing.workspace_id, 'properties', 'read')
  if (forbidden) return forbidden

  const { data, error } = await supabase
    .from('properties')
    .select('*')
    .eq('id', id)
    .single()

  if (error) return c.json({ error: 'Not found' }, 404)
  return c.json({ data })
})

/** Update a property */
propertiesRouter.patch('/:id', async (c) => {
  const supabase = createSupabaseClient(c.env)

  const raw = await c.req.json().catch(() => null)
  if (!raw) return c.json({ error: 'Invalid JSON' }, 400)

  const parsed = UpdatePropertyBody.safeParse(raw)
  if (!parsed.success) return c.json({ error: formatZodError(parsed.error) }, 400)

  const body = parsed.data

  const { data, error } = await supabase
    .from('properties')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', c.req.param('id'))
    .select()
    .single()

  if (error) {
    const mapped = mapDbError(error)
    return c.json({ error: mapped.message }, mapped.status as any)
  }
  return c.json({ data })
})
