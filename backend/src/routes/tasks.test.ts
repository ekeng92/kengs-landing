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

const sampleTask = {
  id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  ref_code: 'AEON-001',
  workspace_id: TEST_WORKSPACE,
  title: 'Pull Freestone CAD split',
  status: 'waiting',
  priority: 'high',
  project: 'kengs-landing',
  tags: ['tax'],
  due_date: '2026-05-01',
  effort: 'quick',
  context: 'computer',
  blocked_reason: 'Need CAD statement',
}

describe('tasks route contracts', () => {
  it('requires workspace_id when listing tasks', async () => {
    const mock = createMockSupabase([])
    const res = await app.request('/tasks', {}, { ...baseEnv, TEST_SUPABASE: mock.client })

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({
      error: expect.stringContaining('workspace_id'),
    })
    expect(mock.tableCalls).toEqual([])
  })

  it('lists tasks with project/priority/context filters and deterministic ordering', async () => {
    const mock = createMockSupabase([{ data: [sampleTask], error: null }])
    const res = await app.request(
      `/tasks?workspace_id=${TEST_WORKSPACE}&project=kengs-landing&priority=high&context=computer`,
      {},
      { ...baseEnv, TEST_SUPABASE: mock.client }
    )

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ data: [sampleTask] })
    expect(mock.tableCalls).toEqual(['tasks'])
    expect(mock.builders[0]?.calls).toEqual([
      { method: 'select', args: ['*'] },
      { method: 'eq', args: ['workspace_id', TEST_WORKSPACE] },
      { method: 'eq', args: ['project', 'kengs-landing'] },
      { method: 'eq', args: ['priority', 'high'] },
      { method: 'eq', args: ['context', 'computer'] },
      { method: 'order', args: ['due_date', { ascending: true, nullsFirst: false }] },
      { method: 'order', args: ['created_at', { ascending: false }] },
    ])
  })

  it('creates a task with planning metadata and authenticated user attribution', async () => {
    const created = { ...sampleTask, created_by: TEST_USER }
    const mock = createMockSupabase([{ data: created, error: null }])
    const res = await app.request('/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspace_id: TEST_WORKSPACE,
        title: sampleTask.title,
        status: 'waiting',
        priority: 'high',
        project: 'kengs-landing',
        tags: ['tax'],
        due_date: '2026-05-01',
        effort: 'quick',
        context: 'computer',
        blocked_reason: 'Need CAD statement',
      }),
    }, { ...baseEnv, TEST_SUPABASE: mock.client })

    expect(res.status).toBe(201)
    await expect(res.json()).resolves.toEqual({ data: created })
    expect(mock.builders[0]?.calls[0]).toEqual({
      method: 'insert',
      args: [expect.objectContaining({
        workspace_id: TEST_WORKSPACE,
        title: sampleTask.title,
        status: 'waiting',
        priority: 'high',
        project: 'kengs-landing',
        tags: ['tax'],
        due_date: '2026-05-01',
        effort: 'quick',
        context: 'computer',
        blocked_reason: 'Need CAD statement',
        created_by: TEST_USER,
      })],
    })
  })

  it('rejects task creation without required title/workspace_id before inserting', async () => {
    const mock = createMockSupabase([])
    const res = await app.request('/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspace_id: TEST_WORKSPACE }),
    }, { ...baseEnv, TEST_SUPABASE: mock.client })

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({
      error: expect.stringContaining('title'),
    })
    expect(mock.tableCalls).toEqual([])
  })

  it('allows moving tasks into the Waiting / Blocked lane', async () => {
    const moved = { ...sampleTask, status: 'waiting' }
    const mock = createMockSupabase([{ data: moved, error: null }])
    const res = await app.request('/tasks/AEON-001/move', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'waiting' }),
    }, { ...baseEnv, TEST_SUPABASE: mock.client })

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ data: moved })
    expect(mock.builders[0]?.calls).toEqual([
      { method: 'update', args: [expect.objectContaining({ status: 'waiting' })] },
      { method: 'eq', args: ['ref_code', 'AEON-001'] },
      { method: 'select', args: [] },
      { method: 'single', args: [] },
    ])
  })

  it('rejects invalid move statuses before updating', async () => {
    const mock = createMockSupabase([])
    const res = await app.request('/tasks/AEON-001/move', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'blocked-ish' }),
    }, { ...baseEnv, TEST_SUPABASE: mock.client })

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({
      error: 'Invalid status. Must be one of: backlog, todo, in_progress, review, waiting, done, archived',
    })
    expect(mock.tableCalls).toEqual([])
  })

  it('bulk creates brainstorm tasks with defaults and metadata', async () => {
    const mock = createMockSupabase([{ data: [sampleTask], error: null }])
    const res = await app.request('/tasks/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspace_id: TEST_WORKSPACE,
        tasks: [{ title: 'Create guest guide', context: 'computer', tags: ['guest'] }],
      }),
    }, { ...baseEnv, TEST_SUPABASE: mock.client })

    expect(res.status).toBe(201)
    await expect(res.json()).resolves.toEqual({ data: [sampleTask], count: 1 })
    expect(mock.builders[0]?.calls[0]).toEqual({
      method: 'insert',
      args: [[expect.objectContaining({
        workspace_id: TEST_WORKSPACE,
        title: 'Create guest guide',
        status: 'backlog',
        priority: 'medium',
        context: 'computer',
        tags: ['guest'],
        created_by: TEST_USER,
      })]],
    })
  })
})
