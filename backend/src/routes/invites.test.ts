import { describe, it, expect } from 'vitest'
import { app } from '../index'
import { createMockSupabase } from '../../test/mock-supabase'

function makeEnv(supabase: unknown) {
  return {
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-key',
    DEV_BYPASS_AUTH: 'true',
    DEV_USER_ID: 'user-1',
    DEV_WORKSPACE_ID: 'ws-1',
    TEST_SUPABASE: supabase,
  }
}

function makePublicEnv(supabase: unknown) {
  return {
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-key',
    TEST_SUPABASE: supabase,
  }
}

// ─── Public Routes: GET /invites/accept/:token ────────────────────────────────

describe('GET /invites/accept/:token', () => {
  it('returns invite details for a valid token', async () => {
    const mock = createMockSupabase([
      // Invite lookup
      {
        data: {
          id: 'inv-1', email: 'julie@test.com', status: 'pending',
          expires_at: '2099-12-31T00:00:00Z', invited_at: '2026-05-01T00:00:00Z',
          workspace_id: 'ws-1', role_id: 'role-1', custom_scopes: null,
        },
        error: null,
      },
      // Workspace name lookup
      { data: { name: "Keng's Landing" }, error: null },
      // Role name lookup
      { data: { name: 'Cleaner' }, error: null },
      // Inviter membership lookup (for inviter display_name via invite.id fallback)
      { data: null, error: { message: 'not found' } },
      // Re-fetch invited_by
      { data: { invited_by: 'user-1' }, error: null },
      // Inviter display_name lookup
      { data: { display_name: 'Eric Keng' }, error: null },
    ])

    const res = await app.request('/invites/accept/valid_token', {}, makePublicEnv(mock.client))
    expect(res.status).toBe(200)
    const body: any = await res.json()
    expect(body.data.email).toBe('julie@test.com')
    expect(body.data.workspace_name).toBe("Keng's Landing")
    expect(body.data.role_name).toBe('Cleaner')
    expect(body.data.invited_by_name).toBe('Eric Keng')
  })

  it('returns 404 for invalid token', async () => {
    const mock = createMockSupabase([
      { data: null, error: { message: 'not found', code: 'PGRST116' } },
    ])

    const res = await app.request('/invites/accept/bad_token', {}, makePublicEnv(mock.client))
    expect(res.status).toBe(404)
    const body: any = await res.json()
    expect(body.error).toContain('Invalid')
  })

  it('returns 410 for expired token', async () => {
    const mock = createMockSupabase([
      {
        data: {
          id: 'inv-1', email: 'expired@test.com', status: 'pending',
          expires_at: '2020-01-01T00:00:00Z', invited_at: '2019-12-25T00:00:00Z',
          workspace_id: 'ws-1', role_id: null, custom_scopes: null,
        },
        error: null,
      },
    ])

    const res = await app.request('/invites/accept/expired_token', {}, makePublicEnv(mock.client))
    expect(res.status).toBe(410)
    const body: any = await res.json()
    expect(body.error).toContain('expired')
  })
})

// ─── Public Routes: POST /invites/accept/:token ──────────────────────────────

