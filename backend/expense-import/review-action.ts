// author: AEON Dev | created: 2026-04-19 | last updated: 2026-04-19
// Edge Function: POST /expense-import/review-action
//
// Handles three user actions on a staged import_row:
//   classify  — set review_state + fields; mark approved; write audit event
//   reject    — mark rejected; write audit event
//   promote   — promote an approved row into a committed expense
//
// Also handles: POST /expense-import/reclassify
//   reclassify — post-promotion expense reclassification; writes audit event
//
// Spec ref: docs/specs/expense-import-review.md § Review Queue Interaction
//           docs/specs/expense-import-review.md § Post-Promotion Reclassification

import { promoteRow, recordClassificationEvent, tryAdvanceJobStatus } from './promote.js';
import type {
  ExpenseReviewState,
  DocumentationStatus,
  PromotionInput,
} from './types.js';

// ---------------------------------------------------------------------------
// Request body shapes
// ---------------------------------------------------------------------------
interface ClassifyBody {
  action: 'classify';
  import_row_id: string;
  import_job_id: string;
  workspace_id: string;
  review_state: ExpenseReviewState;
  category: string;
  property_id?: string | null;
  description?: string | null;
  payment_method?: string | null;
  documentation_status?: DocumentationStatus;
}

interface RejectBody {
  action: 'reject';
  import_row_id: string;
  import_job_id: string;
  workspace_id: string;
  reason?: string;
}

interface PromoteBody {
  action: 'promote';
  import_row_id: string;
  import_job_id: string;
  workspace_id: string;
  review_state: ExpenseReviewState;
  category: string;
  property_id?: string | null;
  description?: string | null;
  payment_method?: string | null;
  documentation_status?: DocumentationStatus;
}

interface ReclassifyBody {
  action: 'reclassify';
  expense_id: string;
  workspace_id: string;
  review_state: ExpenseReviewState;
  category?: string;
  description?: string;
}

