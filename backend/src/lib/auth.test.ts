import { describe, expect, it } from 'vitest'
import { app } from '../index'
import { createMockSupabase } from '../../test/mock-supabase'

const baseEnv = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
  DEV_USER_ID: 'user-1',
}

describe('API key auth', () => {
  it('authenticates with valid X-API-Key header', async () => {
    const mock = createMockSupabase([{ data: [], error: null }])
    const res = await app.request(
      '/tasks?workspace_id=ws-1',
      { headers: { 'X-API-Key': 'test-agent-key' } },
      {
        ...baseEnv,
        AGENT_API_KEY: 'test-agent-key',
        AGENT_USER_ID: 'agent-user-1',
        AGENT_WORKSPACE_ID: 'ws-1',
        TEST_SUPABASE: mock.client,
      }
    )

    expect(res.status).toBe(200)
  })

  it('rejects invalid X-API-Key', async () => {
    const mock = createMockSupabase([])
    const res = await app.request(
      '/tasks?workspace_id=ws-1',
      { headers: { 'X-API-Key': 'wrong-key' } },
      {
        ...baseEnv,
        AGENT_API_KEY: 'test-agent-key',
        TEST_SUPABASE: mock.client,
      }
    )

    expect(res.status).toBe(401)
  })

  it('rejects request with no auth at all', async () => {
    const mock = createMockSupabase([])
    const res = await app.request(
      '/tasks?workspace_id=ws-1',
      {},
      {
        ...baseEnv,
        AGENT_API_KEY: 'test-agent-key',
        TEST_SUPABASE: mock.client,
      }
    )

    expect(res.status).toBe(401)
  })

  it('sets agent userId and workspace_id from env', async () => {
    const created = {
      id: 'task-new',
      ref_code: 'AEON-100',
      workspace_id: 'ws-1',
      title: 'Agent-created task',
      status: 'backlog',
      created_by: 'agent-user-1',
    }
    const mock = createMockSupabase([{ data: [created], error: null }])
    const res = await app.request(
      '/tasks',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'test-agent-key',
        },
        body: JSON.stringify({
          workspace_id: 'ws-1',
          title: 'Agent-created task',
        }),
      },
      {
        ...baseEnv,
        AGENT_API_KEY: 'test-agent-key',
        AGENT_USER_ID: 'agent-user-1',
        AGENT_WORKSPACE_ID: 'ws-1',
        TEST_SUPABASE: mock.client,
      }
    )

    expect(res.status).toBe(201)
    // Verify the insert used the agent's userId for created_by attribution
    const insertCall = mock.builders[0]?.calls.find((c: { method: string }) => c.method === 'insert')
    expect(insertCall?.args[0]).toMatchObject({ created_by: 'agent-user-1' })
  })
})
