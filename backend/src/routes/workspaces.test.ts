import { describe, expect, it } from 'vitest'
import { app } from '../index'
import { createMockSupabase } from '../../test/mock-supabase'

const TEST_WORKSPACE = 'b0604861-b7ae-4f1e-a7cb-fe066d57c623'
const TEST_USER = '63687e6d-c20b-4ea2-9324-64987410e687'

const baseEnv = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
  DEV_BYPASS_AUTH: 'true',
  DEV_USER_ID: TEST_USER,
}

const sampleWorkspace = {
  id: TEST_WORKSPACE,
  name: "Keng's Landing",
}

const sampleMembership = {
  workspace_id: TEST_WORKSPACE,
  role: 'owner',
  workspaces: sampleWorkspace,
}

const sampleMember = {
  id: 'mem-001',
  workspace_id: TEST_WORKSPACE,
  user_id: TEST_USER,
  role: 'owner',
  display_name: 'Eric Keng',
  email: 'eric@example.com',
  feature_access: {},
}

describe('workspaces route contracts', () => {
  it('lists workspaces for the authenticated user', async () => {
    const mock = createMockSupabase([{ data: [sampleMembership], error: null }])
    const res = await app.request('/workspaces', {}, { ...baseEnv, TEST_SUPABASE: mock.client })

    expect(res.status).toBe(200)
    const json: any = await res.json()
    expect(json.data).toEqual([sampleMembership])
    expect(mock.tableCalls).toEqual(['workspace_memberships'])
  })

  it('creates a workspace and assigns owner', async () => {
    const mock = createMockSupabase([
      { data: sampleWorkspace, error: null },  // workspace insert
      { data: null, error: null },             // membership insert
    ])
    const res = await app.request('/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: "Keng's Landing" }),
    }, { ...baseEnv, TEST_SUPABASE: mock.client })

    expect(res.status).toBe(201)
    const json: any = await res.json()
    expect(json.data).toEqual(sampleWorkspace)
    // Should insert into both workspaces and workspace_memberships
    expect(mock.tableCalls).toEqual(['workspaces', 'workspace_memberships'])
  })

  it('gets a single workspace (requires membership)', async () => {
    const mock = createMockSupabase([
      { data: { role: 'owner' }, error: null },     // membership check
      { data: sampleWorkspace, error: null },        // workspace fetch
    ])
    const res = await app.request(`/workspaces/${TEST_WORKSPACE}`, {}, { ...baseEnv, TEST_SUPABASE: mock.client })

    expect(res.status).toBe(200)
    const json: any = await res.json()
    expect(json.data).toEqual(sampleWorkspace)
  })

  it('returns 404 when user has no membership', async () => {
    const mock = createMockSupabase([
      { data: null, error: { message: 'not found' } },
    ])
    const res = await app.request(`/workspaces/${TEST_WORKSPACE}`, {}, { ...baseEnv, TEST_SUPABASE: mock.client })

    expect(res.status).toBe(404)
  })

  it('lists workspace members', async () => {
    const mock = createMockSupabase([{ data: [sampleMember], error: null }])
    const res = await app.request(
      `/workspaces/${TEST_WORKSPACE}/members`,
      {},
      { ...baseEnv, TEST_SUPABASE: mock.client }
    )

    expect(res.status).toBe(200)
    const json: any = await res.json()
    expect(json.data).toEqual([sampleMember])
  })

  it('falls back gracefully when display_name column missing', async () => {
    const mock = createMockSupabase([
      { data: null, error: { message: 'column display_name does not exist' } },
      { data: [{ id: 'mem-001', user_id: TEST_USER, role: 'owner' }], error: null },
    ])
    const res = await app.request(
      `/workspaces/${TEST_WORKSPACE}/members`,
      {},
      { ...baseEnv, TEST_SUPABASE: mock.client }
    )

    expect(res.status).toBe(200)
    const json: any = await res.json()
    expect(json.data).toHaveLength(1)
  })

  it('adds a member with valid role', async () => {
    const mock = createMockSupabase([{ data: sampleMember, error: null }])
    const res = await app.request(`/workspaces/${TEST_WORKSPACE}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        display_name: 'Eric Keng',
        email: 'eric@example.com',
        role: 'owner',
        user_id: TEST_USER,
      }),
    }, { ...baseEnv, TEST_SUPABASE: mock.client })

    expect(res.status).toBe(201)
    const json: any = await res.json()
    expect(json.data).toEqual(sampleMember)
  })

  it('rejects invalid role for member creation', async () => {
    const mock = createMockSupabase([])
    const res = await app.request(`/workspaces/${TEST_WORKSPACE}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        display_name: 'Bad Role',
        role: 'superadmin',
        user_id: 'u-123',
      }),
    }, { ...baseEnv, TEST_SUPABASE: mock.client })

    expect(res.status).toBe(400)
    const json: any = await res.json()
    expect(json.error).toContain('Invalid role')
  })

  it('generates UUID for agent members without user_id', async () => {
    const mock = createMockSupabase([{ data: { ...sampleMember, role: 'agent' }, error: null }])
    const res = await app.request(`/workspaces/${TEST_WORKSPACE}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        display_name: 'AEON Watch',
        role: 'agent',
      }),
    }, { ...baseEnv, TEST_SUPABASE: mock.client })

    expect(res.status).toBe(201)
    // Verify insert was called with a user_id (auto-generated UUID)
    const insertCall = mock.builders[0]?.calls.find(c => c.method === 'insert')
    expect(insertCall).toBeDefined()
    const insertedRow = (insertCall?.args[0] as Record<string, unknown>)
    expect(insertedRow.user_id).toBeDefined()
    expect(typeof insertedRow.user_id).toBe('string')
  })

  it('updates a member role', async () => {
    const updated = { ...sampleMember, role: 'admin' }
    const mock = createMockSupabase([{ data: updated, error: null }])
    const res = await app.request(`/workspaces/${TEST_WORKSPACE}/members/mem-001`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'admin' }),
    }, { ...baseEnv, TEST_SUPABASE: mock.client })

    expect(res.status).toBe(200)
    const json: any = await res.json()
    expect(json.data.role).toBe('admin')
  })

  it('deletes a member', async () => {
    const mock = createMockSupabase([{ data: null, error: null }])
    const res = await app.request(`/workspaces/${TEST_WORKSPACE}/members/mem-001`, {
      method: 'DELETE',
    }, { ...baseEnv, TEST_SUPABASE: mock.client })

    expect(res.status).toBe(200)
    const json: any = await res.json()
    expect(json.success).toBe(true)
  })
})
