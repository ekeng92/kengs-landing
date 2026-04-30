import { describe, expect, it } from 'vitest'
import { app } from '../index'
import { createMockSupabase } from '../../test/mock-supabase'

const baseEnv = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
  DEV_BYPASS_AUTH: 'true',
  DEV_USER_ID: 'user-1',
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
})
