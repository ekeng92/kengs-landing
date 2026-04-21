import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Env } from '../types/env'

/**
 * Creates a Supabase admin client using the service role key.
 * This client bypasses RLS and must only be used in server-side handlers
 * after the request has been authenticated via requireAuth middleware.
 */
export function createSupabaseClient(env: Env): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })
}
