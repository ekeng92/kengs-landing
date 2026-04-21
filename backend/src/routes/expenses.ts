import { Hono } from 'hono'
import { requireAuth, type AuthVariables } from '../lib/auth'
import { createSupabaseClient } from '../lib/supabase'
import type { Env } from '../types/env'
import type { ExpenseReviewState, RecordStatus } from '../types/schema'

type Bindings = Env
type Variables = AuthVariables

export const expensesRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>()

expensesRouter.use('*', requireAuth)

/**
 * List expenses with workspace scope and optional filters.
 * T5 (expense import) will extend: import_job filtering, promoted row linking.
 */
expensesRouter.get('/', async (c) => {
  const supabase = createSupabaseClient(c.env)
  const workspaceId = c.req.query('workspace_id')
  const propertyId = c.req.query('property_id')
  const reviewState = c.req.query('review_state') as ExpenseReviewState | undefined
  const status = c.req.query('status') as RecordStatus | undefined

  if (!workspaceId) return c.json({ error: 'workspace_id is required' }, 400)

  let query = supabase.from('expenses').select('*').eq('workspace_id', workspaceId)

  if (propertyId) query = query.eq('property_id', propertyId)
  if (reviewState) query = query.eq('review_state', reviewState)
  if (status) query = query.eq('status', status)

  const { data, error } = await query.order('transaction_date', { ascending: false })

  if (error) return c.json({ error: error.message }, 500)
  return c.json({ data })
})

/** Create a single expense record */
expensesRouter.post('/', async (c) => {
  const supabase = createSupabaseClient(c.env)
  const body = await c.req.json()

  const { data, error } = await supabase.from('expenses').insert(body).select().single()
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ data }, 201)
})

/** Get a single expense */
expensesRouter.get('/:id', async (c) => {
  const supabase = createSupabaseClient(c.env)
  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('id', c.req.param('id'))
    .single()

  if (error) return c.json({ error: 'Not found' }, 404)
  return c.json({ data })
})

/**
 * Update an expense (review_state, category, description, etc.).
 * Classification changes must create an audit_event — T5 will wire this.
 */
expensesRouter.patch('/:id', async (c) => {
  const supabase = createSupabaseClient(c.env)
  const body = await c.req.json()

  const { data, error } = await supabase
    .from('expenses')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', c.req.param('id'))
    .select()
    .single()

  if (error) return c.json({ error: error.message }, 500)
  return c.json({ data })
})

/**
 * Commit an expense to reportable status.
 * Only draft expenses may be committed. Committed expenses feed Slice 3 reporting.
 */
expensesRouter.patch('/:id/commit', async (c) => {
  const supabase = createSupabaseClient(c.env)
  const id = c.req.param('id')

  const { data: existing } = await supabase
    .from('expenses')
    .select('status')
    .eq('id', id)
    .single()

  if (!existing) return c.json({ error: 'Not found' }, 404)
  if (existing.status !== 'draft') {
    return c.json({ error: `Cannot commit expense with status: ${existing.status}` }, 422)
  }

  const { data, error } = await supabase
    .from('expenses')
    .update({ status: 'committed', updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return c.json({ error: error.message }, 500)
  return c.json({ data })
})
