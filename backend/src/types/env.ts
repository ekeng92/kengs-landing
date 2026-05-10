export interface Env {
  SUPABASE_URL: string
  SUPABASE_SERVICE_ROLE_KEY: string
  DEV_BYPASS_AUTH?: string
  DEV_USER_ID?: string
  DEV_WORKSPACE_ID?: string
  AGENT_API_KEY?: string
  AGENT_USER_ID?: string
  AGENT_WORKSPACE_ID?: string
  DB_HOST?: string
  DB_PASSWORD?: string
  /** Test-only injection point for route contract tests. */
  TEST_SUPABASE?: unknown
  RESEND_API_KEY?: string
  EMAIL_FROM?: string
  FRONTEND_BASE_URL?: string
}
