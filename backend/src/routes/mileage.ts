/**
 * Mileage trips router — CRUD for business mileage records.
 *
 * Each trip is associated with a workspace and property.
 * deduction_amount can be stored directly or computed from miles * deduction_rate.
 *
 * author: AEON Dev | created: 2026-05-01 | last updated: 2026-05-01
 */
import { Hono } from 'hono'
import { requireAuth, type AuthVariables } from '../lib/auth'
import { createSupabaseClient } from '../lib/supabase'
import type { Env } from '../types/env'
import {
  MileageListQuery,
  CreateMileageBody,
  UpdateMileageBody,
  formatZodError,
  mapDbError,
} from '../lib/validation'

type Bindings = Env
type Variables = AuthVariables

export const mileageRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>()

mileageRouter.use('*', requireAuth)

/** 2025 IRS standard mileage rate for business use */
const DEFAULT_DEDUCTION_RATE = 0.70

/**
 * List mileage trips with workspace and optional property scope.
 */
mileageRouter.get('/', async (c) => {
  const supabase = createSupabaseClient(c.env)

  const parsed = MileageListQuery.safeParse({
    workspace_id: c.req.query('workspace_id'),
    property_id: c.req.query('property_id') || undefined,
    limit: c.req.query('limit') || undefined,
    offset: c.req.query('offset') || undefined,
  })

  if (!parsed.success) return c.json({ error: formatZodError(parsed.error) }, 400)

  const { workspace_id, property_id, limit, offset } = parsed.data

  let query = supabase.from('mileage_trips').select('*', { count: 'exact' }).eq('workspace_id', workspace_id)

  if (property_id) query = query.eq('property_id', property_id)

  const { data, error, count } = await query
    .order('trip_date', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    const mapped = mapDbError(error)
    return c.json({ error: mapped.message }, mapped.status as any)
  }
  return c.json({ data, total: count, limit, offset })
})

/** Get a single mileage trip */
mileageRouter.get('/:id', async (c) => {
  const supabase = createSupabaseClient(c.env)
  const { data, error } = await supabase
    .from('mileage_trips')
    .select('*')
    .eq('id', c.req.param('id'))
    .single()

  if (error) return c.json({ error: 'Not found' }, 404)
  return c.json({ data })
})

/**
 * Create a mileage trip.
 * Required: workspace_id, property_id, trip_date, miles.
 * If deduction_rate is omitted, defaults to IRS standard rate.
 * deduction_amount is auto-calculated from miles * deduction_rate if not provided.
 */
mileageRouter.post('/', async (c) => {
  const supabase = createSupabaseClient(c.env)

  const raw = await c.req.json().catch(() => null)
  if (!raw) return c.json({ error: 'Invalid JSON' }, 400)

  const parsed = CreateMileageBody.safeParse(raw)
  if (!parsed.success) return c.json({ error: formatZodError(parsed.error) }, 400)

  const body = parsed.data

  // Verify property belongs to workspace
  const { data: property } = await supabase
    .from('properties')
    .select('id, workspace_id')
    .eq('id', body.property_id)
    .eq('workspace_id', body.workspace_id)
    .single()

  if (!property) return c.json({ error: 'Property not found in this workspace' }, 422)

  const now = new Date().toISOString()
  const deductionRate = body.deduction_rate ?? DEFAULT_DEDUCTION_RATE
  const deductionAmount = body.deduction_amount ?? Math.round(body.miles * deductionRate * 100) / 100

  const trip = {
    workspace_id: body.workspace_id,
    property_id: body.property_id,
    trip_date: body.trip_date,
    origin: body.origin ?? null,
    destination: body.destination ?? null,
    miles: body.miles,
    purpose: body.purpose ?? null,
    deduction_rate: deductionRate,
    deduction_amount: deductionAmount,
    created_at: now,
    updated_at: now,
  }

  const { data, error } = await supabase
    .from('mileage_trips')
    .insert(trip)
    .select()
    .single()

  if (error) {
    const mapped = mapDbError(error)
    return c.json({ error: mapped.message }, mapped.status as any)
  }
  return c.json({ data }, 201)
})

/**
 * Update a mileage trip.
 * Recalculates deduction_amount if miles or deduction_rate changed.
 */
mileageRouter.patch('/:id', async (c) => {
  const supabase = createSupabaseClient(c.env)
  const id = c.req.param('id')

  const raw = await c.req.json().catch(() => null)
  if (!raw) return c.json({ error: 'Invalid JSON' }, 400)

  const parsed = UpdateMileageBody.safeParse(raw)
  if (!parsed.success) return c.json({ error: formatZodError(parsed.error) }, 400)

  const body = parsed.data

  // Fetch existing to merge for deduction recalculation
  const { data: existing } = await supabase
    .from('mileage_trips')
    .select('*')
    .eq('id', id)
    .single()

  if (!existing) return c.json({ error: 'Not found' }, 404)

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (body.trip_date !== undefined) patch['trip_date'] = body.trip_date
  if (body.origin !== undefined) patch['origin'] = body.origin
  if (body.destination !== undefined) patch['destination'] = body.destination
  if (body.miles !== undefined) patch['miles'] = body.miles
  if (body.purpose !== undefined) patch['purpose'] = body.purpose
  if (body.deduction_rate !== undefined) patch['deduction_rate'] = body.deduction_rate

  // Recalculate deduction_amount if miles or rate changed
  if (body.deduction_amount !== undefined) {
    patch['deduction_amount'] = body.deduction_amount
  } else if (body.miles !== undefined || body.deduction_rate !== undefined) {
    const finalMiles = body.miles ?? existing.miles
    const finalRate = body.deduction_rate ?? existing.deduction_rate
    if (finalRate != null) {
      patch['deduction_amount'] = Math.round(finalMiles * finalRate * 100) / 100
    }
  }

  const { data, error } = await supabase
    .from('mileage_trips')
    .update(patch)
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
 * Delete a mileage trip.
 * Hard delete — mileage trips don't have a status lifecycle like bookings/expenses.
 */
mileageRouter.delete('/:id', async (c) => {
  const supabase = createSupabaseClient(c.env)
  const id = c.req.param('id')

  const { error } = await supabase
    .from('mileage_trips')
    .delete()
    .eq('id', id)

  if (error) return c.json({ error: error.message }, 500)
  return c.json({ success: true })
})