describe('POST /invites/accept/:token', () => {
  it('creates user with password and accepts invite (201)', async () => {
    const mock = createMockSupabase([
      // Invite lookup
      {
        data: {
          id: 'inv-1', email: 'julie@test.com', workspace_id: 'ws-1',
          role_id: 'role-1', custom_scopes: null, status: 'pending',
          expires_at: '2099-12-31T00:00:00Z',
        },
        error: null,
      },
      // Role scopes lookup
      { data: { scopes: { dashboard: 'read', cleaning: 'write' } }, error: null },
      // Membership insert
      { data: null, error: null },
      // Invite update (mark accepted)
      { data: null, error: null },
      // Access log insert
      { data: null, error: null },
    ])

    // Mock supabase.auth.admin
    ;(mock.client as any).auth = {
      admin: {
        createUser: async () => ({
          data: { user: { id: 'new-user-1' } },
          error: null,
        }),
        generateLink: async () => ({ data: null, error: null }),
      },
    }

    const res = await app.request('/invites/accept/valid_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        first_name: 'Julie',
        last_name: 'Smith',
        password: 'securePass123',
      }),
    }, makePublicEnv(mock.client))

    expect(res.status).toBe(201)
    const body: any = await res.json()
    expect(body.data.user_id).toBe('new-user-1')
    expect(body.data.display_name).toBe('Julie Smith')
    expect(body.data.magic_link).toBeNull()
  })

  it('creates user with magic link and accepts invite (201)', async () => {
    const mock = createMockSupabase([
      // Invite lookup
      {
        data: {
          id: 'inv-2', email: 'magic@test.com', workspace_id: 'ws-1',
          role_id: null, custom_scopes: { dashboard: 'read', tasks: 'write' },
          status: 'pending', expires_at: '2099-12-31T00:00:00Z',
        },
        error: null,
      },
      // Membership insert (no role lookup since custom_scopes)
      { data: null, error: null },
      // Invite update
      { data: null, error: null },
      // Access log insert
      { data: null, error: null },
    ])

    ;(mock.client as any).auth = {
      admin: {
        createUser: async () => ({
          data: { user: { id: 'new-user-2' } },
          error: null,
        }),
        generateLink: async () => ({
          data: { properties: { action_link: 'https://test.supabase.co/magic-link' } },
          error: null,
        }),
      },
    }

    const res = await app.request('/invites/accept/valid_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        first_name: 'Magic',
        last_name: 'User',
        use_magic_link: true,
      }),
    }, makePublicEnv(mock.client))

    expect(res.status).toBe(201)
    const body: any = await res.json()
    expect(body.data.user_id).toBe('new-user-2')
    expect(body.data.magic_link).toBe('https://test.supabase.co/magic-link')
  })

  it('returns 404 for invalid token on accept', async () => {
    const mock = createMockSupabase([
      { data: null, error: { message: 'not found' } },
    ])

    const res = await app.request('/invites/accept/bad_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ first_name: 'Test', last_name: 'User', password: 'securePass123' }),
    }, makePublicEnv(mock.client))

    expect(res.status).toBe(404)
  })

  it('returns 410 for expired token on accept', async () => {
    const mock = createMockSupabase([
      {
        data: {
          id: 'inv-1', email: 'expired@test.com', workspace_id: 'ws-1',
          role_id: null, custom_scopes: null, status: 'pending',
          expires_at: '2020-01-01T00:00:00Z',
        },
        error: null,
      },
    ])

    const res = await app.request('/invites/accept/expired_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ first_name: 'Test', last_name: 'User', password: 'securePass123' }),
    }, makePublicEnv(mock.client))

    expect(res.status).toBe(410)
  })

  it('returns 400 when first_name is missing', async () => {
    const mock = createMockSupabase([
      {
        data: {
          id: 'inv-1', email: 'test@test.com', workspace_id: 'ws-1',
          role_id: null, custom_scopes: null, status: 'pending',
          expires_at: '2099-12-31T00:00:00Z',
        },
        error: null,
      },
    ])

    const res = await app.request('/invites/accept/valid_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ last_name: 'User', password: 'securePass123' }),
    }, makePublicEnv(mock.client))

    expect(res.status).toBe(400)
    const body: any = await res.json()
    expect(body.error).toContain('first_name')
  })

  it('returns 400 when password is too short', async () => {
    const mock = createMockSupabase([
      {
        data: {
          id: 'inv-1', email: 'test@test.com', workspace_id: 'ws-1',
          role_id: null, custom_scopes: null, status: 'pending',
          expires_at: '2099-12-31T00:00:00Z',
        },
        error: null,
      },
    ])

    const res = await app.request('/invites/accept/valid_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ first_name: 'Test', last_name: 'User', password: 'short' }),
    }, makePublicEnv(mock.client))

    expect(res.status).toBe(400)
    const body: any = await res.json()
    expect(body.error).toContain('8 characters')
  })

  it('returns 409 when user email already registered', async () => {
    const mock = createMockSupabase([
      {
        data: {
          id: 'inv-1', email: 'existing@test.com', workspace_id: 'ws-1',
          role_id: null, custom_scopes: { dashboard: 'read' }, status: 'pending',
          expires_at: '2099-12-31T00:00:00Z',
        },
        error: null,
      },
    ])

    ;(mock.client as any).auth = {
      admin: {
        createUser: async () => ({
          data: { user: null },
          error: { message: 'User has already been registered' },
        }),
      },
    }

    const res = await app.request('/invites/accept/valid_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ first_name: 'Existing', last_name: 'User', password: 'securePass123' }),
    }, makePublicEnv(mock.client))

    expect(res.status).toBe(409)
    const body: any = await res.json()
    expect(body.error).toContain('already exists')
  })
})

// ─── Admin Routes: POST /invites/roles ────────────────────────────────────────