type ActionBody = ClassifyBody | RejectBody | PromoteBody | ReclassifyBody;

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
export async function onRequestPost(context: {
  request: Request;
  env: {
    SUPABASE_URL: string;
    SUPABASE_SERVICE_KEY: string;
  };
}): Promise<Response> {
  const { request, env } = context;

  const auth = request.headers.get('Authorization') ?? '';
  const actorUserId = extractUserIdFromJwt(auth);
  if (!actorUserId) return json({ error: 'Unauthorized' }, 401);

  let body: ActionBody;
  try {
    body = await request.json() as ActionBody;
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const supabase = buildSupabaseClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

  if (body.action === 'classify') {
    return handleClassify(supabase, body as ClassifyBody, actorUserId);
  }
  if (body.action === 'reject') {
    return handleReject(supabase, body as RejectBody, actorUserId);
  }
  if (body.action === 'promote') {
    return handlePromote(supabase, body as PromoteBody, actorUserId);
  }
  if (body.action === 'reclassify') {
    return handleReclassify(supabase, body as ReclassifyBody, actorUserId);
  }

  return json({ error: 'Unknown action' }, 400);
}

// ---------------------------------------------------------------------------
// classify: record user's classification decision on the import_row.
// Sets review_status to 'approved'. Promotion is a separate explicit action.
// ---------------------------------------------------------------------------
async function handleClassify(
  supabase: ReturnType<typeof buildSupabaseClient>,
  body: ClassifyBody,
  actorUserId: string
): Promise<Response> {
  // Fetch current row for audit diff
  const { data: currentRow, error: rowErr } = await supabase
    .from('import_rows')
    .select('*')
    .eq('id', body.import_row_id)
    .single() as { data: Record<string, unknown> | null; error: unknown };

  if (rowErr || !currentRow) {
    return json({ error: `import_row ${body.import_row_id} not found` }, 404);
  }

  if (currentRow.review_status === 'promoted') {
    return json({ error: 'Row already promoted — use reclassify action on the expense' }, 409);
  }

  // Merge classification into normalized_payload as a user-confirmed overlay
  const existingNorm = (currentRow.normalized_payload as Record<string, unknown>) ?? {};
  const updatedNorm = {
    ...existingNorm,
    candidate_review_state: body.review_state,
    candidate_category: body.category,
    candidate_property_code: body.property_id ?? existingNorm.candidate_property_code ?? null,
    description: body.description ?? existingNorm.description ?? null,
    payment_method: body.payment_method ?? existingNorm.payment_method ?? null,
  };

  const { error: updateErr } = await supabase
    .from('import_rows')
    .update({
      review_status: 'approved',
      normalized_payload: updatedNorm,
      updated_at: new Date().toISOString(),
    })
    .eq('id', body.import_row_id);

  if (updateErr) return json({ error: 'Failed to classify row' }, 500);

  await recordClassificationEvent(supabase as never, {
    workspaceId: body.workspace_id,
    actorUserId,
    entityType: 'import_row',
    entityId: body.import_row_id,
    oldValues: {
      review_status: currentRow.review_status,
      candidate_review_state: existingNorm.candidate_review_state ?? null,
    },
    newValues: {
      review_status: 'approved',
      review_state: body.review_state,
      category: body.category,
      property_id: body.property_id ?? null,
    },
  });

  return json({ ok: true, import_row_id: body.import_row_id, review_status: 'approved' });
}

// ---------------------------------------------------------------------------
// reject: user explicitly excludes this row from promotion.
// ---------------------------------------------------------------------------
async function handleReject(
  supabase: ReturnType<typeof buildSupabaseClient>,
  body: RejectBody,
  actorUserId: string
): Promise<Response> {
  const { data: currentRow } = await supabase
    .from('import_rows')
    .select('review_status')
    .eq('id', body.import_row_id)
    .single() as { data: Record<string, unknown> | null; error: unknown };

  if (!currentRow) return json({ error: `import_row ${body.import_row_id} not found` }, 404);
  if (currentRow.review_status === 'promoted') {
    return json({ error: 'Row already promoted and cannot be rejected' }, 409);
  }

  const { error: updateErr } = await supabase
    .from('import_rows')
    .update({
      review_status: 'rejected',
      updated_at: new Date().toISOString(),
    })
    .eq('id', body.import_row_id);

  if (updateErr) return json({ error: 'Failed to reject row' }, 500);

  await recordClassificationEvent(supabase as never, {
    workspaceId: body.workspace_id,
    actorUserId,
    entityType: 'import_row',
    entityId: body.import_row_id,
    oldValues: { review_status: currentRow.review_status },
    newValues: { review_status: 'rejected', reason: body.reason ?? null },
  });

  await tryAdvanceJobStatus(supabase as never, body.import_job_id, body.workspace_id);

  return json({ ok: true, import_row_id: body.import_row_id, review_status: 'rejected' });
}

// ---------------------------------------------------------------------------
// promote: promote an approved import_row into a committed expense.
// Caller must have already classified the row (review_status = approved).
// ---------------------------------------------------------------------------
async function handlePromote(
  supabase: ReturnType<typeof buildSupabaseClient>,
  body: PromoteBody,
  actorUserId: string
): Promise<Response> {
  const input: PromotionInput = {
    importRowId: body.import_row_id,
    workspaceId: body.workspace_id,
    actorUserId,
    reviewState: body.review_state,
    category: body.category,
    propertyId: body.property_id ?? null,
    description: body.description ?? null,
    paymentMethod: body.payment_method ?? null,
    documentationStatus: body.documentation_status ?? 'N',
  };

  let result;
  try {
    result = await promoteRow(supabase as never, input);
  } catch (err) {
    return json({ error: String(err) }, 500);
  }

  await tryAdvanceJobStatus(supabase as never, body.import_job_id, body.workspace_id);

  return json({
    ok: true,
    expense_id: result.expenseId,
    tax_period: result.taxPeriod,
  });
}

// ---------------------------------------------------------------------------
// reclassify: post-promotion expense reclassification.
// Spec: expense-import-review.md § Post-Promotion Reclassification
// ---------------------------------------------------------------------------
async function handleReclassify(
  supabase: ReturnType<typeof buildSupabaseClient>,
  body: ReclassifyBody,
  actorUserId: string
): Promise<Response> {
  const { data: expense } = await supabase
    .from('expenses')
    .select('*')
    .eq('id', body.expense_id)
    .single() as { data: Record<string, unknown> | null; error: unknown };

  if (!expense) return json({ error: `expense ${body.expense_id} not found` }, 404);
  if (expense.workspace_id !== body.workspace_id) {
    return json({ error: 'Expense does not belong to this workspace' }, 403);
  }
  if (expense.status === 'voided') {
    return json({ error: 'Voided expenses cannot be reclassified' }, 409);
  }

  const patch: Record<string, unknown> = {
    review_state: body.review_state,
    updated_at: new Date().toISOString(),
  };
  if (body.category) patch.category = body.category;
  if (body.description) patch.description = body.description;

  const { error: updateErr } = await supabase
    .from('expenses')
    .update(patch)
    .eq('id', body.expense_id);

  if (updateErr) return json({ error: 'Failed to reclassify expense' }, 500);

  const oldValues: Record<string, unknown> = { review_state: expense.review_state };
  if (body.category) oldValues.category = expense.category;
  if (body.description) oldValues.description = expense.description;

  await recordClassificationEvent(supabase as never, {
    workspaceId: body.workspace_id,
    actorUserId,
    entityType: 'expense',
    entityId: body.expense_id,
    oldValues,
    newValues: {
      review_state: body.review_state,
      category: body.category ?? expense.category,
      description: body.description ?? expense.description,
    },
  });

  return json({ ok: true, expense_id: body.expense_id });
}

// ---------------------------------------------------------------------------
// Shared helpers (duplicated from ingest.ts intentionally — edge functions
// are deployed independently and should not share a module path at runtime)
// ---------------------------------------------------------------------------
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function extractUserIdFromJwt(authHeader: string): string | null {
  try {
    const token = authHeader.replace(/^Bearer\s+/i, '');
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

function buildSupabaseClient(url: string, serviceKey: string) {
  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };

  const from = (table: string) => {
    const base = `${url}/rest/v1/${table}`;
    return {
      select: (cols: string) => ({
        eq: (col: string, val: string) => ({
          single: async () => {
            const res = await fetch(`${base}?select=${cols}&${col}=eq.${val}&limit=1`, {
              headers: { ...headers, Accept: 'application/vnd.pgrst.object+json' },
            });
            const data = res.ok ? await res.json() : null;
            return { data, error: res.ok ? null : await res.text() };
          },
        }),
      }),
      insert: (row: Record<string, unknown>) => ({
        select: (cols: string) => ({
          single: async () => {
            const res = await fetch(`${base}?select=${cols}`, {
              method: 'POST',
              headers,
              body: JSON.stringify(row),
            });
            const data = res.ok ? await res.json() : null;
            return { data, error: res.ok ? null : await res.text() };
          },
        }),
      }),
      update: (patch: Record<string, unknown>) => ({
        eq: async (col: string, val: string) => {
          const res = await fetch(`${base}?${col}=eq.${val}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify(patch),
          });
          return { error: res.ok ? null : await res.text() };
        },
      }),
    };
  };

  return { from };
}
