import { Hono } from 'hono'
import { requireAuth, type AuthVariables } from '../lib/auth'
import { createSupabaseClient } from '../lib/supabase'
import type { Env } from '../types/env'
import {
  CsvTemplateListQuery,
  CreateCsvTemplateBody,
  UpdateCsvTemplateBody,
  formatZodError,
  mapDbError,
} from '../lib/validation'

type Bindings = Env
type Variables = AuthVariables

export const csvTemplatesRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>()

csvTemplatesRouter.use('*', requireAuth)

/** List CSV format templates for a workspace */
csvTemplatesRouter.get('/', async (c) => {
  const supabase = createSupabaseClient(c.env)

  const parsed = CsvTemplateListQuery.safeParse(c.req.query())
  if (!parsed.success) return c.json({ error: formatZodError(parsed.error) }, 400)

  const { workspace_id, entity_type, limit, offset } = parsed.data

  let query = supabase
    .from('csv_format_templates')
    .select('*', { count: 'exact' })
    .eq('workspace_id', workspace_id)

  if (entity_type) query = query.eq('entity_type', entity_type)

  query = query.order('name').range(offset, offset + limit - 1)

  const { data, error, count } = await query

  if (error) {
    const mapped = mapDbError(error)
    return c.json({ error: mapped.message }, mapped.status as any)
  }
  return c.json({ data, total: count ?? 0, limit, offset })
})

/** Create a CSV format template */
csvTemplatesRouter.post('/', async (c) => {
  const supabase = createSupabaseClient(c.env)

  const raw = await c.req.json().catch(() => null)
  if (!raw) return c.json({ error: 'Invalid JSON' }, 400)

  const parsed = CreateCsvTemplateBody.safeParse(raw)
  if (!parsed.success) return c.json({ error: formatZodError(parsed.error) }, 400)

  const { data, error } = await supabase
    .from('csv_format_templates')
    .insert(parsed.data)
    .select()
    .single()

  if (error) {
    const mapped = mapDbError(error)
    return c.json({ error: mapped.message }, mapped.status as any)
  }
  return c.json({ data }, 201)
})

/** Get a single CSV format template */
csvTemplatesRouter.get('/:id', async (c) => {
  const supabase = createSupabaseClient(c.env)

  const { data, error } = await supabase
    .from('csv_format_templates')
    .select('*')
    .eq('id', c.req.param('id'))
    .single()

  if (error) return c.json({ error: 'Not found' }, 404)
  return c.json({ data })
})

/** Update a CSV format template */
csvTemplatesRouter.patch('/:id', async (c) => {
  const supabase = createSupabaseClient(c.env)

  const raw = await c.req.json().catch(() => null)
  if (!raw) return c.json({ error: 'Invalid JSON' }, 400)

  const parsed = UpdateCsvTemplateBody.safeParse(raw)
  if (!parsed.success) return c.json({ error: formatZodError(parsed.error) }, 400)

  // Check if template exists and is not builtin
  const { data: existing, error: fetchErr } = await supabase
    .from('csv_format_templates')
    .select('is_builtin')
    .eq('id', c.req.param('id'))
    .single()

  if (fetchErr) return c.json({ error: 'Not found' }, 404)
  if (existing.is_builtin) return c.json({ error: 'Cannot modify built-in template' }, 403)

  const { data, error } = await supabase
    .from('csv_format_templates')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', c.req.param('id'))
    .select()
    .single()

  if (error) {
    const mapped = mapDbError(error)
    return c.json({ error: mapped.message }, mapped.status as any)
  }
  return c.json({ data })
})

/** Delete a CSV format template */
csvTemplatesRouter.delete('/:id', async (c) => {
  const supabase = createSupabaseClient(c.env)

  // Check if template exists and is not builtin
  const { data: existing, error: fetchErr } = await supabase
    .from('csv_format_templates')
    .select('is_builtin')
    .eq('id', c.req.param('id'))
    .single()

  if (fetchErr) return c.json({ error: 'Not found' }, 404)
  if (existing.is_builtin) return c.json({ error: 'Cannot delete built-in template' }, 403)

  const { error } = await supabase
    .from('csv_format_templates')
    .delete()
    .eq('id', c.req.param('id'))

  if (error) {
    const mapped = mapDbError(error)
    return c.json({ error: mapped.message }, mapped.status as any)
  }
  return c.body(null, 204)
})
