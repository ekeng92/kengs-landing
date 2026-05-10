import { describe, expect, it } from 'vitest'
import { app } from '../index'
import { createMockSupabase } from '../../test/mock-supabase'

const baseEnv = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
  DEV_BYPASS_AUTH: 'true',
  DEV_USER_ID: 'user-1',
  DEV_WORKSPACE_ID: 'workspace-1',
}

const sampleJob = {
  id: 'job-1',
  workspace_id: 'workspace-1',
  import_type: 'expense_csv',
  status: 'uploaded',
  original_filename: 'statement.csv',
}

describe('imports route contracts', () => {
  it('requires workspace_id when listing import jobs before querying', async () => {
    const mock = createMockSupabase([])
    const res = await app.request('/imports', {}, { ...baseEnv, TEST_SUPABASE: mock.client })

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: 'workspace_id is required' })
    expect(mock.tableCalls).toEqual([])
  })

  it('lists recent import jobs for a workspace', async () => {
    const mock = createMockSupabase([{ data: [sampleJob], error: null }])
    const res = await app.request('/imports?workspace_id=workspace-1', {}, { ...baseEnv, TEST_SUPABASE: mock.client })

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ data: [sampleJob] })
    expect(mock.builders[0]?.calls).toEqual([
      { method: 'select', args: ['*'] },
      { method: 'eq', args: ['workspace_id', 'workspace-1'] },
      { method: 'order', args: ['created_at', { ascending: false }] },
      { method: 'limit', args: [50] },
    ])
  })

  it('rejects import job creation without required workspace_id/import_type before inserting', async () => {
    const mock = createMockSupabase([])
    const res = await app.request('/imports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspace_id: 'workspace-1' }),
    }, { ...baseEnv, TEST_SUPABASE: mock.client })

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: 'workspace_id and import_type are required' })
    expect(mock.tableCalls).toEqual([])
  })

  it('creates import jobs with authenticated user attribution', async () => {
    const created = { ...sampleJob, created_by_user_id: 'user-1' }
    const mock = createMockSupabase([{ data: created, error: null }])
    const res = await app.request('/imports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspace_id: 'workspace-1',
        import_type: 'expense_csv',
        original_filename: 'statement.csv',
        storage_path: 'imports/statement.csv',
        metadata: { source: 'chase' },
      }),
    }, { ...baseEnv, TEST_SUPABASE: mock.client })

    expect(res.status).toBe(201)
    await expect(res.json()).resolves.toEqual({ data: created })
    expect(mock.builders[0]?.calls[0]).toEqual({
      method: 'insert',
      args: [expect.objectContaining({
        workspace_id: 'workspace-1',
        created_by_user_id: 'user-1',
        import_type: 'expense_csv',
        original_filename: 'statement.csv',
        storage_path: 'imports/statement.csv',
        metadata: { source: 'chase' },
        status: 'uploaded',
      })],
    })
  })

  it('gets an import job by id when it belongs to the workspace', async () => {
    const mock = createMockSupabase([
      { data: { workspace_id: 'workspace-1' }, error: null },
      { data: sampleJob, error: null },
    ])
    const res = await app.request('/imports/job-1', {}, { ...baseEnv, TEST_SUPABASE: mock.client })

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ data: sampleJob })
  })

  it('forbids an import job from another workspace', async () => {
    const mock = createMockSupabase([{ data: { workspace_id: 'other-workspace' }, error: null }])
    const res = await app.request('/imports/job-1', {}, { ...baseEnv, TEST_SUPABASE: mock.client })

    expect(res.status).toBe(403)
  })

  it('lists import rows only after workspace authorization', async () => {
    const mock = createMockSupabase([
      { data: { workspace_id: 'workspace-1' }, error: null },
      { data: [{ id: 'row-1', import_job_id: 'job-1' }], error: null },
    ])
    const res = await app.request('/imports/job-1/rows', {}, { ...baseEnv, TEST_SUPABASE: mock.client })

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ data: [{ id: 'row-1', import_job_id: 'job-1' }] })
  })

  it('forbids row access for another workspace', async () => {
    const mock = createMockSupabase([{ data: { workspace_id: 'other-workspace' }, error: null }])
    const res = await app.request('/imports/job-1/rows', {}, { ...baseEnv, TEST_SUPABASE: mock.client })

    expect(res.status).toBe(403)
  })

  it('requires csv before parsing expense imports', async () => {
    const mock = createMockSupabase([])
    const res = await app.request('/imports/job-1/parse-expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }, { ...baseEnv, TEST_SUPABASE: mock.client })

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: 'csv field is required' })
    expect(mock.tableCalls).toEqual([])
  })

  it('requires property_id before parsing booking imports', async () => {
    const mock = createMockSupabase([])
    const res = await app.request('/imports/job-1/parse-bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csv: 'header\nrow' }),
    }, { ...baseEnv, TEST_SUPABASE: mock.client })

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: 'property_id is required' })
    expect(mock.tableCalls).toEqual([])
  })

  // ─── detect-format ──────────────────────────────────────────────────────────

  it('detect-format returns 404 when job not found', async () => {
    const mock = createMockSupabase([
      { data: null, error: { message: 'not found' } },
    ])
    const res = await app.request('/imports/job-1/detect-format', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csv: 'Date,Amount\n01/01/2026,100' }),
    }, { ...baseEnv, TEST_SUPABASE: mock.client })

    expect(res.status).toBe(404)
  })

  it('detect-format returns empty matches when no templates match', async () => {
    const mock = createMockSupabase([
      { data: { workspace_id: 'workspace-1' }, error: null }, // job lookup
      { data: [], error: null }, // templates lookup
    ])
    const res = await app.request('/imports/job-1/detect-format', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csv: 'Foo,Bar\n1,2' }),
    }, { ...baseEnv, TEST_SUPABASE: mock.client })

    expect(res.status).toBe(200)
    const json = await res.json() as { fingerprint: string; matches: unknown[]; auto_selected: boolean }
    expect(json.fingerprint).toMatch(/^[0-9a-f]{32}$/)
    expect(json.matches).toHaveLength(0)
    expect(json.auto_selected).toBe(false)
  })

  it('detect-format returns matches when templates exist', async () => {
    const mock = createMockSupabase([
      { data: { workspace_id: 'workspace-1' }, error: null },
      { data: [{
        id: 'tmpl-1',
        name: 'Chase Checking',
        entity_type: 'expense',
        column_map: { date: 'Date', amount: 'Amount', merchant: 'Description' },
        amount_sign: 'negative_is_debit',
        date_format: 'auto',
        header_fingerprint: null,
      }], error: null },
    ])
    const res = await app.request('/imports/job-1/detect-format', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csv: 'Date,Amount,Description\n01/01/2026,100,Store' }),
    }, { ...baseEnv, TEST_SUPABASE: mock.client })

    expect(res.status).toBe(200)
    const json = await res.json() as { fingerprint: string; matches: Array<{ template_id: string; confidence: number }>; auto_selected: boolean }
    expect(json.matches).toHaveLength(1)
    expect(json.matches[0]!.template_id).toBe('tmpl-1')
    expect(json.matches[0]!.confidence).toBe(1)
    expect(json.auto_selected).toBe(true)
  })

  it('detect-format rejects missing csv field', async () => {
    const mock = createMockSupabase([])
    const res = await app.request('/imports/job-1/detect-format', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }, { ...baseEnv, TEST_SUPABASE: mock.client })

    expect(res.status).toBe(400)
  })

  it('detect-format auto-selects when single high-confidence match', async () => {
    const mock = createMockSupabase([
      { data: { workspace_id: 'workspace-1' }, error: null },
      { data: [{
        id: 'tmpl-1',
        name: 'Chase',
        entity_type: 'expense',
        column_map: { date: 'Date', amount: 'Amount' },
        amount_sign: 'negative_is_debit',
        date_format: 'auto',
        header_fingerprint: null,
      }], error: null },
      { data: null, error: null }, // update import_jobs
    ])
    const res = await app.request('/imports/job-1/detect-format', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csv: 'Date,Amount\n01/01/2026,100' }),
    }, { ...baseEnv, TEST_SUPABASE: mock.client })

    expect(res.status).toBe(200)
    const json = await res.json() as { auto_selected: boolean }
    expect(json.auto_selected).toBe(true)
    // Verify the update call was made to import_jobs
    expect(mock.tableCalls).toContain('import_jobs')
  })
})
