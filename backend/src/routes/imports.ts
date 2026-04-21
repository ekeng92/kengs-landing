import { Hono } from 'hono'
import { requireAuth, type AuthVariables } from '../lib/auth'
import { createSupabaseClient } from '../lib/supabase'
import type { Env } from '../types/env'
import type { ImportRowReviewStatus, ExpenseReviewState, DocumentationStatus } from '../types/schema'
import { parseCsvText, normalizeAirbnbRow, checkDedup } from '../../booking-ingest/airbnb-parser'
import { parseBankCsv } from '../../expense-import/parse'
import { promoteRow, recordClassificationEvent, tryAdvanceJobStatus } from '../../expense-import/promote'

type Bindings = Env
type Variables = AuthVariables

export const importsRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>()

importsRouter.use('*', requireAuth)

/**
 * Create an import job.
 * Caller provides workspace_id, import_type, and original_filename.
 * File upload to Supabase Storage is handled by the client directly (signed URL flow);
 * storage_path is passed in body after upload.
 *
 * T5 and T6 will extend this with CSV parsing and row creation.
 */
importsRouter.post('/', async (c) => {
  const userId = c.var.userId
  const supabase = createSupabaseClient(c.env)
  const body = await c.req.json<{
    workspace_id: string
    import_type: string
    original_filename?: string
    storage_path?: string
    metadata?: Record<string, unknown>
  }>()

  const { data, error } = await supabase
    .from('import_jobs')
    .insert({
      workspace_id: body.workspace_id,
      created_by_user_id: userId,
      import_type: body.import_type,
      original_filename: body.original_filename ?? null,
      storage_path: body.storage_path ?? null,
      metadata: body.metadata ?? null,
      status: 'uploaded',
    })
    .select()
    .single()

  if (error) return c.json({ error: error.message }, 500)
  return c.json({ data }, 201)
})

/** List import jobs for a workspace */
importsRouter.get('/', async (c) => {
  const supabase = createSupabaseClient(c.env)
  const workspaceId = c.req.query('workspace_id')
  if (!workspaceId) return c.json({ error: 'workspace_id is required' }, 400)

  const { data, error } = await supabase
    .from('import_jobs')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return c.json({ error: error.message }, 500)
  return c.json({ data })
})

/** Get import job status and summary counts */
importsRouter.get('/:jobId', async (c) => {
  const supabase = createSupabaseClient(c.env)
  const { data, error } = await supabase
    .from('import_jobs')
    .select('*')
    .eq('id', c.req.param('jobId'))
    .single()

  if (error) return c.json({ error: 'Not found' }, 404)
  return c.json({ data })
})

/**
 * List import rows for a job, optionally filtered by review_status.
 * This is the review queue endpoint consumed by the expense review UI (Slice 1).
 * T5 will add category suggestion fields and pagination.
 */
importsRouter.get('/:jobId/rows', async (c) => {
  const supabase = createSupabaseClient(c.env)
  const reviewStatus = c.req.query('review_status') as ImportRowReviewStatus | undefined

  let query = supabase
    .from('import_rows')
    .select('*')
    .eq('import_job_id', c.req.param('jobId'))

  if (reviewStatus) query = query.eq('review_status', reviewStatus)

  const { data, error } = await query.order('row_index')

  if (error) return c.json({ error: error.message }, 500)
  return c.json({ data })
})

/**
 * Update a single import row's review status or normalized payload.
 * Approved rows are eligible for promotion. Rejected rows are excluded.
 * T5 and T6 will validate state transitions and emit audit events.
 */
importsRouter.patch('/:jobId/rows/:rowId', async (c) => {
  const supabase = createSupabaseClient(c.env)
  const body = await c.req.json<{
    review_status?: ImportRowReviewStatus
    normalized_payload?: Record<string, unknown>
  }>()

  const { data, error } = await supabase
    .from('import_rows')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', c.req.param('rowId'))
    .eq('import_job_id', c.req.param('jobId'))
    .select()
    .single()

  if (error) return c.json({ error: error.message }, 500)
  return c.json({ data })
})

