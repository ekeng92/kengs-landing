import type { Context } from 'hono'
import { createSupabaseClient } from './supabase'
import type { Env } from '../types/env'
import type { AuthVariables } from './auth'

export type AppFeature =
  | 'dashboard'
  | 'tasks'
  | 'finances'
  | 'bookings'
  | 'expenses'
  | 'mileage'
  | 'imports'
  | 'properties'
  | 'users'
  | 'settings'

export type AccessLevel = 'none' | 'read' | 'write' | 'admin'

export type FeatureAccess = Partial<Record<AppFeature, AccessLevel>>

type AppContext = Context<{ Bindings: Env; Variables: AuthVariables }>

export const ROLE_FEATURE_ACCESS: Record<string, FeatureAccess> = {
  owner: allAccess('admin'),
  admin: allAccess('admin'),
  manager: {
    dashboard: 'read', tasks: 'admin', finances: 'write', bookings: 'write', expenses: 'write',
    mileage: 'write', imports: 'write', properties: 'write', users: 'read', settings: 'none',
  },
  accountant: {
    dashboard: 'read', tasks: 'write', finances: 'admin', bookings: 'read', expenses: 'admin',
    mileage: 'admin', imports: 'write', properties: 'read', users: 'none', settings: 'none',
  },
  reviewer: {
    dashboard: 'read', tasks: 'write', finances: 'read', bookings: 'read', expenses: 'write',
    mileage: 'read', imports: 'none', properties: 'read', users: 'none', settings: 'none',
  },
  agent: {
    dashboard: 'read', tasks: 'admin', finances: 'write', bookings: 'write', expenses: 'write',
    mileage: 'write', imports: 'write', properties: 'read', users: 'none', settings: 'none',
  },
}

const LEVEL_RANK: Record<AccessLevel, number> = { none: 0, read: 1, write: 2, admin: 3 }
const VALID_FEATURES: AppFeature[] = ['dashboard', 'tasks', 'finances', 'bookings', 'expenses', 'mileage', 'imports', 'properties', 'users', 'settings']

function allAccess(level: AccessLevel): FeatureAccess {
  return {
    dashboard: level,
    tasks: level,
    finances: level,
    bookings: level,
    expenses: level,
    mileage: level,
    imports: level,
    properties: level,
    users: level,
    settings: level,
  }
}

export function mergeFeatureAccess(role: string, overrides?: FeatureAccess | null): FeatureAccess {
  return { ...(ROLE_FEATURE_ACCESS[role] ?? ROLE_FEATURE_ACCESS.reviewer), ...(overrides ?? {}) }
}

export function hasFeatureAccess(role: string, overrides: FeatureAccess | null | undefined, feature: AppFeature, minimum: AccessLevel): boolean {
  const access = mergeFeatureAccess(role, overrides)[feature] ?? 'none'
  return LEVEL_RANK[access] >= LEVEL_RANK[minimum]
}

export async function requireWorkspaceFeature(
  c: AppContext,
  workspaceId: string | null | undefined,
  feature: AppFeature,
  minimum: AccessLevel = 'read'
): Promise<Response | null> {
  if (!workspaceId) return c.json({ error: 'workspace_id is required' }, 400)

  // Dev bypass: when DEV_BYPASS_AUTH is enabled, grant full access.
  // If DEV_WORKSPACE_ID is set, constrain to that workspace only.
  if (c.env.DEV_BYPASS_AUTH === 'true') {
    if (!c.env.DEV_WORKSPACE_ID || workspaceId === c.env.DEV_WORKSPACE_ID) return null
    return c.json({ error: 'Forbidden' }, 403)
  }

  // Service-agent auth is constrained to its configured workspace and role-like feature set.
  const agentWorkspaceId = c.var.workspace_id || c.env.AGENT_WORKSPACE_ID
  if (agentWorkspaceId) {
    if (workspaceId !== agentWorkspaceId) return c.json({ error: 'Forbidden' }, 403)
    if (c.req.header('X-API-Key')) return null
  }

  const userId = c.var.userId
  const supabase = createSupabaseClient(c.env)
  const { data, error } = await supabase
    .from('workspace_memberships')
    .select('role, feature_access')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .single()

  if (error || !data) return c.json({ error: 'Forbidden' }, 403)

  const membership = data as { role: string; feature_access?: FeatureAccess | null }
  if (!hasFeatureAccess(membership.role, membership.feature_access, feature, minimum)) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  return null
}

export function validFeatureAccess(value: unknown): value is FeatureAccess {
  if (value == null) return true
  if (typeof value !== 'object' || Array.isArray(value)) return false
  return Object.entries(value as Record<string, unknown>).every(([feature, level]) =>
    VALID_FEATURES.includes(feature as AppFeature) &&
    ['none', 'read', 'write', 'admin'].includes(String(level))
  )
}
