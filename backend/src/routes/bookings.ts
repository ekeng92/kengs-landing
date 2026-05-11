/**
 * Bookings router — T6 (Booking Ingestion Implementation)
 *
 * Extends the T4 scaffold with:
 *  - Validated manual entry (Flow 2 from spec) with property association + audit event
 *  - Commit endpoint that blocks duplicate confirmation codes with a clear error
 *  - Void endpoint
 *
 * Airbnb CSV parsing + dedup lives in booking-ingest/airbnb-parser.ts.
 * The /imports/:jobId/promote endpoint drives the CSV promotion flow (imports.ts).
 *
 * author: AEON Dev | created: 2026-04-20 | last updated: 2026-04-20
 */
import { Hono } from 'hono'
import { requireAuth, type AuthVariables } from '../lib/auth'
import { createSupabaseClient } from '../lib/supabase'
import { requireWorkspaceFeature } from '../lib/permissions'
import type { Env } from '../types/env'
import type { RecordStatus } from '../types/schema'
import {
  BookingListQuery,
  CreateBookingBody,
  UpdateBookingBody,
  formatZodError,
  mapDbError,
} from '../lib/validation'

type Bindings = Env
type Variables = AuthVariables

export const bookingsRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>()

bookingsRouter.use('*', requireAuth)

/**
 * List bookings with workspace and optional property scope.
 */
bookingsRouter.get('/', async (c) => {
  const supabase = createSupabaseClient(c.env)

  const parsed = BookingListQuery.safeParse({
    workspace_id: c.req.query('workspace_id'),
    property_id: c.req.query('property_id') || undefined,
    status: c.req.query('status') || undefined,
    source_platform: c.req.query('source_platform') || undefined,
    limit: c.req.query('limit') || undefined,
    offset: c.req.query('offset') || undefined,
  })

  if (!parsed.success) return c.json({ error: formatZodError(parsed.error) }, 400)

  const { workspace_id, property_id, status, source_platform, limit, offset } = parsed.data

  let query = supabase.from('bookings').select('*', { count: 'exact' }).eq('workspace_id', workspace_id)

  if (property_id) query = query.eq('property_id', property_id)
  if (status) query = query.eq('status', status)
  if (source_platform) query = query.eq('source_platform', source_platform)

  const { data, error, count } = await query
    .order('check_in_date', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    const mapped = mapDbError(error)
    return c.json({ error: mapped.message }, mapped.status as any)
  }
  return c.json({ data, total: count, limit, offset })
})

/** Get a single booking */
bookingsRouter.get('/:id', async (c) => {
  const supabase = createSupabaseClient(c.env)
  const id = c.req.param('id')

  const { data: existing, error: existingError } = await supabase
    .from('bookings')
    .select('workspace_id')
    .eq('id', id)
    .single()

  if (existingError || !existing) return c.json({ error: 'Not found' }, 404)

  const forbidden = await requireWorkspaceFeature(c, existing.workspace_id, 'bookings', 'read')
  if (forbidden) return forbidden

  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('id', id)
    .single()

  if (error) return c.json({ error: 'Not found' }, 404)
  return c.json({ data })
})

/**
 * Create a booking via manual entry (Flow 2 from spec).
 * Status is set to 'committed' directly — no import job needed.
 * Required: workspace_id, property_id, check_in_date, check_out_date, net_payout_amount.
 * Verifies property belongs to the workspace before committing.
 * Records an audit_event on creation.
 */
bookingsRouter.post('/', async (c) => {
  const supabase = createSupabaseClient(c.env)
  const userId = c.var.userId

  const raw = await c.req.json().catch(() => null)
  if (!raw) return c.json({ error: 'Invalid JSON' }, 400)

  const parsed = CreateBookingBody.safeParse(raw)
  if (!parsed.success) return c.json({ error: formatZodError(parsed.error) }, 400)

  const body = parsed.data

  // Date ordering
  if (body.check_out_date <= body.check_in_date) {
    return c.json({ error: 'check_out_date must be after check_in_date' }, 422)
  }

  // Property association: verify property belongs to this workspace
  const { data: property } = await supabase
    .from('properties')
    .select('id, workspace_id')
    .eq('id', body.property_id)
    .eq('workspace_id', body.workspace_id)
    .single()

  if (!property) return c.json({ error: 'Property not found in this workspace' }, 422)

  const now = new Date().toISOString()
  const nights = nightsBetween(body.check_in_date, body.check_out_date)

  const booking = {
    workspace_id: body.workspace_id,
    property_id: body.property_id,
    source_platform: body.source_platform,
    source_confirmation_code: body.source_confirmation_code ?? null,
    guest_name: body.guest_name ?? null,
    check_in_date: body.check_in_date,
    check_out_date: body.check_out_date,
    nights,
    gross_revenue_amount: body.gross_revenue_amount ?? null,
    cleaning_fee_amount: body.cleaning_fee_amount ?? null,
    platform_fee_amount: body.platform_fee_amount ?? null,
    tax_amount: body.tax_amount ?? null,
    net_payout_amount: body.net_payout_amount,
    status: 'committed' as const,
    source_import_row_id: null,
    created_at: now,
    updated_at: now,
  }

  const { data, error } = await supabase.from('bookings').insert(booking).select().single()
  if (error) {
    const mapped = mapDbError(error)
    return c.json({ error: mapped.message }, mapped.status as any)
  }

  // Audit: created via manual entry
  await supabase.from('audit_events').insert({
    workspace_id: body.workspace_id,
    actor_user_id: userId,
    entity_type: 'booking',
    entity_id: data.id,
    event_type: 'created',
    old_values: null,
    new_values: data,
    metadata: { source: 'manual_entry' },
    created_at: now,
  })

  return c.json({ data }, 201)
})

