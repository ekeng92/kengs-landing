// author: AEON Dev | created: 2026-04-19 | last updated: 2026-04-20
// Promote an approved import_row into a committed expense.
// Handles: tax_period derivation, expense INSERT, import_row UPDATE, audit_event INSERT.
// Spec ref: docs/specs/expense-import-review.md § Field-Level Decisions At Promotion Time

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  PromotionInput,
  PromoteResult,
  TaxPeriod,
} from './types.js';

// ---------------------------------------------------------------------------
// Derive tax_period from a transaction_date relative to a property's
// placed_in_service_date. Property-null expenses default to Operational.
// Spec ref: expense-import-review.md § Field-Level Decisions At Promotion Time
// ---------------------------------------------------------------------------
function deriveTaxPeriod(
  transactionDate: string,
  placedInServiceDate: string | null | undefined
): TaxPeriod {
  if (!placedInServiceDate) return 'Operational';
  return transactionDate < placedInServiceDate ? 'Pre-Service' : 'Operational';
}

// ---------------------------------------------------------------------------
// Promote a single approved import_row into a committed expense.
// This is the durable boundary: all reporting uses committed expenses only.
// ---------------------------------------------------------------------------
export async function promoteRow(
  supabase: SupabaseClient,
  input: PromotionInput
): Promise<PromoteResult> {
  // 1. Fetch the import_row to get normalized payload
  const { data: importRow, error: rowErr } = await (
    supabase
      .from('import_rows')
      .select('*')
      .eq('id', input.importRowId)
      .single()
  ) as { data: Record<string, unknown> | null; error: unknown };

  if (rowErr || !importRow) {
    throw new Error(`import_row ${input.importRowId} not found: ${rowErr}`);
  }

  if (importRow.review_status === 'promoted') {
    throw new Error(`import_row ${input.importRowId} already promoted — idempotency guard`);
  }

  const normalized = importRow.normalized_payload as Record<string, unknown>;
  if (!normalized) {
    throw new Error(`import_row ${input.importRowId} has no normalized_payload — cannot promote`);
  }

  // 2. Resolve property placed_in_service_date for tax_period derivation
  let placedInServiceDate: string | null = null;
  if (input.propertyId) {
    const { data: property } = await (
      supabase
        .from('properties')
        .select('placed_in_service_date')
        .eq('id', input.propertyId)
        .single()
    ) as { data: Record<string, unknown> | null; error: unknown };
    placedInServiceDate = (property?.placed_in_service_date as string) ?? null;
  }

  const transactionDate = normalized.transaction_date as string;
  const taxPeriod = deriveTaxPeriod(transactionDate, placedInServiceDate);

  // 3. Insert committed expense
  const newExpense: Record<string, unknown> = {
    workspace_id: input.workspaceId,
    property_id: input.propertyId ?? null,
    transaction_date: transactionDate,
    merchant_name: normalized.merchant_name as string ?? null,
    description: input.description ?? normalized.description ?? null,
    category: input.category,
    amount: normalized.amount as number,
    payment_method: input.paymentMethod ?? normalized.payment_method ?? null,
    review_state: input.reviewState,
    tax_period: taxPeriod,
    documentation_status: input.documentationStatus ?? 'N',
    needs_receipt_followup: false,
    status: 'committed',
    source_import_row_id: input.importRowId,
  };

  const { data: expense, error: expenseErr } = await (
    supabase
      .from('expenses')
      .insert(newExpense)
      .select('id')
      .single()
  ) as { data: Record<string, unknown> | null; error: unknown };

  if (expenseErr || !expense) {
    throw new Error(`Failed to insert expense for import_row ${input.importRowId}: ${expenseErr}`);
  }

  const expenseId = expense.id as string;

  // 4. Update import_row: mark promoted, record promoted_entity_id
  const { error: updateErr } = await supabase
    .from('import_rows')
    .update({
      review_status: 'promoted',
      promoted_entity_type: 'expense',
      promoted_entity_id: expenseId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.importRowId);

  if (updateErr) {
    throw new Error(
      `Expense created (${expenseId}) but failed to update import_row ${input.importRowId}: ${updateErr}`
    );
  }

  // 5. Insert audit_event: promoted
  await supabase
    .from('audit_events')
    .insert({
      workspace_id: input.workspaceId,
      actor_user_id: input.actorUserId,
      entity_type: 'expense',
      entity_id: expenseId,
      event_type: 'promoted',
      old_values: null,
      new_values: {
        expense_id: expenseId,
        source_import_row_id: input.importRowId,
        review_state: input.reviewState,
        tax_period: taxPeriod,
        category: input.category,
      },
      metadata: {
        source_import_row_id: input.importRowId,
      },
    })
    .select('id')
    .single();

  return { expenseId, taxPeriod };
}

// ---------------------------------------------------------------------------
// Record a classification audit event for a staged import_row (pre-promotion)
// or a committed expense (post-promotion reclassification).
// Spec ref: expense-import-review.md § Review Queue Interaction (step 6)
//           expense-import-review.md § Post-Promotion Reclassification (step 2)
// ---------------------------------------------------------------------------
export async function recordClassificationEvent(
  supabase: SupabaseClient,
  opts: {
    workspaceId: string;
    actorUserId: string;
    entityType: 'import_row' | 'expense';
    entityId: string;
    oldValues: Record<string, unknown> | null;
    newValues: Record<string, unknown>;
  }
): Promise<void> {
  await supabase
    .from('audit_events')
    .insert({
      workspace_id: opts.workspaceId,
      actor_user_id: opts.actorUserId,
      entity_type: opts.entityType,
      entity_id: opts.entityId,
      event_type: 'classified',
      old_values: opts.oldValues,
      new_values: opts.newValues,
      metadata: null,
    })
    .select('id')
    .single();
}

// ---------------------------------------------------------------------------
// Advance the import_job status once all rows are resolved.
// A job is promoted when every row is either 'promoted' or 'rejected'.
// ---------------------------------------------------------------------------
export async function tryAdvanceJobStatus(
  supabase: SupabaseClient,
  jobId: string,
  workspaceId: string
): Promise<void> {
  // Fetch all rows for the job
  const { data: rows } = await (
    supabase
      .from('import_rows')
      .select('review_status')
      .eq('import_job_id', jobId)
  ) as { data: Array<{ review_status: string }> | null; error: unknown };

  if (!rows || rows.length === 0) return;

  const unresolved = rows.filter(
    (r) => r.review_status !== 'promoted' && r.review_status !== 'rejected'
  );

  if (unresolved.length === 0) {
    await supabase
      .from('import_jobs')
      .update({ status: 'promoted', updated_at: new Date().toISOString() })
      .eq('id', jobId);
  }
}