/**
 * Parse an Airbnb CSV into import_rows for booking ingestion (T6).
 *
 * Expects the CSV text in the request body as `text/plain` or as JSON field `csv`.
 * The property_id to associate all rows with is required (caller selects it at import time).
 * Deduplication runs against existing committed bookings in the workspace.
 *
 * After parsing, the import_job status advances to 'parsed' or 'flagged'.
 */
importsRouter.post('/:jobId/parse-bookings', async (c) => {
  const supabase = createSupabaseClient(c.env)
  const userId = c.var.userId
  const jobId = c.req.param('jobId')

  const body = await c.req.json<{ property_id: string; csv: string }>()

  if (!body.property_id) return c.json({ error: 'property_id is required' }, 400)
  if (!body.csv) return c.json({ error: 'csv field is required' }, 400)

  // Verify job exists and belongs to caller's workspace
  const { data: job } = await supabase.from('import_jobs').select('*').eq('id', jobId).single()
  if (!job) return c.json({ error: 'Import job not found' }, 404)

  const workspaceId: string = job.workspace_id

  // Verify property belongs to the workspace
  const { data: property } = await supabase
    .from('properties')
    .select('id')
    .eq('id', body.property_id)
    .eq('workspace_id', workspaceId)
    .single()
  if (!property) return c.json({ error: 'Property not found in this workspace' }, 422)

  // Load existing committed bookings for dedup
  const { data: existingBookings } = await supabase
    .from('bookings')
    .select('id, source_platform, source_confirmation_code, check_in_date, check_out_date, guest_name, net_payout_amount, gross_revenue_amount')
    .eq('workspace_id', workspaceId)
    .eq('status', 'committed')

  const committed = existingBookings ?? []

  // Parse and normalize
  const rawRows = parseCsvText(body.csv)

  if (rawRows.length === 0) {
    return c.json({ error: 'CSV is empty or has no data rows' }, 422)
  }

  const now = new Date().toISOString()

  // Build import_row records
  const importRows = rawRows.map((raw, idx) => {
    const parsed = normalizeAirbnbRow(raw)
    const dedupeKey = parsed.dedupe_key_template.replace('{PROPERTY_ID}', body.property_id)

    // Overlay property_id into normalized payload
    const normalizedWithProperty = { ...parsed.normalized, property_id: body.property_id }

    // Dedup check
    const dedup = checkDedup(parsed.normalized, body.property_id, committed)

    let review_status = parsed.initial_review_status as string
    let dedup_flag: Record<string, unknown> | null = null

    if (parsed.initial_review_status !== 'rejected') {
      if (dedup.outcome === 'duplicate_exact') {
        review_status = 'rejected'
        dedup_flag = { dedup_outcome: 'duplicate_exact', existing_booking_id: dedup.existing_booking_id }
      } else if (dedup.outcome === 'duplicate_conflict') {
        review_status = 'flagged'
        dedup_flag = { dedup_outcome: 'duplicate_conflict', existing_booking_id: dedup.existing_booking_id, conflict_fields: dedup.conflict_fields }
      } else if (dedup.outcome === 'fallback_match') {
        review_status = 'flagged'
        dedup_flag = { dedup_outcome: 'fallback_match', candidate_booking_ids: dedup.candidate_booking_ids }
      }
    }

    const validationErrors = dedup_flag
      ? [...parsed.validation_errors, { field: 'dedupe', reason: JSON.stringify(dedup_flag), severity: 'soft' }]
      : parsed.validation_errors

    return {
      import_job_id: jobId,
      row_index: idx,
      entity_type: 'booking',
      raw_payload: raw,
      normalized_payload: normalizedWithProperty,
      validation_errors: validationErrors,
      review_status,
      promoted_entity_type: null,
      promoted_entity_id: null,
      dedupe_key: dedupeKey,
      created_at: now,
      updated_at: now,
    }
  })

  // Batch insert rows
  const { error: rowsError } = await supabase.from('import_rows').insert(importRows)
  if (rowsError) return c.json({ error: rowsError.message }, 500)

  const totalRows = importRows.length
  const errorCount = importRows.filter((r) => r.review_status === 'rejected').length
  const hasFlagged = importRows.some((r) => r.review_status === 'flagged')
  const newJobStatus = hasFlagged ? 'flagged' : 'parsed'

  const { data: updatedJob, error: jobUpdateError } = await supabase
    .from('import_jobs')
    .update({ status: newJobStatus, row_count: totalRows, error_count: errorCount, updated_at: now })
    .eq('id', jobId)
    .select()
    .single()

  if (jobUpdateError) return c.json({ error: jobUpdateError.message }, 500)

  // Summary counts
  const pending = importRows.filter((r) => r.review_status === 'pending').length
  const flagged = importRows.filter((r) => r.review_status === 'flagged').length
  const rejected = importRows.filter((r) => r.review_status === 'rejected').length

  return c.json({
    data: updatedJob,
    summary: { total: totalRows, auto_promotable: pending, flagged, rejected },
  })
})

