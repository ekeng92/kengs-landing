# Database Migrations

Migration files use Flyway-compatible naming: `V{number}__{description}.sql`.

## Conventions

- One migration file per table for the baseline schema
- Migrations are append-only: never modify a committed migration file
- PostgreSQL 14+ required (`gen_random_uuid()` built-in, `JSONB` support)
- All tables use UUID primary keys with `gen_random_uuid()` as default
- All timestamps use `TIMESTAMPTZ` to preserve timezone awareness

## Applying Migrations

Migrations are applied automatically as part of `npm run deploy`. The runner
(`scripts/migrate.mjs`) connects to Supabase via `DATABASE_URL`, tracks applied
versions in a `_migrations` table, and applies pending files in order within
transactions.

```bash
npm run migrate           # apply pending migrations
npm run migrate:status    # show applied vs pending
npm run migrate:dry-run   # preview what would run
npm run deploy            # typecheck → test → migrate → wrangler deploy
```

Requires `DATABASE_URL` in `.dev.vars` or environment. Get the pooler connection
string from Supabase Dashboard → Settings → Database → Connection string (Transaction mode).

## Deploy Pipeline

```
npm run deploy
  └─ predeploy
      ├─ typecheck  (tsc --noEmit)
      ├─ test       (vitest run)
      └─ migrate    (apply pending SQL)
  └─ wrangler deploy
```

## Ordering

| File | Table(s) |
|------|----------|
| V001 | workspaces |
| V002 | workspace_memberships |
| V003 | properties |
| V004 | bookings |
| V005 | expenses |
| V006 | mileage_trips |
| V007 | budgets |
| V008 | import_jobs |
| V009 | import_rows |
| V010 | documents |
| V011 | audit_events |
| V012 | indexes |
