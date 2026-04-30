# Keng's Landing Testing Strategy

Goal: let AEON and other coding agents develop confidently without breaking Keng's Landing operations, finance records, or deployability.

## Current baseline

- Backend: Hono + Cloudflare Workers + Supabase.
- Frontend: static HTML/JS pages under `frontend/`.
- Database: SQL migrations under `backend/db/migrations/`.
- First test foothold added: Vitest for backend finance parsing.

## Non-negotiable gates

### Gate 1 — Backend unit tests

Command:

```bash
cd backend
npm test
```

Purpose: protect pure finance transformations first, especially CSV parsing, categorization, dedupe keys, and malformed row handling.

Current first coverage:

- `expense-import/parse.test.ts`
  - date parsing
  - amount parsing
  - dedupe-key stability
  - deterministic CSV row parsing
  - malformed/refund rows flag safely without throwing

### Gate 2 — Backend typecheck

Command:

```bash
cd backend
npm run typecheck
```

Current status: known failing baseline. Failures predate this strategy and are concentrated in strict parser nullability plus missing DOM/Node types from Supabase declarations.

Next work: make this green before treating it as a hard CI gate.

### Gate 3 — Route contract tests

Add after Gate 1 grows:

- export the Hono `app` separately from the Worker default export
- test `app.fetch()` directly
- mock Supabase boundaries

Initial route coverage:

- `/health` returns 200 without auth
- protected routes reject unauthenticated requests
- task creation/list/move handles the board statuses
- import job row classify/reject/promote contracts match frontend calls

### Gate 4 — Frontend smoke tests

Use Playwright once route contracts are stable.

Initial smoke coverage:

- login page renders
- protected pages redirect unauthenticated users
- dashboard/tasks/booking-review/expense-review load without console errors
- task board renders all lanes, including Waiting / Blocked
- mocked API responses prove UI wiring without touching production data

### Gate 5 — Migration safety

Short-term:

- verify migration filename ordering
- fail on duplicate version numbers
- review generated SQL before applying

Later:

- run Supabase/Postgres locally in CI
- apply migrations from empty DB
- seed minimal workspace/property records
- run route tests against the migrated schema

## CI target

Once typecheck is green, add GitHub Actions:

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

jobs:
  backend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: backend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
          cache-dependency-path: backend/package-lock.json
      - run: npm ci
      - run: npm test
      - run: npm run typecheck
```

Until typecheck is repaired, CI can run `npm test` first, but typecheck should not remain optional long-term.

## Agent-safe development protocol

Before changing production-facing logic:

1. Identify which layer the change touches: parser, route, UI, migration, or deployment.
2. Add or update the smallest meaningful test for that layer.
3. Run the relevant gate locally.
4. Commit in small slices.
5. Never deploy from an untested dirty tree.

## Priority backlog

1. Expand parser fixtures for Chase, Robinhood, Airbnb, and generic CSV.
2. Fix backend typecheck to green.
3. Add GitHub Actions for `npm test` + `npm run typecheck`.
4. Refactor `src/index.ts` to export `app` for route contract tests.
5. Add route tests for task board and import workflows.
6. Add Playwright smoke tests for the frontend shell.
7. Add migration ordering/schema checks.
