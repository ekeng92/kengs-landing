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
  const workspaceId = c.req.query('workspace_id')
  const propertyId = c.req.query('property_id')

  if (!workspaceId) return c.json({ error: 'workspace_id is required' }, 400)

  let query = supabase.from('mileage_trips').select('*').eq('workspace_id', workspaceId)

  if (propertyId) query = query.eq('property_id', propertyId)

  const { data, error } = await query.order('trip_date', { ascending: false })

  if (error) return c.json({ error: error.message }, 500)
  return c.json({ data })
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
  const body = await c.req.json()

  const { workspace_id, property_id, trip_date, miles } = body

  if (!workspace_id) return c.json({ error: 'workspace_id is required' }, 400)
  if (!property_id) return c.json({ error: 'property_id is required' }, 400)
  if (!trip_date) return c.json({ error: 'trip_date is required' }, 400)
  if (miles == null || miles <= 0) return c.json({ error: 'miles must be a positive number' }, 400)

  // Verify property belongs to workspace
  const { data: property } = await supabase
    .from('properties')
    .select('id, workspace_id')
    .eq('id', property_id)
    .eq('workspace_id', workspace_id)
    .single()

  if (!property) return c.json({ error: 'Property not found in this workspace' }, 422)

  const now = new Date().toISOString()
  const deductionRate = body.deduction_rate != null ? Number(body.deduction_rate) : DEFAULT_DEDUCTION_RATE
  const deductionAmount = body.deduction_amount != null
    ? Number(body.deduction_amount)
    : Math.round(Number(miles) * deductionRate * 100) / 100

  const trip = {
    workspace_id,
    property_id,
    trip_date,
    origin: body.origin ?? null,
    destination: body.destination ?? null,
    miles: Number(miles),
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

  if (error) return c.json({ error: error.message }, 500)
  return c.json({ data }, 201)
})

/**
 * Update a mileage trip.
 * Recalculates deduction_amount if miles or deduction_rate changed.
 */
mileageRouter.patch('/:id', async (c) => {
  const supabase = createSupabaseClient(c.env)
  const id = c.req.param('id')
  const body = await c.req.json()

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
  if (body.miles !== undefined) patch['miles'] = Number(body.miles)
  if (body.purpose !== undefined) patch['purpose'] = body.purpose
  if (body.deduction_rate !== undefined) patch['deduction_rate'] = Number(body.deduction_rate)

  // Recalculate deduction_amount if miles or rate changed
  if (body.deduction_amount !== undefined) {
    patch['deduction_amount'] = Number(body.deduction_amount)
  } else if (body.miles !== undefined || body.deduction_rate !== undefined) {
    const finalMiles = body.miles != null ? Number(body.miles) : existing.miles
    const finalRate = body.deduction_rate != null ? Number(body.deduction_rate) : existing.deduction_rate
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

  if (error) return c.json({ error: error.message }, 500)
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