describe('POST /invites/roles', () => {
  it('creates a custom role (201)', async () => {
    const mock = createMockSupabase([
      // Role insert + select
      {
        data: {
          id: 'role-1', workspace_id: 'ws-1', name: 'Cleaner',
          description: 'Can access cleaning features',
          scopes: { cleaning: 'write', dashboard: 'read' },
          is_system: false,
        },
        error: null,
      },
    ])

    const res = await app.request('/invites/roles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspace_id: 'ws-1',
        name: 'Cleaner',
        description: 'Can access cleaning features',
        scopes: { cleaning: 'write', dashboard: 'read' },
      }),
    }, makeEnv(mock.client))

    expect(res.status).toBe(201)
    const body: any = await res.json()
    expect(body.data.name).toBe('Cleaner')
    expect(body.data.is_system).toBe(false)
  })

  it('returns 400 when name is missing', async () => {
    const mock = createMockSupabase([])

    const res = await app.request('/invites/roles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspace_id: 'ws-1',
        name: '',
        scopes: { dashboard: 'read' },
      }),
    }, makeEnv(mock.client))

    expect(res.status).toBe(400)
    const body: any = await res.json()
    expect(body.error).toContain('name')
  })

  it('returns 400 when scopes are invalid', async () => {
    const mock = createMockSupabase([])

    const res = await app.request('/invites/roles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspace_id: 'ws-1',
        name: 'Bad Role',
        scopes: { dashboard: 'superadmin' },
      }),
    }, makeEnv(mock.client))

    expect(res.status).toBe(400)
    const body: any = await res.json()
    expect(body.error).toContain('Invalid scopes')
  })

  it('returns 409 when duplicate role name exists', async () => {
    const mock = createMockSupabase([
      { data: null, error: { message: 'duplicate key', code: '23505' } },
    ])

    const res = await app.request('/invites/roles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspace_id: 'ws-1',
        name: 'Existing Role',
        scopes: { dashboard: 'read' },
      }),
    }, makeEnv(mock.client))

    expect(res.status).toBe(409)
    const body: any = await res.json()
    expect(body.error).toContain('already exists')
  })
})

// ─── Admin Routes: GET /invites/roles ─────────────────────────────────────────

describe('GET /invites/roles', () => {
  it('returns system and custom roles for workspace', async () => {
    const roles = [
      { id: 'role-sys-1', name: 'Owner', is_system: true, scopes: {} },
      { id: 'role-sys-2', name: 'Admin', is_system: true, scopes: {} },
      { id: 'role-cust-1', name: 'Cleaner', is_system: false, scopes: { cleaning: 'write' } },
    ]
    const mock = createMockSupabase([{ data: roles, error: null }])

    const res = await app.request('/invites/roles?workspace_id=ws-1', {}, makeEnv(mock.client))
    expect(res.status).toBe(200)
    const body: any = await res.json()
    expect(body.data).toHaveLength(3)
    expect(body.data[0].is_system).toBe(true)
  })

  it('returns 400 when workspace_id is missing', async () => {
    const mock = createMockSupabase([])

    const res = await app.request('/invites/roles', {}, makeEnv(mock.client))
    expect(res.status).toBe(400)
  })
})

// ─── Admin Routes: PATCH /invites/roles/:id ───────────────────────────────────

describe('PATCH /invites/roles/:id', () => {
  it('updates a custom role', async () => {
    const mock = createMockSupabase([
      // Fetch existing role
      { data: { id: 'role-1', workspace_id: 'ws-1', is_system: false }, error: null },
      // Update role
      {
        data: {
          id: 'role-1', name: 'Updated Cleaner', workspace_id: 'ws-1',
          scopes: { cleaning: 'admin', dashboard: 'read' }, is_system: false,
        },
        error: null,
      },
    ])

    const res = await app.request('/invites/roles/role-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Updated Cleaner',
        scopes: { cleaning: 'admin', dashboard: 'read' },
      }),
    }, makeEnv(mock.client))

    expect(res.status).toBe(200)
    const body: any = await res.json()
    expect(body.data.name).toBe('Updated Cleaner')
  })

  it('returns 403 when editing a system role', async () => {
    const mock = createMockSupabase([
      { data: { id: 'role-sys-1', workspace_id: 'ws-1', is_system: true }, error: null },
    ])

    const res = await app.request('/invites/roles/role-sys-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Hacked Owner' }),
    }, makeEnv(mock.client))

    expect(res.status).toBe(403)
    const body: any = await res.json()
    expect(body.error).toContain('system')
  })

  it('returns 404 when role does not exist', async () => {
    const mock = createMockSupabase([
      { data: null, error: { message: 'not found' } },
    ])

    const res = await app.request('/invites/roles/nonexistent', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Ghost' }),
    }, makeEnv(mock.client))

    expect(res.status).toBe(404)
  })

  it('returns 400 when scopes are invalid on update', async () => {
    const mock = createMockSupabase([
      { data: { id: 'role-1', workspace_id: 'ws-1', is_system: false }, error: null },
    ])

    const res = await app.request('/invites/roles/role-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scopes: { fake_feature: 'admin' } }),
    }, makeEnv(mock.client))

    expect(res.status).toBe(400)
    const body: any = await res.json()
    expect(body.error).toContain('Invalid scopes')
  })
})