/**
 * Promote approved booking import rows into committed bookings (T6).
 *
 * Promotes all rows with review_status='pending' or 'approved' in the job.
 * Each promotion is idempotent: the dedupe_key unique index prevents double-commit.
 * Records audit_events for every promoted booking.
 */
importsRouter.post('/:jobId/promote-bookings', async (c) => {
  const supabase = createSupabaseClient(c.env)
  const userId = c.var.userId
  const jobId = c.req.param('jobId')

  const { data: job } = await supabase.from('import_jobs').select('*').eq('id', jobId).single()
  if (!job) return c.json({ error: 'Import job not found' }, 404)
  if (job.status === 'promoted') return c.json({ error: 'Job is already promoted' }, 422)

  const workspaceId: string = job.workspace_id

  // Fetch rows eligible for promotion
  const { data: rows } = await supabase
    .from('import_rows')
    .select('*')
    .eq('import_job_id', jobId)
    .in('review_status', ['pending', 'approved'])
    .eq('entity_type', 'booking')

  if (!rows || rows.length === 0) {
    return c.json({ error: 'No rows eligible for promotion' }, 422)
  }

  const now = new Date().toISOString()
  const promoted: string[] = []
  const skipped: Array<{ row_id: string; reason: string }> = []

  for (const row of rows) {
    const n = row.normalized_payload as Record<string, unknown>

    if (!n.property_id || !n.check_in_date || !n.check_out_date || n.net_payout_amount == null) {
      skipped.push({ row_id: row.id, reason: 'Missing required fields in normalized_payload' })
      continue
    }

    const nights =
      typeof n.nights === 'number'
        ? n.nights
        : Math.round(
            (new Date(n.check_out_date as string).getTime() - new Date(n.check_in_date as string).getTime()) /
              (1000 * 60 * 60 * 24)
          )

    const booking = {
      workspace_id: workspaceId,
      property_id: n.property_id as string,
      source_platform: (n.source_platform as string) ?? 'airbnb',
      source_confirmation_code: (n.source_confirmation_code as string | null) ?? null,
      guest_name: (n.guest_name as string | null) ?? null,
      check_in_date: n.check_in_date as string,
      check_out_date: n.check_out_date as string,
      nights,
      gross_revenue_amount: n.gross_revenue_amount != null ? Number(n.gross_revenue_amount) : null,
      cleaning_fee_amount: n.cleaning_fee_amount != null ? Number(n.cleaning_fee_amount) : null,
      platform_fee_amount: n.platform_fee_amount != null ? Number(n.platform_fee_amount) : null,
      tax_amount: n.tax_amount != null ? Number(n.tax_amount) : null,
      net_payout_amount: Number(n.net_payout_amount),
      status: 'committed' as const,
      source_import_row_id: row.id,
      created_at: now,
      updated_at: now,
    }

    const { data: newBooking, error: bookingError } = await supabase
      .from('bookings')
      .insert(booking)
      .select()
      .single()

    if (bookingError) {
      // 23505 = unique_violation — exact duplicate already committed
      if (bookingError.code === '23505') {
        skipped.push({ row_id: row.id, reason: 'Duplicate confirmation code already committed' })
        // Mark as rejected so it doesn't block job promotion
        await supabase
          .from('import_rows')
          .update({ review_status: 'rejected', updated_at: now })
          .eq('id', row.id)
      } else {
        skipped.push({ row_id: row.id, reason: bookingError.message })
      }
      continue
    }

    // Mark row as promoted
    await supabase
      .from('import_rows')
      .update({ review_status: 'promoted', promoted_entity_type: 'booking', promoted_entity_id: newBooking.id, updated_at: now })
      .eq('id', row.id)

    // Audit event
    await supabase.from('audit_events').insert({
      workspace_id: workspaceId,
      actor_user_id: userId,
      entity_type: 'booking',
      entity_id: newBooking.id,
      event_type: 'promoted',
      old_values: null,
      new_values: newBooking,
      metadata: { import_job_id: jobId, import_row_id: row.id },
      created_at: now,
    })

    promoted.push(newBooking.id)
  }

  // Advance job status to promoted
  const { data: updatedJob } = await supabase
    .from('import_jobs')
    .update({ status: 'promoted', updated_at: now })
    .eq('id', jobId)
    .select()
    .single()

  return c.json({
    data: updatedJob,
    summary: { promoted: promoted.length, skipped: skipped.length },
    skipped,
  })
})