/** Update editable fields on a booking (guest_name, notes, etc.) */
bookingsRouter.patch('/:id', async (c) => {
  const supabase = createSupabaseClient(c.env)
  const id = c.req.param('id')

  const { data: existing, error: existingError } = await supabase
    .from('bookings')
    .select('workspace_id')
    .eq('id', id)
    .single()

  if (existingError || !existing) return c.json({ error: 'Not found' }, 404)

  const forbidden = await requireWorkspaceFeature(c, existing.workspace_id, 'bookings', 'write')
  if (forbidden) return forbidden

  const raw = await c.req.json().catch(() => null)
  if (!raw) return c.json({ error: 'Invalid JSON' }, 400)

  const parsed = UpdateBookingBody.safeParse(raw)
  if (!parsed.success) return c.json({ error: formatZodError(parsed.error) }, 400)

  const body = parsed.data

  const { data, error } = await supabase
    .from('bookings')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    const mapped = mapDbError(error)
    return c.json({ error: mapped.message }, mapped.status as any)
  }
  return c.json({ data })
})

/**
 * Commit a draft booking to reportable status.
 * Duplicate confirmation codes across committed bookings are prevented by the
 * bookings_source_confirmation_idx unique index. A 409 is returned on conflict.
 */
bookingsRouter.patch('/:id/commit', async (c) => {
  const supabase = createSupabaseClient(c.env)
  const userId = c.var.userId
  const id = c.req.param('id')

  const { data: existing } = await supabase
    .from('bookings')
    .select('*')
    .eq('id', id)
    .single()

  if (!existing) return c.json({ error: 'Not found' }, 404)

  const forbidden = await requireWorkspaceFeature(c, existing.workspace_id, 'bookings', 'write')
  if (forbidden) return forbidden
  if (existing.status !== 'draft') {
    return c.json({ error: `Cannot commit booking with status: ${existing.status}` }, 422)
  }

  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('bookings')
    .update({ status: 'committed', updated_at: now })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    // 23505 = unique_violation — duplicate confirmation code
    if (error.code === '23505') {
      return c.json({ error: 'Duplicate booking: a committed booking with this confirmation code already exists' }, 409)
    }
    return c.json({ error: error.message }, 500)
  }

  await supabase.from('audit_events').insert({
    workspace_id: existing.workspace_id,
    actor_user_id: userId,
    entity_type: 'booking',
    entity_id: id,
    event_type: 'promoted',
    old_values: { status: 'draft' },
    new_values: { status: 'committed' },
    metadata: null,
    created_at: now,
  })

  return c.json({ data })
})

/** Void a committed booking */
bookingsRouter.patch('/:id/void', async (c) => {
  const supabase = createSupabaseClient(c.env)
  const userId = c.var.userId
  const id = c.req.param('id')

  const { data: existing } = await supabase
    .from('bookings')
    .select('*')
    .eq('id', id)
    .single()

  if (!existing) return c.json({ error: 'Not found' }, 404)

  const forbidden = await requireWorkspaceFeature(c, existing.workspace_id, 'bookings', 'write')
  if (forbidden) return forbidden

  if (existing.status === 'voided') return c.json({ error: 'Already voided' }, 422)

  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('bookings')
    .update({ status: 'voided', updated_at: now })
    .eq('id', id)
    .select()
    .single()

  if (error) { const mapped = mapDbError(error); return c.json({ error: mapped.message }, mapped.status as any) }

  await supabase.from('audit_events').insert({
    workspace_id: existing.workspace_id,
    actor_user_id: userId,
    entity_type: 'booking',
    entity_id: id,
    event_type: 'updated',
    old_values: { status: existing.status },
    new_values: { status: 'voided' },
    metadata: { action: 'void' },
    created_at: now,
  })

  return c.json({ data })
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

function nightsBetween(checkIn: string, checkOut: string): number {
  const msPerDay = 1000 * 60 * 60 * 24
  return Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / msPerDay)
}