// ─── Admin Routes: DELETE /invites/roles/:id ──────────────────────────────────

describe('DELETE /invites/roles/:id', () => {
  it('deletes a custom role', async () => {
    const mock = createMockSupabase([
      // Fetch existing role
      { data: { id: 'role-1', workspace_id: 'ws-1', is_system: false }, error: null },
      // Delete
      { data: null, error: null },
    ])

    const res = await app.request('/invites/roles/role-1', {
      method: 'DELETE',
    }, makeEnv(mock.client))

    expect(res.status).toBe(200)
    const body: any = await res.json()
    expect(body.success).toBe(true)
  })

  it('returns 403 when deleting a system role', async () => {
    const mock = createMockSupabase([
      { data: { id: 'role-sys-1', workspace_id: 'ws-1', is_system: true }, error: null },
    ])

    const res = await app.request('/invites/roles/role-sys-1', {
      method: 'DELETE',
    }, makeEnv(mock.client))

    expect(res.status).toBe(403)
    const body: any = await res.json()
    expect(body.error).toContain('system')
  })

  it('returns 404 when role does not exist', async () => {
    const mock = createMockSupabase([
      { data: null, error: { message: 'not found' } },
    ])

    const res = await app.request('/invites/roles/nonexistent', {
      method: 'DELETE',
    }, makeEnv(mock.client))

    expect(res.status).toBe(404)
  })
})

// ─── Admin Routes: POST /invites ──────────────────────────────────────────────

