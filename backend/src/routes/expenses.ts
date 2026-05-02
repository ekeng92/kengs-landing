import { Hono } from 'hono'
import { requireAuth, type AuthVariables } from '../lib/auth'
import { createSupabaseClient } from '../lib/supabase'
import type { Env } from '../types/env'
import {
  ExpenseListQuery,
  CreateExpenseBody,
  UpdateExpenseBody,
  formatZodError,
  mapDbError,
} from '../lib/validation'

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

  const parsed = ExpenseListQuery.safeParse({
    workspace_id: c.req.query('workspace_id'),
    property_id: c.req.query('property_id') || undefined,
    review_state: c.req.query('review_state') || undefined,
    status: c.req.query('status') || undefined,
    limit: c.req.query('limit') || undefined,
    offset: c.req.query('offset') || undefined,
  })

  if (!parsed.success) return c.json({ error: formatZodError(parsed.error) }, 400)

  const { workspace_id, property_id, review_state, status, limit, offset } = parsed.data

  let query = supabase.from('expenses').select('*', { count: 'exact' }).eq('workspace_id', workspace_id)

  if (property_id) query = query.eq('property_id', property_id)
  if (review_state) query = query.eq('review_state', review_state)
  if (status) query = query.eq('status', status)

  const { data, error, count } = await query
    .order('transaction_date', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    const mapped = mapDbError(error)
    return c.json({ error: mapped.message }, mapped.status as any)
  }
  return c.json({ data, total: count, limit, offset })
})

/** Create a single expense record */
expensesRouter.post('/', async (c) => {
  const supabase = createSupabaseClient(c.env)

  const raw = await c.req.json().catch(() => null)
  if (!raw) return c.json({ error: 'Invalid JSON' }, 400)

  const parsed = CreateExpenseBody.safeParse(raw)
  if (!parsed.success) return c.json({ error: formatZodError(parsed.error) }, 400)

  const body = parsed.data

  const { data, error } = await supabase.from('expenses').insert(body).select().single()
  if (error) {
    const mapped = mapDbError(error)
    return c.json({ error: mapped.message }, mapped.status as any)
  }
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

  const raw = await c.req.json().catch(() => null)
  if (!raw) return c.json({ error: 'Invalid JSON' }, 400)

  const parsed = UpdateExpenseBody.safeParse(raw)
  if (!parsed.success) return c.json({ error: formatZodError(parsed.error) }, 400)

  const body = parsed.data

  const { data, error } = await supabase
    .from('expenses')
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
