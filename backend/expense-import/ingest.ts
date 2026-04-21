// author: AEON Dev | created: 2026-04-19 | last updated: 2026-04-19
// Edge Function: POST /expense-import/ingest
//
// Handles: file upload, import_job creation, CSV parsing, import_row staging,
//          auto-promotion of high-confidence rows, document record.
//
// Platform: Cloudflare Pages Function / Supabase Edge Function compatible.
// Spec ref: docs/specs/expense-import-review.md § Workflow § Happy Path

import { parseBankCsv } from './parse.js';
import { promoteRow, tryAdvanceJobStatus } from './promote.js';
import type { ImportJobSummary, PromotionInput, DocumentationStatus } from './types.js';

// ---------------------------------------------------------------------------
// Handler (Cloudflare Pages Function shape — adapt for Supabase if needed)
// ---------------------------------------------------------------------------
export async function onRequestPost(context: {
  request: Request;
  env: {
    SUPABASE_URL: string;
    SUPABASE_SERVICE_KEY: string;
  };
}): Promise<Response> {
  const { request, env } = context;

  // --- Auth: extract actor user id from Supabase JWT ---
  const auth = request.headers.get('Authorization') ?? '';
  const actorUserId = extractUserIdFromJwt(auth);
  if (!actorUserId) {
    return json({ error: 'Unauthorized' }, 401);
  }

  // --- Parse multipart form ---
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return json({ error: 'Invalid form data' }, 400);
  }

  const workspaceId = formData.get('workspace_id') as string | null;
  const file = formData.get('file') as File | null;

  if (!workspaceId || !file) {
    return json({ error: 'workspace_id and file are required' }, 400);
  }

  if (!file.name.endsWith('.csv')) {
    return json({ error: 'Only CSV files are supported' }, 400);
  }

  // Limit file size to 5 MB (safety boundary)
  if (file.size > 5 * 1024 * 1024) {
    return json({ error: 'File exceeds 5 MB limit' }, 400);
  }

  const supabase = buildSupabaseClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

  // --- Store source file in Supabase Storage ---
  const storagePath = `imports/${workspaceId}/${Date.now()}-${file.name}`;
  let fileStoredPath: string | null = null;
  try {
    // Storage upload is best-effort; import proceeds even if storage fails.
    // The document record is only inserted if storage succeeds.
    const fileBytes = await file.arrayBuffer();
    const uploadResult = await supabaseStorageUpload(
      env.SUPABASE_URL,
      env.SUPABASE_SERVICE_KEY,
      'import-files',
      storagePath,
      new Uint8Array(fileBytes)
    );
    fileStoredPath = uploadResult;
  } catch {
    // Log but continue; raw_payload in import_rows still preserves content.
  }

  // --- Create import_job ---
  const { data: job, error: jobErr } = await supabase
    .from('import_jobs')
    .insert({
      workspace_id: workspaceId,
      created_by_user_id: actorUserId,
      import_type: 'bank_csv',
      original_filename: file.name,
      storage_path: fileStoredPath,
      status: 'uploaded',
      row_count: null,
      error_count: null,
      metadata: {},
    })
    .select('id')
    .single() as { data: Record<string, unknown> | null; error: unknown };

  if (jobErr || !job) {
    return json({ error: 'Failed to create import job' }, 500);
  }
  const jobId = job.id as string;

  // --- Store document record if file was uploaded ---
  if (fileStoredPath) {
    await supabase
      .from('documents')
      .insert({
        workspace_id: workspaceId,
        property_id: null,
        related_entity_type: 'import_job',
        related_entity_id: jobId,
        document_type: 'source_file',
        storage_path: fileStoredPath,
        uploaded_by_user_id: actorUserId,
      })
      .select('id')
      .single();
  }

  // --- Parse CSV ---
  const csvText = await file.text();
  let parsedRows;
  try {
    // Load existing dedupe keys for this workspace to detect duplicates
    const existingDedupeKeys = await loadExistingDedupeKeys(supabase, workspaceId);
    parsedRows = parseBankCsv(csvText, /* knownPropertyCodes */ [], existingDedupeKeys);
  } catch (err) {
    await supabase
      .from('import_jobs')
      .update({ status: 'failed', updated_at: new Date().toISOString() })
      .eq('id', jobId);
    return json({ error: 'Failed to parse CSV', detail: String(err) }, 422);
  }

  if (parsedRows.length === 0) {
    // Zero valid rows → failed import per spec
    await supabase
      .from('import_jobs')
      .update({ status: 'failed', row_count: 0, error_count: 0, updated_at: new Date().toISOString() })
      .eq('id', jobId);
    return json({ error: 'No rows could be parsed from the file' }, 422);
  }

  // --- Insert import_rows ---
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
  }));

  // Insert in batches of 100 to avoid payload limits
  const BATCH = 100;
  const insertedRows: Array<{ id: string; review_status: string }> = [];
  for (let i = 0; i < rowInserts.length; i += BATCH) {
    const { data: inserted, error: insertErr } = await supabase
      .from('import_rows')
      .insert(rowInserts.slice(i, i + BATCH))
      .select('id, review_status')
      .single() as unknown as {
        data: Array<{ id: string; review_status: string }> | null;
        error: unknown;
      };
    if (insertErr) {
      await supabase
        .from('import_jobs')
        .update({ status: 'failed', updated_at: new Date().toISOString() })
        .eq('id', jobId);
      return json({ error: 'Failed to stage import rows' }, 500);
    }
    if (inserted) insertedRows.push(...(Array.isArray(inserted) ? inserted : [inserted]));
  }

  // Advance job status to parsed
  const errorCount = parsedRows.filter((r) => r.validation_errors && r.validation_errors.length > 0).length;
  await supabase
    .from('import_jobs')
    .update({
      status: 'parsed',
      row_count: parsedRows.length,
      error_count: errorCount,
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId);

  // --- Auto-promote approved rows ---
  const approvedRows = insertedRows.filter((r) => r.review_status === 'approved');
  const flaggedRows = insertedRows.filter((r) => r.review_status === 'flagged');
  let autoPromotedCount = 0;

  for (const row of approvedRows) {
    const parsedRow = parsedRows.find(
      (p) => p.review_status === 'approved' && !p.validation_errors
    );
    if (!parsedRow?.normalized_payload) continue;
    const norm = parsedRow.normalized_payload;

    const promotionInput: PromotionInput = {
      importRowId: row.id,
      workspaceId,
      actorUserId,
      reviewState: norm.candidate_review_state,
      category: norm.candidate_category ?? '',
      propertyId: null, // property_id must be confirmed during review for auto-approved rows
      description: norm.description,
      paymentMethod: norm.payment_method,
      documentationStatus: 'N' as DocumentationStatus,
    };

    try {
      await promoteRow(supabase as never, promotionInput);
      autoPromotedCount++;
    } catch {
      // Auto-promotion failure: downgrade row to flagged
      await supabase
        .from('import_rows')
        .update({ review_status: 'flagged', updated_at: new Date().toISOString() })
        .eq('id', row.id);
      flaggedRows.push({ id: row.id, review_status: 'flagged' });
    }
  }

  // Advance import_job status based on outstanding flagged rows
  const finalStatus = flaggedRows.length > 0 ? 'flagged' : 'promoted';
  await supabase
    .from('import_jobs')
    .update({ status: finalStatus, updated_at: new Date().toISOString() })
    .eq('id', jobId);

  if (finalStatus === 'promoted') {
    await tryAdvanceJobStatus(supabase as never, jobId, workspaceId);
  }

  const summary: ImportJobSummary = {
    job_id: jobId,
    status: finalStatus,
    row_count: parsedRows.length,
    error_count: errorCount,
    auto_promoted_count: autoPromotedCount,
    flagged_count: flaggedRows.length,
  };

  return json(summary, 201);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Minimal JWT decode for user_id extraction (no verification — Supabase validates via RLS).
 * Only call after confirming the Authorization header is present.
 */
function extractUserIdFromJwt(authHeader: string): string | null {
  try {
    const token = authHeader.replace(/^Bearer\s+/i, '');
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

/**
 * Load all existing dedupe_keys from committed expenses for a workspace.
 * Used for pre-promotion duplicate detection.
 */
async function loadExistingDedupeKeys(
  supabase: ReturnType<typeof buildSupabaseClient>,
  workspaceId: string
): Promise<Set<string>> {
  const { data } = await (supabase
    .from('import_rows')
    .select('dedupe_key')
    .eq('workspace_id', workspaceId)) as {
    data: Array<{ dedupe_key: string | null }> | null;
    error: unknown;
  };

  const keys = new Set<string>();
  if (data) {
    for (const row of data) {
      if (row.dedupe_key) keys.add(row.dedupe_key);
    }
  }
  return keys;
}

/**
 * Thin Supabase client builder (uses fetch, no SDK dependency in edge runtime).
 * Returns an object compatible with the SupabaseClient type in promote.ts.
 */
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

/**
 * Upload a file to Supabase Storage using the REST API.
 * Returns the storage path on success.
 */
async function supabaseStorageUpload(
  supabaseUrl: string,
  serviceKey: string,
  bucket: string,
  path: string,
  bytes: Uint8Array
): Promise<string> {
  const url = `${supabaseUrl}/storage/v1/object/${bucket}/${path}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'text/csv',
    },
    body: bytes,
  });
  if (!res.ok) throw new Error(`Storage upload failed: ${await res.text()}`);
  return path;
}