describe('POST /invites', () => {
  it('sends an invite with role_id (201)', async () => {
    const mock = createMockSupabase([
      // Role lookup (validate role_id exists)
      { data: { id: 'role-1' }, error: null },
      // Existing invite check
      { data: null, error: { message: 'not found' } },
      // Invite insert
      {
        data: {
          id: 'inv-1', workspace_id: 'ws-1', email: 'newuser@test.com',
          token: 'kl_inv_abc123', role_id: 'role-1', custom_scopes: null,
          status: 'pending', invited_by: 'user-1',
        },
        error: null,
      },
    ])

    const res = await app.request('/invites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspace_id: 'ws-1',
        email: 'newuser@test.com',
        role_id: 'role-1',
      }),
    }, makeEnv(mock.client))

    expect(res.status).toBe(201)
    const body: any = await res.json()
    expect(body.data.email).toBe('newuser@test.com')
    expect(body.data.invite_url).toContain('/invites/accept/')
  })

  it('sends an invite with custom_scopes (201)', async () => {
    const mock = createMockSupabase([
      // Existing invite check (no role_id lookup when using custom_scopes)
      { data: null, error: { message: 'not found' } },
      // Invite insert
      {
        data: {
          id: 'inv-2', workspace_id: 'ws-1', email: 'custom@test.com',
          token: 'kl_inv_def456', role_id: null,
          custom_scopes: { cleaning: 'write', dashboard: 'read' },
          status: 'pending', invited_by: 'user-1',
        },
        error: null,
      },
    ])

    const res = await app.request('/invites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspace_id: 'ws-1',
        email: 'custom@test.com',
        custom_scopes: { cleaning: 'write', dashboard: 'read' },
      }),
    }, makeEnv(mock.client))

    expect(res.status).toBe(201)
    const body: any = await res.json()
    expect(body.data.custom_scopes).toEqual({ cleaning: 'write', dashboard: 'read' })
  })

  it('returns 400 when email is missing', async () => {
    const mock = createMockSupabase([])

    const res = await app.request('/invites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspace_id: 'ws-1',
        role_id: 'role-1',
      }),
    }, makeEnv(mock.client))

    expect(res.status).toBe(400)
    const body: any = await res.json()
    expect(body.error).toContain('email')
  })

  it('returns 400 when email format is invalid', async () => {
    const mock = createMockSupabase([])

    const res = await app.request('/invites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspace_id: 'ws-1',
        email: 'not-an-email',
        role_id: 'role-1',
      }),
    }, makeEnv(mock.client))

    expect(res.status).toBe(400)
    const body: any = await res.json()
    expect(body.error).toContain('email')
  })

  it('returns 400 when both role_id and custom_scopes are provided', async () => {
    const mock = createMockSupabase([])

    const res = await app.request('/invites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspace_id: 'ws-1',
        email: 'test@test.com',
        role_id: 'role-1',
        custom_scopes: { dashboard: 'read' },
      }),
    }, makeEnv(mock.client))

    expect(res.status).toBe(400)
    const body: any = await res.json()
    expect(body.error).toContain('either')
  })

  it('returns 400 when neither role_id nor custom_scopes are provided', async () => {
    const mock = createMockSupabase([])

    const res = await app.request('/invites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspace_id: 'ws-1',
        email: 'test@test.com',
      }),
    }, makeEnv(mock.client))

    expect(res.status).toBe(400)
    const body: any = await res.json()
    expect(body.error).toContain('role_id')
  })

  it('returns 409 when duplicate pending invite exists', async () => {
    const mock = createMockSupabase([
      // Role lookup
      { data: { id: 'role-1' }, error: null },
      // Existing invite check — found one
      { data: { id: 'inv-existing' }, error: null },
    ])

    const res = await app.request('/invites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspace_id: 'ws-1',
        email: 'duplicate@test.com',
        role_id: 'role-1',
      }),
    }, makeEnv(mock.client))

    expect(res.status).toBe(409)
    const body: any = await res.json()
    expect(body.error).toContain('pending invite already exists')
  })

  it('returns 404 when role_id does not exist in workspace', async () => {
    const mock = createMockSupabase([
      // Role lookup — not found
      { data: null, error: { message: 'not found' } },
    ])

    const res = await app.request('/invites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspace_id: 'ws-1',
        email: 'test@test.com',
        role_id: 'nonexistent-role',
      }),
    }, makeEnv(mock.client))

    expect(res.status).toBe(404)
    const body: any = await res.json()
    expect(body.error).toContain('Role not found')
  })

  it('returns 400 when custom_scopes are invalid', async () => {
    const mock = createMockSupabase([])

    const res = await app.request('/invites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspace_id: 'ws-1',
        email: 'test@test.com',
        custom_scopes: { invalid_feature: 'godmode' },
      }),
    }, makeEnv(mock.client))

    expect(res.status).toBe(400)
    const body: any = await res.json()
    expect(body.error).toContain('Invalid custom_scopes')
  })
})

// ─── Admin Routes: GET /invites ───────────────────────────────────────────────

describe('GET /invites', () => {
  it('returns invites for workspace', async () => {
    const invites = [
      { id: 'inv-1', email: 'a@test.com', status: 'pending' },
      { id: 'inv-2', email: 'b@test.com', status: 'accepted' },
    ]
    const mock = createMockSupabase([{ data: invites, error: null }])

    const res = await app.request('/invites?workspace_id=ws-1', {}, makeEnv(mock.client))
    expect(res.status).toBe(200)
    const body: any = await res.json()
    expect(body.data).toHaveLength(2)
  })

  it('filters invites by status', async () => {
    const invites = [
      { id: 'inv-1', email: 'a@test.com', status: 'pending' },
    ]
    const mock = createMockSupabase([{ data: invites, error: null }])

    const res = await app.request('/invites?workspace_id=ws-1&status=pending', {}, makeEnv(mock.client))
    expect(res.status).toBe(200)
    const body: any = await res.json()
    expect(body.data).toHaveLength(1)
    expect(body.data[0].status).toBe('pending')
  })

  it('returns 400 when workspace_id is missing', async () => {
    const mock = createMockSupabase([])

    const res = await app.request('/invites', {}, makeEnv(mock.client))
    expect(res.status).toBe(400)
  })
})

// ─── Admin Routes: PATCH /invites/:id/revoke ──────────────────────────────────

