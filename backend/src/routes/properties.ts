import { Hono } from 'hono'
import { requireAuth, type AuthVariables } from '../lib/auth'
import { createSupabaseClient } from '../lib/supabase'
import type { Env } from '../types/env'

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
  const body = await c.req.json<{
    workspace_id: string
    name: string
    code: string
    placed_in_service_date?: string
    ownership_type?: string
    market?: string
    notes?: string
  }>()

  const { data, error } = await supabase.from('properties').insert(body).select().single()
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ data }, 201)
})

/** Get a single property */
propertiesRouter.get('/:id', async (c) => {
  const supabase = createSupabaseClient(c.env)
  const { data, error } = await supabase
    .from('properties')
    .select('*')
    .eq('id', c.req.param('id'))
    .single()

  if (error) return c.json({ error: 'Not found' }, 404)
  return c.json({ data })
})

/** Update a property */
propertiesRouter.patch('/:id', async (c) => {
  const supabase = createSupabaseClient(c.env)
  const body = await c.req.json<Partial<{
    name: string
    code: string
    placed_in_service_date: string
    ownership_type: string
    market: string
    notes: string
  }>>()

  const { data, error } = await supabase
    .from('properties')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', c.req.param('id'))
    .select()
    .single()

  if (error) return c.json({ error: error.message }, 500)
  return c.json({ data })
})
