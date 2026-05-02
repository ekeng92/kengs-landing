---
applyTo: 'backend/src/**/*.ts,backend/test/**/*.ts'
author: 'AEON Dev'
created: '2026-05-02'
lastUpdated: '2026-05-02'
---

# Backend Conventions — Hono + Cloudflare Workers + Supabase

## Stack

- **Runtime**: Cloudflare Workers (V8 isolate, no Node.js APIs)
- **Framework**: Hono.js with typed bindings (`Bindings` = `Env`, `Variables` = `AuthVariables`)
- **Database**: Supabase Postgres via `@supabase/supabase-js` PostgREST client
- **Testing**: Vitest with `createMockSupabase()` from `test/mock-supabase.ts`
- **Auth**: Supabase JWT + X-API-Key for agents. Middleware at `src/lib/auth.ts`

## Route Patterns

- Every route file exports a `<name>Router` Hono instance
- All data routes use `requireAuth` middleware
- All list endpoints require `workspace_id` query param for tenant isolation
- Route files go in `src/routes/<entity>.ts`, tests alongside as `<entity>.test.ts`

## Database Access

- Use Supabase client abstraction (`.eq()`, `.gte()`, etc.) — never raw SQL in routes
- Service role key is used (bypasses RLS) — the backend IS the security boundary
- Schema changes via Flyway-style migrations in `db/migrations/` (V###__description.sql)
- Migrations must be idempotent (`IF NOT EXISTS`, `DROP CONSTRAINT IF EXISTS`)

## Error Handling

- Never expose raw Supabase/Postgres error messages to clients
- Map known error codes: `23505` → 409 Duplicate, `23503` → 422 Referenced entity not found
- All other DB errors → 500 with generic message. Log the real error server-side

## Input Validation

- Validate all query params and request bodies at the route boundary
- Zod schemas preferred (adoption in progress)
- Reject invalid input with 400 + structured error before touching the database

## Testing

- Use `createMockSupabase()` pattern — inject via `TEST_SUPABASE` env binding
- Test structure: describe block per endpoint, cover happy path + validation + error cases
- Always update tests when changing route behavior or adding status values
- Run `npx vitest run` before every commit

## Task Status Lifecycle

Valid statuses: `backlog`, `todo`, `in_progress`, `review`, `waiting`, `done`, `archived`

Standard flow: `backlog → todo → in_progress → review → done`

`review` = work is complete, needs SAGE acceptance. `waiting` = blocked on external dependency.

## What NOT to Do

- No `console.log` in production code (Workers stdout is not reliably captured)
- No hardcoded IDs, URLs, or secrets — use `Env` bindings
- No direct DB access from agents or scripts in production — go through the API
- No `DEV_BYPASS_AUTH` in any non-local environment