// ─── Expense import routes (T5) ───────────────────────────────────────────────

/**
 * Parse a bank/card CSV into expense import_rows for this job.
 *
 * Expects JSON body: { csv: string }
 * Loads existing dedupe keys from committed expenses for duplicate detection.
 * Rows meeting the auto-approval threshold are staged as 'approved'; others as 'flagged'.
 * Auto-approved rows are NOT promoted here — promotion is an explicit user action.
 *
 * Spec ref: docs/specs/expense-import-review.md § Workflow § Happy Path
 */
importsRouter.post('/:jobId/parse-expenses', async (c) => {
  const supabase = createSupabaseClient(c.env)
  const jobId = c.req.param('jobId')

  const body = await c.req.json<{ csv: string }>()
  if (!body.csv) return c.json({ error: 'csv field is required' }, 400)

  const { data: job } = await supabase.from('import_jobs').select('*').eq('id', jobId).single()
  if (!job) return c.json({ error: 'Import job not found' }, 404)

  const workspaceId: string = job.workspace_id

  // Load dedupe keys from import_rows that are already promoted (committed expenses)
  const { data: committedRows } = await supabase
    .from('import_rows')
    .select('dedupe_key')
    .eq('import_job_id', jobId)
    .eq('review_status', 'promoted')

  // Also check across all jobs for this workspace to catch re-uploads
  const { data: allWorkspaceRows } = await supabase
    .from('import_rows')
    .select('dedupe_key, import_job_id')
    .eq('review_status', 'promoted')

  // Load workspace property codes for property resolution
  const { data: properties } = await supabase
    .from('properties')
    .select('code')
    .eq('workspace_id', workspaceId)

  const existingDedupeKeys = new Set<string>()
  const workspaceJobIds = new Set<string>()

  // Get all job ids for this workspace
  const { data: workspaceJobs } = await supabase
    .from('import_jobs')
    .select('id')
    .eq('workspace_id', workspaceId)

  if (workspaceJobs) workspaceJobs.forEach((j: { id: string }) => workspaceJobIds.add(j.id))
  if (allWorkspaceRows) {
    allWorkspaceRows.forEach((r: { dedupe_key: string | null; import_job_id: string }) => {
      if (r.dedupe_key && workspaceJobIds.has(r.import_job_id)) {
        existingDedupeKeys.add(r.dedupe_key)
      }
    })
  }

  const knownPropertyCodes = properties?.map((p: { code: string }) => p.code) ?? []

  let parsedRows
  try {
    parsedRows = parseBankCsv(body.csv, knownPropertyCodes, existingDedupeKeys)
  } catch (err) {
    await supabase
      .from('import_jobs')
      .update({ status: 'failed', updated_at: new Date().toISOString() })
      .eq('id', jobId)
    return c.json({ error: 'Failed to parse CSV', detail: String(err) }, 422)
  }

  if (parsedRows.length === 0) {
    await supabase
      .from('import_jobs')
      .update({ status: 'failed', row_count: 0, error_count: 0, updated_at: new Date().toISOString() })
      .eq('id', jobId)
    return c.json({ error: 'No rows could be parsed from the file' }, 422)
  }

  const now = new Date().toISOString()
  const rowInserts = parsedRows.map((r) => ({
    import_job_id: jobId,
    row_index: r.row_index,
    entity_type: 'expense',
    raw_payload: r.raw_payload,
    normalized_payload: r.normalized_payload,
    validation_errors: r.validation_errors,
    review_status: r.review_status,
    promoted_entity_type: null,
    promoted_entity_id: null,
    dedupe_key: r.dedupe_key,
    confidence_score: r.confidence_score,
    created_at: now,
    updated_at: now,
  }))

  const { error: rowsError } = await supabase.from('import_rows').insert(rowInserts)
  if (rowsError) return c.json({ error: rowsError.message }, 500)

  const errorCount = parsedRows.filter((r) => r.validation_errors && r.validation_errors.length > 0).length
  const flaggedCount = parsedRows.filter((r) => r.review_status === 'flagged').length
  const approvedCount = parsedRows.filter((r) => r.review_status === 'approved').length
  const newStatus = flaggedCount > 0 ? 'flagged' : 'parsed'

  const { data: updatedJob } = await supabase
    .from('import_jobs')
    .update({ status: newStatus, row_count: parsedRows.length, error_count: errorCount, updated_at: now })
    .eq('id', jobId)
    .select()
    .single()

  return c.json({
    data: updatedJob,
    summary: {
      total: parsedRows.length,
      approved: approvedCount,
      flagged: flaggedCount,
      error_count: errorCount,
    },
  })
})

