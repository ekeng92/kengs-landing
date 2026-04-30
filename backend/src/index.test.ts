import { describe, expect, it } from 'vitest'
import { app } from './index'

const env = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
}

describe('worker app routes', () => {
  it('returns health without authentication', async () => {
    const res = await app.request('/health', {}, env)

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({ status: 'ok' })
  })

  it('rejects protected task routes without a bearer token', async () => {
    const res = await app.request('/tasks?workspace_id=workspace-1', {}, env)

    expect(res.status).toBe(401)
    await expect(res.json()).resolves.toEqual({ error: 'Unauthorized' })
  })
})
