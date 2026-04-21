// author: AEON Dev | created: 2026-04-20 | last updated: 2026-04-20

import { Hono } from 'hono'
import { requireAuth, type AuthVariables } from '../lib/auth'
import { createSupabaseClient } from '../lib/supabase'
import type { Env } from '../types/env'

type Bindings = Env
type Variables = AuthVariables

export const dashboardRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>()

dashboardRouter.use('*', requireAuth)

// GET /dashboard/metrics
// Query: property_id, date_from, date_to
// Returns: all metrics as per dashboard-export.md

dashboardRouter.get('/metrics', async (c: any) => {
  const supabase = createSupabaseClient(c.env)
  const workspaceId = c.get('workspace_id')
  const propertyId = c.req.query('property_id')
  const dateFrom = c.req.query('date_from')
  const dateTo = c.req.query('date_to')
  if (!workspaceId || !propertyId || !dateFrom || !dateTo) {
    return c.json({ error: 'property_id, date_from, date_to required' }, 400)
  }
  // Query bookings
  const { data: bookings, error: bookingsErr } = await supabase
    .from('bookings')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('property_id', propertyId)
    .eq('status', 'committed')
    .gte('check_in_date', dateFrom)
    .lte('check_out_date', dateTo)
  if (bookingsErr) return c.json({ error: bookingsErr.message }, 500)
  // Query expenses
  const { data: expenses, error: expensesErr } = await supabase
    .from('expenses')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('property_id', propertyId)
    .eq('status', 'committed')
    .gte('transaction_date', dateFrom)
    .lte('transaction_date', dateTo)
  if (expensesErr) return c.json({ error: expensesErr.message }, 500)
  // Query mileage
  const { data: mileage, error: mileageErr } = await supabase
    .from('mileage_trips')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('property_id', propertyId)
    .gte('trip_date', dateFrom)
    .lte('trip_date', dateTo)
  if (mileageErr) return c.json({ error: mileageErr.message }, 500)
  // Metrics
  const gross_booking_revenue = bookings.reduce((sum: number, b: any) => sum + (b.gross_revenue_amount || 0), 0)
  const net_payout_revenue = bookings.reduce((sum: number, b: any) => sum + (b.net_payout_amount || 0), 0)
  const platform_fees = bookings.reduce((sum: number, b: any) => sum + (b.platform_fee_amount || 0), 0)
  const business_operating_expenses = expenses.filter((e: any) => e.review_state === 'Business' && e.tax_period === 'Operational').reduce((sum: number, e: any) => sum + (e.amount || 0), 0)
  const pre_service_expenses = expenses.filter((e: any) => e.review_state === 'Business' && e.tax_period === 'Pre-Service').reduce((sum: number, e: any) => sum + (e.amount || 0), 0)
  const net_operating_result = net_payout_revenue - business_operating_expenses
  const nights_booked = bookings.reduce((sum: number, b: any) => sum + (b.nights || 0), 0)
  const daysInRange = (new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / (1000 * 60 * 60 * 24) + 1
  const occupancy_rate = daysInRange > 0 ? Math.min(100, Math.round((nights_booked / daysInRange) * 1000) / 10) : 0
  const mileage_total = mileage.reduce((sum: number, m: any) => sum + (m.miles || 0), 0)
  return c.json({
    gross_booking_revenue,
    net_payout_revenue,
    platform_fees,
    business_operating_expenses,
    net_operating_result,
    nights_booked,
    occupancy_rate,
    pre_service_expenses,
    mileage_total
  })
})

// GET /dashboard/export/expenses
// Query: property_id, date_from, date_to, tax_period, category, review_state
// Returns: CSV

dashboardRouter.get('/export/expenses', async (c: any) => {
  const supabase = createSupabaseClient(c.env)
  const workspaceId = c.get('workspace_id')
  const propertyId = c.req.query('property_id')
  const dateFrom = c.req.query('date_from')
  const dateTo = c.req.query('date_to')
  if (!workspaceId || !propertyId || !dateFrom || !dateTo) {
    return c.json({ error: 'property_id, date_from, date_to required' }, 400)
  }
  let query = supabase
    .from('expenses')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('property_id', propertyId)
    .eq('status', 'committed')
    .gte('transaction_date', dateFrom)
    .lte('transaction_date', dateTo)
  const taxPeriod = c.req.query('tax_period')
  const category = c.req.query('category')
  const reviewState = c.req.query('review_state')
  if (taxPeriod) query = query.eq('tax_period', taxPeriod)
  if (category) query = query.eq('category', category)
  if (reviewState) query = query.eq('review_state', reviewState)
  const { data, error } = await query
  if (error) return c.json({ error: error.message }, 500)
  const fields = ['transaction_date','merchant_name','description','category','amount','payment_method','review_state','tax_period','documentation_status','property_code']
  const csv = [fields.join(',')].concat(data.map((e: any) => fields.map((f: string) => JSON.stringify(e[f] ?? '')).join(','))).join('\n')
  c.header('Content-Type', 'text/csv')
  c.header('Content-Disposition', 'attachment; filename="expenses-export.csv"')
  return c.body(csv)
})

// GET /dashboard/export/bookings
// Query: property_id, date_from, date_to, source_platform
// Returns: CSV

dashboardRouter.get('/export/bookings', async (c: any) => {
  const supabase = createSupabaseClient(c.env)
  const workspaceId = c.get('workspace_id')
  const propertyId = c.req.query('property_id')
  const dateFrom = c.req.query('date_from')
  const dateTo = c.req.query('date_to')
  if (!workspaceId || !propertyId || !dateFrom || !dateTo) {
    return c.json({ error: 'property_id, date_from, date_to required' }, 400)
  }
  let query = supabase
    .from('bookings')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('property_id', propertyId)
    .eq('status', 'committed')
    .gte('check_in_date', dateFrom)
    .lte('check_out_date', dateTo)
  const sourcePlatform = c.req.query('source_platform')
  if (sourcePlatform) query = query.eq('source_platform', sourcePlatform)
  const { data, error } = await query
  if (error) return c.json({ error: error.message }, 500)
  const fields = ['source_confirmation_code','guest_name','check_in_date','check_out_date','nights','gross_revenue_amount','cleaning_fee_amount','platform_fee_amount','tax_amount','net_payout_amount','source_platform','property_code']
  const csv = [fields.join(',')].concat(data.map((b: any) => fields.map((f: string) => JSON.stringify(b[f] ?? '')).join(','))).join('\n')
  c.header('Content-Type', 'text/csv')
  c.header('Content-Disposition', 'attachment; filename="bookings-export.csv"')
  return c.body(csv)
})

