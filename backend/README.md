# Backend — Keng's Landing API

Hono application deployed as a Cloudflare Worker. Uses Supabase for auth, Postgres, and storage (per ADR-002).

## Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Cloudflare Workers |
| Router | Hono v4 |
| Database | Supabase Postgres |
| Auth | Supabase Auth (JWT validation) |
| Storage | Supabase Storage |

## Local Development

1. Copy `.dev.vars.example` to `.dev.vars` and fill in your Supabase project URL and service role key.
2. Install dependencies: `npm install`
3. Run the dev server: `npm run dev`

## Applying Migrations

Migrations live in `db/migrations/`. They are plain SQL compatible with Flyway-style runners or `psql`.

**Via Supabase CLI:**
```
supabase db push
```

**Via psql directly:**
```
psql $DATABASE_URL -f db/migrations/V001__create_workspaces.sql
# ... apply in order through V012
```

The migration runner is TBD — both paths produce the same schema.

## Project Structure

```
src/
  index.ts          — app entry point, route mounting, CORS
  lib/
    supabase.ts     — Supabase client factory
    auth.ts         — JWT validation middleware
  routes/
    workspaces.ts   — workspace CRUD
    properties.ts   — property CRUD
    expenses.ts     — expense list/review/commit (T5 extends)
    bookings.ts     — booking list/commit (T6 extends)
    imports.ts      — import job creation and row review (T5/T6 extend)
  types/
    env.ts          — Cloudflare Worker bindings interface
    schema.ts       — TypeScript types mirroring the locked DB schema
db/
  migrations/       — versioned SQL migration files (V001–V012)
```

## Deployment

```
npm run deploy
```

Requires `wrangler` authenticated and `SUPABASE_SERVICE_ROLE_KEY` set as a Worker secret.