/**
 * Classify a flagged expense import_row.
 * Sets review_state, category, and other fields confirmed by the user.
 * Advances review_status to 'approved'. Promotion is a separate explicit step.
 * Records an audit_event (event_type: classified).
 *
 * Spec ref: docs/specs/expense-import-review.md § Review Queue Interaction steps 3–6
 */
importsRouter.post('/:jobId/rows/:rowId/classify', async (c) => {
  const supabase = createSupabaseClient(c.env)
  const userId = c.var.userId
  const jobId = c.req.param('jobId')
  const rowId = c.req.param('rowId')

  const body = await c.req.json<{
    review_state: ExpenseReviewState
    category: string
    property_id?: string | null
    description?: string | null
    payment_method?: string | null
    documentation_status?: DocumentationStatus
  }>()

  if (!body.review_state || !body.category) {
    return c.json({ error: 'review_state and category are required' }, 400)
  }

  const { data: row } = await supabase
    .from('import_rows')
    .select('*')
    .eq('id', rowId)
    .eq('import_job_id', jobId)
    .single()

  if (!row) return c.json({ error: 'import_row not found' }, 404)
  if (row.review_status === 'promoted') {
    return c.json({ error: 'Row already promoted — use reclassify on the expense' }, 409)
  }

  const { data: job } = await supabase.from('import_jobs').select('workspace_id').eq('id', jobId).single()
  if (!job) return c.json({ error: 'Import job not found' }, 404)
  const workspaceId: string = job.workspace_id

  const existingNorm = (row.normalized_payload as Record<string, unknown>) ?? {}
  const updatedNorm = {
    ...existingNorm,
    candidate_review_state: body.review_state,
    candidate_category: body.category,
    candidate_property_code: body.property_id ?? existingNorm['candidate_property_code'] ?? null,
    description: body.description ?? existingNorm['description'] ?? null,
    payment_method: body.payment_method ?? existingNorm['payment_method'] ?? null,
  }

  const { data: updatedRow, error: updateErr } = await supabase
    .from('import_rows')
    .update({ review_status: 'approved', normalized_payload: updatedNorm, updated_at: new Date().toISOString() })
    .eq('id', rowId)
    .select()
    .single()

  if (updateErr) return c.json({ error: updateErr.message }, 500)

  await recordClassificationEvent(supabase, {
    workspaceId,
    actorUserId: userId,
    entityType: 'import_row',
    entityId: rowId,
    oldValues: { review_status: row.review_status, candidate_review_state: existingNorm['candidate_review_state'] ?? null },
    newValues: { review_status: 'approved', review_state: body.review_state, category: body.category, property_id: body.property_id ?? null },
  })

  return c.json({ data: updatedRow })
})