describe('PATCH /invites/:id/revoke', () => {
  it('revokes a pending invite', async () => {
    const mock = createMockSupabase([
      // Fetch invite
      { data: { id: 'inv-1', workspace_id: 'ws-1', status: 'pending' }, error: null },
      // Update status
      {
        data: { id: 'inv-1', status: 'revoked', revoked_at: '2026-05-08T00:00:00Z' },
        error: null,
      },
    ])

    const res = await app.request('/invites/inv-1/revoke', {
      method: 'PATCH',
    }, makeEnv(mock.client))

    expect(res.status).toBe(200)
    const body: any = await res.json()
    expect(body.data.status).toBe('revoked')
  })

  it('returns 400 when revoking a non-pending invite', async () => {
    const mock = createMockSupabase([
      { data: { id: 'inv-1', workspace_id: 'ws-1', status: 'accepted' }, error: null },
    ])

    const res = await app.request('/invites/inv-1/revoke', {
      method: 'PATCH',
    }, makeEnv(mock.client))

    expect(res.status).toBe(400)
    const body: any = await res.json()
    expect(body.error).toContain('accepted')
  })

  it('returns 404 when invite does not exist', async () => {
    const mock = createMockSupabase([
      { data: null, error: { message: 'not found' } },
    ])

    const res = await app.request('/invites/nonexistent/revoke', {
      method: 'PATCH',
    }, makeEnv(mock.client))

    expect(res.status).toBe(404)
  })
})

// ─── Admin Routes: POST /invites/:id/resend ───────────────────────────────────

describe('POST /invites/:id/resend', () => {
  it('resends a pending invite with new token', async () => {
    const mock = createMockSupabase([
      // Fetch invite
      { data: { id: 'inv-1', workspace_id: 'ws-1', status: 'pending' }, error: null },
      // Update token + expiry
      {
        data: {
          id: 'inv-1', token: 'kl_inv_newtoken', status: 'pending',
          expires_at: '2099-12-31T00:00:00Z',
        },
        error: null,
      },
    ])

    const res = await app.request('/invites/inv-1/resend', {
      method: 'POST',
    }, makeEnv(mock.client))

    expect(res.status).toBe(200)
    const body: any = await res.json()
    expect(body.data.invite_url).toContain('/invites/accept/')
  })

  it('returns 400 when resending a non-pending invite', async () => {
    const mock = createMockSupabase([
      { data: { id: 'inv-1', workspace_id: 'ws-1', status: 'revoked' }, error: null },
    ])

    const res = await app.request('/invites/inv-1/resend', {
      method: 'POST',
    }, makeEnv(mock.client))

    expect(res.status).toBe(400)
    const body: any = await res.json()
    expect(body.error).toContain('revoked')
  })

  it('returns 404 when invite does not exist', async () => {
    const mock = createMockSupabase([
      { data: null, error: { message: 'not found' } },
    ])

    const res = await app.request('/invites/nonexistent/resend', {
      method: 'POST',
    }, makeEnv(mock.client))

    expect(res.status).toBe(404)
  })
})

// ─── Admin Routes: GET /invites/access-log ────────────────────────────────────

describe('GET /invites/access-log', () => {
  it('returns access log entries for workspace', async () => {
    const logs = [
      { id: 'log-1', workspace_id: 'ws-1', user_id: 'user-1', event_type: 'invite_accepted', created_at: '2026-05-08T00:00:00Z' },
      { id: 'log-2', workspace_id: 'ws-1', user_id: 'user-2', event_type: 'login', created_at: '2026-05-07T00:00:00Z' },
    ]
    const mock = createMockSupabase([{ data: logs, error: null }])

    const res = await app.request('/invites/access-log?workspace_id=ws-1', {}, makeEnv(mock.client))
    expect(res.status).toBe(200)
    const body: any = await res.json()
    expect(body.data).toHaveLength(2)
  })

  it('filters access log by user_id and event_type', async () => {
    const logs = [
      { id: 'log-1', workspace_id: 'ws-1', user_id: 'user-1', event_type: 'invite_accepted' },
    ]
    const mock = createMockSupabase([{ data: logs, error: null }])

    const res = await app.request(
      '/invites/access-log?workspace_id=ws-1&user_id=user-1&event_type=invite_accepted',
      {},
      makeEnv(mock.client),
    )
    expect(res.status).toBe(200)
    const body: any = await res.json()
    expect(body.data).toHaveLength(1)
    expect(body.data[0].event_type).toBe('invite_accepted')
  })

  it('returns 400 when workspace_id is missing', async () => {
    const mock = createMockSupabase([])

    const res = await app.request('/invites/access-log', {}, makeEnv(mock.client))
    expect(res.status).toBe(400)
  })
})
