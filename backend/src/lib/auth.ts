import { createMiddleware } from 'hono/factory'
import { createClient } from '@supabase/supabase-js'
import type { Env } from '../types/env'

export type AuthVariables = {
  userId: string
  workspace_id?: string
}

/**
 * Validates the Supabase JWT from the Authorization header.
 * Sets c.var.userId for downstream handlers.
 * Returns 401 for missing, malformed, or expired tokens.
 */
export const requireAuth = createMiddleware<{
  Bindings: Env
  Variables: AuthVariables
}>(async (c, next) => {
  // Dev-mode bypass: skip JWT validation for local development
  if (c.env.DEV_BYPASS_AUTH === 'true') {
    c.set('userId', c.env.DEV_USER_ID || '00000000-0000-0000-0000-000000000001')
    c.set('workspace_id', c.env.DEV_WORKSPACE_ID || '')
    await next()
    return
  }

  const authorization = c.req.header('Authorization')
  if (!authorization?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const token = authorization.slice(7)
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })

  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  c.set('userId', data.user.id)
  await next()
})