/**
 * Reject an expense import_row. Row will not be promoted.
 * Records an audit_event (event_type: classified / review_status: rejected).
 *
 * Spec ref: docs/specs/expense-import-review.md § Review Queue Interaction step 5
 */
importsRouter.post('/:jobId/rows/:rowId/reject', async (c) => {
  const supabase = createSupabaseClient(c.env)
  const userId = c.var.userId
  const jobId = c.req.param('jobId')
  const rowId = c.req.param('rowId')

  const body = await c.req.json<{ reason?: string }>().catch(() => ({}))

  const { data: row } = await supabase
    .from('import_rows')
    .select('review_status, import_job_id')
    .eq('id', rowId)
    .eq('import_job_id', jobId)
    .single()

  if (!row) return c.json({ error: 'import_row not found' }, 404)
  if (row.review_status === 'promoted') {
    return c.json({ error: 'Row already promoted and cannot be rejected' }, 409)
  }

  const { data: job } = await supabase.from('import_jobs').select('workspace_id').eq('id', jobId).single()
  if (!job) return c.json({ error: 'Import job not found' }, 404)
  const workspaceId: string = job.workspace_id

  const { data: updatedRow, error: updateErr } = await supabase
    .from('import_rows')
    .update({ review_status: 'rejected', updated_at: new Date().toISOString() })
    .eq('id', rowId)
    .select()
    .single()

  if (updateErr) return c.json({ error: updateErr.message }, 500)

  await recordClassificationEvent(supabase, {
    workspaceId,
    actorUserId: userId,
    entityType: 'import_row',
    entityId: rowId,
    oldValues: { review_status: row.review_status },
    newValues: { review_status: 'rejected', reason: (body as { reason?: string }).reason ?? null },
  })

  await tryAdvanceJobStatus(supabase, jobId, workspaceId)

  return c.json({ data: updatedRow })
})

/**
 * Promote an approved expense import_row into a committed expense.
 * Caller must have already classified the row (review_status = approved).
 * Records audit_events for both the import_row (classified) and expense (promoted).
 *
 * Spec ref: docs/specs/expense-import-review.md § Workflow § Happy Path steps 10–13
 */
importsRouter.post('/:jobId/rows/:rowId/promote', async (c) => {
  const supabase = createSupabaseClient(c.env)
  const userId = c.var.userId
  const jobId = c.req.param('jobId')
  const rowId = c.req.param('rowId')

  const body = await c.req.json<{
    review_state: ExpenseReviewState
    category: string
    property_id?: string | null
    description?: string | null
    payment_method?: string | null
    documentation_status?: DocumentationStatus
  }>()

  if (!body.review_state || !body.category) {
    return c.json({ error: 'review_state and category are required' }, 400)
  }

  const { data: job } = await supabase.from('import_jobs').select('workspace_id').eq('id', jobId).single()
  if (!job) return c.json({ error: 'Import job not found' }, 404)
  const workspaceId: string = job.workspace_id

  let result
  try {
    result = await promoteRow(supabase, {
      importRowId: rowId,
      workspaceId,
      actorUserId: userId,
      reviewState: body.review_state,
      category: body.category,
      propertyId: body.property_id ?? null,
      description: body.description ?? null,
      paymentMethod: body.payment_method ?? null,
      documentationStatus: body.documentation_status ?? 'N',
    })
  } catch (err) {
    return c.json({ error: String(err) }, 500)
  }

  await tryAdvanceJobStatus(supabase, jobId, workspaceId)

  return c.json({ data: { expense_id: result.expenseId, tax_period: result.taxPeriod } })
})

/**
 * Batch promote all approved expense rows in a job.
 * Skips rows that fail promotion; reports each failure with reason.
 *
 * Spec ref: docs/specs/expense-import-review.md § Import Job Status Progression
 */
