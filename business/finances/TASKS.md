# Keng's Landing — STR Finance Task List

> ⚠️ **DEPRECATED AS PRIMARY TASK SOURCE (May 2, 2026)**
> The canonical task board is the deployed Kanban at [kengs-landing-frontend.pages.dev/tasks/](https://kengs-landing-frontend.pages.dev/tasks/).
> All new tasks go there via the API or dashboard UI. This file is a **snapshot** for offline reference only.
> Do NOT add new tasks here. Do NOT treat this as the source of truth.

> Living task list. Newest additions at top within each section.

## Product Vision — Dashboard as Management Hub

> **Direction set May 2, 2026**: The deployed website is the operating system for the business. Not VS Code. Not markdown. The browser is where everything lives — tasks, finances, guest docs, operations. Agents interact through Telegram/OpenClaw, mutations flow through the API, and the dashboard reflects reality.

- [ ] **Make deployed site the management hub** — all tasks, finances, guest docs, operations managed from the browser. TASKS.md becomes a backup/snapshot, not the primary
- [ ] **Surface operations docs on website** — guest book, WiFi QR codes, cleaning checklists, house rules viewable and editable through the deployed site
- [ ] **Wire Telegram → API for task/operations commands** — text on Telegram to create tasks, update guest book, update finances, finish tasks. OpenClaw agent calls the Kengs Landing API

## Priority — Tax Prep / Depreciation

- [x] **Placed-in-service date: March 1, 2026** — based on first VRBO booking (Mar 2026). Tax Period column added to tracker: 94 Pre-Service, 41 Operational
- [ ] **Pull Freestone County tax assessment** — need land vs building value split for 27.5-year depreciation calculation. Check Freestone County CAD website or 2025 property tax statement
- [ ] **Get golf cart bill of sale** — need documentation for Section 179 election ($2,400). Check texts/FB Marketplace messages
- [ ] **Categorize pre-service expenses into tax buckets** — 94 expenses tagged Pre-Service ($18K+). Need to split into: (1) capital improvements (add to basis, depreciate 27.5yr), (2) startup costs (up to $5K deducted year 1, remainder amortized 15yr). See Tax Notes below
- [ ] **Build Depreciation Schedule sheet** — add to Excel tracker once assessment data and placed-in-service date are confirmed

## Review Items (31 pending)

- [ ] **Home Depot / Lowe's charges** (~19 from Robinhood CC + 2 from Chase CC) — keep in Review, export HD/Lowe's transaction history later to categorize
- [ ] **FB Marketplace purchases** (~$350 total, 5 items) — determine which are STR furniture/supplies vs personal
- [ ] **ATM withdrawal $500** — check texts for Jeff Yancey payment context
- [ ] **Golf carts $2,400** — pending bill of sale (see above)
- [ ] **Unaccounted cash $3,400** — do NOT report until documented. Try to reconstruct from texts/receipts

## Data Imports

- [ ] **Amazon orders** — Option C deferred. Export Amazon order history CSV, match ~$6,188 across 181 transactions to STR vs personal
- [x] **VRBO import script built** — `business/finances/import-vrbo-csv.py` created 2026-05-01. Flexible column aliasing handles known VRBO export format variations. Use `--detect` flag with a real CSV to confirm column mapping before first live run. Still need: a real VRBO CSV export to calibrate against
- [ ] **Run VRBO import** — export a reservation CSV from VRBO dashboard, run `python import-vrbo-csv.py --detect <file>` first, then do the live import. Python 3 + openpyxl must be installed (see dev-environment.md)

## Dashboard / Reporting

- [ ] **Depreciation Schedule sheet** — blocked on tax assessment data
- [ ] **Annual CC statement archive** — at year-end, download full Robinhood CC + Chase transaction histories to `finances/2026/`

## Task Board / Executive Function

- [x] **Add Waiting / Blocked lane + planning fields** — board now supports follow-up date, energy, context, and blocked reason metadata
- [ ] **Seed Launch / Tax Readiness cards** — create the initial task cards from `docs/task-board-operating-system.md`
- [ ] **Weekly board sweep automation** — surface stale In Progress, due Waiting tasks, and top 3 next actions
## Backend Engineering

- [x] **Mileage CRUD routes** — `GET/POST/PATCH/DELETE /mileage` endpoints built with 8 passing tests. Auto-calculates deduction from miles * IRS rate. Property-workspace validation. Registered in app router
- [x] **Fix dashboard workspace_id bug** — all 3 dashboard endpoints (`/metrics`, `/export/expenses`, `/export/bookings`) used `c.get('workspace_id')` which is never set in production (auth middleware only sets `userId`). Changed to `c.req.query('workspace_id')` to match every other route. Updated error messages to list workspace_id as required
- [x] **Seed task board from TASKS.md** — 32 tasks created in production Supabase (AEON-004 through AEON-035) via `scripts/seed-task-board.mjs --direct`. Deployed Kanban at kengs-landing-frontend.pages.dev/tasks/ now shows all tasks. Script is idempotent (dedupes by title)
- [ ] **Apply V016 migration to production Supabase** — `db/migrations/V016__enhance_tasks_for_ops_board.sql` adds `due_date`, `effort`, `context`, `blocked_reason` columns and expands status CHECK to include `waiting`. Must be run via Supabase Dashboard SQL Editor. Currently tasks route 500s on create because it sends `blocked_reason` which doesn't exist. Either apply migration or make the route conditionally omit V016 fields
- [ ] **Add pagination to list endpoints** — bookings, expenses, mileage, tasks all return all rows. Add `limit`/`offset` query params following a shared pattern. Required before dataset grows
- [ ] **Add void endpoints for bookings and expenses** — committed records have a status field but no transition to `voided`. Add `PATCH /:id/void` for both entities with audit trail
- [ ] **Wire import job status auto-update** — parse-bookings and parse-expenses routes don't update job.status to `parsed`/`flagged` after row creation. Job lifecycle stalls at `uploaded`
- [ ] **Add Supabase Storage binding** — import routes reference signed URLs and `storage_path` but no Storage binding exists in wrangler.toml. Needed for file upload support

## AEON Watch Suggestions

- [ ] **Create an owner-ready monthly close checklist** — turn the current finance workflow into a repeatable month-end sequence: import statements, review uncategorized expenses, reconcile bookings, archive receipts, export tax snapshot.
- [ ] **Add a tax-prep packet export** — one-click/year-end bundle for CPA: Schedule E worksheet, depreciation schedule, mileage log, categorized expenses, booking revenue, and source audit trail.
- [ ] **Build review queue guardrails** — flag transactions over a threshold, missing receipts, ambiguous vendor categories, duplicate-looking expenses, and pre-service vs operational edge cases before they hit final reports.
- [ ] **Add property-level profitability view** — compare 360 / Ironwood / Marlow by revenue, expenses, mileage allocation, supplies, capex, and owner cash recovery.
- [ ] **Create an operations evidence vault** — link receipts, invoices, deeds, insurance, lease docs, maintenance records, and improvement photos to the relevant property/tax bucket.
- [ ] **Add booking platform reconciliation** — compare Airbnb/VRBO payouts, fees, taxes, cleaning fees, refunds, and deposits against bank deposits so revenue ties out cleanly.

## AEON Watch / Local PC Setup

- [x] **Create shared VS Code workspace for ChatKey + Keng's Landing** — workspace file created at `C:/Users/Keng/Projects/KengRepos.code-workspace` so both repos open together
- [x] **Open the finance task board on the web** — GitHub view confirmed at `https://github.com/ekeng92/kengs-landing/blob/main/business/finances/TASKS.md`
- [x] **Check in VS Code task runner for local workflows** — added `.vscode/tasks.json` with backend install/dev/typecheck plus dashboard/task-board launch tasks
- [x] **Document local environment workflow** — added `docs/dev-environment.md` with context-loading order, startup paths, and current gaps
- [x] **Add one-command backend bootstrap** — added `backend/scripts/bootstrap-dev.ps1` plus a VS Code task to verify `.dev.vars`, install backend deps, and report readiness before `wrangler dev`
- [x] **Add environment status report** — added `scripts/environment-status.ps1` (Windows) and `scripts/environment-status.sh` (macOS/Linux). VS Code task available. Reports repo state, backend readiness, TypeScript health, Python status, GitHub auth, and task-board freshness
- [x] **Document openclaw gateway and Telegram bot state** — see `docs/dev-environment.md`; gateway is installed but not running as a service; Telegram bot is active through openclaw main agent; no Keng's Landing-specific bot code exists yet
- [x] **Fix openclaw memory + security + update (Mac)** — Fixed memory-lancedb "Unknown embedding provider: local" by enabling dreaming config, installing node-llama-cpp in plugin-runtime-deps, and setting dimensions=768. Fixed world-readable config (chmod 600). Cleared ineffective denyCommands. Updated 2026.4.27→2026.4.29. Security audit: 0 critical (was 1)
- [ ] **Install Python 3 + openpyxl** — required to run finance import scripts locally. Not in PATH (Windows Store stubs only). Install from python.org, add to PATH, then `pip install openpyxl`. Unblocks VRBO import, Amazon import, and future finance scripts
- [ ] **Decide board strategy: markdown only vs GitHub Projects mirror** — current repo has no open Projects board; decide whether to keep the markdown file as the canonical board or sync to GitHub Projects after auth is configured
- [ ] **Create local backend `.dev.vars`** — copy `backend/.dev.vars.example` to `.dev.vars` and fill in Supabase URL/service-role credentials so `wrangler dev` can run on this PC
- [x] **Authenticate Mac for GitHub** — `gh auth login` completed with ekeng92 PAT. AEON Watch can now use `gh` CLI for issues, PRs, and repo operations.
- [ ] **Give AEON Watch dashboard API write access** — provide a safe auth path/service token or agent account so tasks can be created through the Keng's Landing `/tasks` API instead of only local markdown.
- [ ] **Define Telegram bot scope for Keng's Landing** — the bot is live via openclaw but has no Keng's Landing tasks wired to it. Define what it should handle: booking alerts, expense prompts, task nudges, morning briefings. Then decide: openclaw agent tool, or dedicated Hono webhook route in the backend
- [ ] **Evaluate Ubuntu path for the mini PC** — decide between staying Windows-native, adding WSL2 Ubuntu, or reinstalling Ubuntu Server for simpler automation and long-running services.
- [ ] **Set up local model/tooling baseline** — install/test a practical local model runtime if hardware allows, plus CLI tools AEON Watch needs for repo audits, docs indexing, and background jobs.
- [ ] **Create an AEON Watch ops dashboard** — local status page or markdown report for gateway health, tasks audit, cron jobs, repo sync status, disk, and recent work log.
- [ ] **Define standing autonomy levels** — document which actions AEON Watch can do silently, which need approval, and which are never allowed without Eric.
- [ ] **Validate openclaw memory recall end-to-end** — memory-lancedb initializes and stores to `~/.openclaw/memory/lancedb` but lazy-init means the DB hasn't been created yet. Send a test message via Telegram and confirm recall works. If dimensions mismatch, delete the lancedb dir and restart
- [ ] **Fix skills-remote bin probe timeout** — every gateway restart logs `remote bin probe timed out` for 44 required bins. The node is connected but the `system.which` probe exceeds 15s. Investigate if the node service needs to be installed (`openclaw node install`) or if it's a connectivity issue with the local device pairing
- [ ] **Implement proper tool-level security restrictions** — the cleared denyCommands used invalid command names. The original intent (block camera, SMS, contacts, calendar) needs to be reimplemented via `tools.exec` policy or by disabling specific skill plugins. Audit which skills expose sensitive operations and restrict accordingly
- [x] **Bootstrap AEON Watch with Keng's Landing context** — Created `KENGS-LANDING.md` (full API reference, auth, deployment, endpoints), `STANDING-ORDERS.md` (authority levels, task board operations, monitoring patterns). Updated `AGENTS.md`, `HEARTBEAT.md`, `TOOLS.md`, `IDENTITY.md`, memory. Watch now has full project context and clear operational authority
- [ ] **Create Supabase service account for AEON Watch** — the `/tasks` API requires a Bearer JWT. Watch needs either: (a) a dedicated Supabase user account (email+password) it can sign in with programmatically, or (b) a service-account/API-key auth path in the backend middleware. Without this, Watch can only interact with the task board via markdown + git, not the deployed API

## Completed

- [x] Airbnb CSV import (3 bookings enriched)
- [x] Robinhood CC import (66 expenses, $4,154)
- [x] Chase 3-account import (64 expenses, $20,448)
- [x] Mileage log (20 trips, 2,400 mi, $1,680 deductions)
- [x] Dashboard 6 tabs (Overview, Review, Bookings, Expenses, Mileage, Budget)
- [x] Dynamic improvements computation (replaced $10K guess)
- [x] $7.5K cash withdrawal broken into components
- [x] Category normalization (56 entries)
- [x] Financial snapshot generated
- [x] Tax Period column added (Pre-Service/Operational, PIS: 2026-03-01)
- [x] Dashboard bugs fixed (category casing, Investment Recovery, localStorage migration)
- [x] Audit trail CSV exported to finances/2026/expenses/

---

## Tax Notes — 2025 Pre-Service Expenses

360 CR was purchased in 2025 but not placed in service as a rental until ~May 2026. Tax preparer confirmed: 2025 expenses cannot be deducted on 2025 return (property was not yet a rental). All pre-service costs are deducted starting in the placed-in-service year (2026).

**Two buckets for pre-service costs:**

1. **Capital improvements** (renovations, new systems, structural work) → added to the property's cost basis → depreciated over 27.5 years starting placed-in-service date
2. **Startup costs** (non-capital: supplies, travel, market research, listing photos, initial cleaning) → IRC §195 election: deduct up to $5,000 in Year 1, amortize remainder over 180 months (15 years)

No amended 2025 return needed. Everything flows through the 2026 Schedule E.
