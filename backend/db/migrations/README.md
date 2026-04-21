# Database Migrations

Migration files use Flyway-compatible naming: `V{number}__{description}.sql`.

## Conventions

- One migration file per table for the baseline schema
- Migrations are append-only: never modify a committed migration file
- PostgreSQL 14+ required (`gen_random_uuid()` built-in, `JSONB` support)
- All tables use UUID primary keys with `gen_random_uuid()` as default
- All timestamps use `TIMESTAMPTZ` to preserve timezone awareness

## Applying Migrations

Plain SQL compatible with any Flyway-compatible runner or `psql` directly. Target migration tool TBD with backend stack selection.

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