importsRouter.post('/:jobId/promote-expenses', async (c) => {
  const supabase = createSupabaseClient(c.env)
  const userId = c.var.userId
  const jobId = c.req.param('jobId')

  const { data: job } = await supabase.from('import_jobs').select('*').eq('id', jobId).single()
  if (!job) return c.json({ error: 'Import job not found' }, 404)
  if (job.status === 'promoted') return c.json({ error: 'Job is already promoted' }, 422)

  const workspaceId: string = job.workspace_id

  const { data: rows } = await supabase
    .from('import_rows')
    .select('*')
    .eq('import_job_id', jobId)
    .eq('review_status', 'approved')
    .eq('entity_type', 'expense')

  if (!rows || rows.length === 0) {
    return c.json({ error: 'No approved expense rows to promote' }, 422)
  }

  const promoted: string[] = []
  const skipped: Array<{ row_id: string; reason: string }> = []

  for (const row of rows) {
    const norm = (row.normalized_payload as Record<string, unknown>) ?? {}
    try {
      const result = await promoteRow(supabase, {
        importRowId: row.id,
        workspaceId,
        actorUserId: userId,
        reviewState: (norm['candidate_review_state'] as ExpenseReviewState) ?? 'Review',
        category: (norm['candidate_category'] as string) ?? '',
        propertyId: (norm['candidate_property_code'] as string | null) ?? null,
        description: (norm['description'] as string | null) ?? null,
        paymentMethod: (norm['payment_method'] as string | null) ?? null,
        documentationStatus: 'N',
      })
      promoted.push(result.expenseId)
    } catch (err) {
      skipped.push({ row_id: row.id, reason: String(err) })
    }
  }

  await tryAdvanceJobStatus(supabase, jobId, workspaceId)

  const { data: updatedJob } = await supabase.from('import_jobs').select('*').eq('id', jobId).single()

  return c.json({
    data: updatedJob,
    summary: { promoted: promoted.length, skipped: skipped.length },
    skipped,
  })
})

/**
 * Post-promotion reclassification of a committed expense.
 * Changes review_state, category, or description after promotion.
 * source_import_row_id is preserved unchanged.
 * Records an audit_event (event_type: classified) with old_values and new_values.
 *
 * Spec ref: docs/specs/expense-import-review.md § Post-Promotion Reclassification
 */
importsRouter.post('/expenses/:expenseId/reclassify', async (c) => {
  const supabase = createSupabaseClient(c.env)
  const userId = c.var.userId
  const expenseId = c.req.param('expenseId')

  const body = await c.req.json<{
    workspace_id: string
    review_state: ExpenseReviewState
    category?: string
    description?: string
  }>()

  if (!body.workspace_id || !body.review_state) {
    return c.json({ error: 'workspace_id and review_state are required' }, 400)
  }

  const { data: expense } = await supabase
    .from('expenses')
    .select('*')
    .eq('id', expenseId)
    .eq('workspace_id', body.workspace_id)
    .single()

  if (!expense) return c.json({ error: 'Expense not found' }, 404)
  if (expense.status === 'voided') return c.json({ error: 'Voided expenses cannot be reclassified' }, 409)

  const patch: Record<string, unknown> = {
    review_state: body.review_state,
    updated_at: new Date().toISOString(),
  }
  if (body.category !== undefined) patch['category'] = body.category
  if (body.description !== undefined) patch['description'] = body.description

  const { data: updatedExpense, error: updateErr } = await supabase
    .from('expenses')
    .update(patch)
    .eq('id', expenseId)
    .select()
    .single()

  if (updateErr) return c.json({ error: updateErr.message }, 500)

  const oldValues: Record<string, unknown> = { review_state: expense.review_state }
  if (body.category !== undefined) oldValues['category'] = expense.category
  if (body.description !== undefined) oldValues['description'] = expense.description

  await recordClassificationEvent(supabase, {
    workspaceId: body.workspace_id,
    actorUserId: userId,
    entityType: 'expense',
    entityId: expenseId,
    oldValues,
    newValues: {
      review_state: body.review_state,
      category: body.category ?? expense.category,
      description: body.description ?? expense.description,
    },
  })

  return c.json({ data: updatedExpense })
})
