# Keng's Landing — STR Finance Task List

> Living task list. Newest additions at top within each section.

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
- [x] **Add environment status report** — added `scripts/environment-status.ps1` plus a VS Code task to summarize repo state, backend readiness, GitHub auth, and task-board freshness; enhanced in May 2026 session to add Node.js/Wrangler versions, frontend surface checks, and better-labeled output
- [x] **Document openclaw gateway and Telegram bot state** — see `docs/dev-environment.md`; gateway is installed but not running as a service; Telegram bot is active through openclaw main agent; no Keng's Landing-specific bot code exists yet
- [ ] **Install Python 3 + openpyxl** — required to run finance import scripts locally. Not in PATH (Windows Store stubs only). Install from python.org, add to PATH, then `pip install openpyxl`. Unblocks VRBO import, Amazon import, and future finance scripts
- [ ] **Decide board strategy: markdown only vs GitHub Projects mirror** — current repo has no open Projects board; decide whether to keep the markdown file as the canonical board or sync to GitHub Projects after auth is configured
- [ ] **Create local backend `.dev.vars`** — copy `backend/.dev.vars.example` to `.dev.vars` and fill in Supabase URL/service-role credentials so `wrangler dev` can run on this PC
- [ ] **Authenticate this PC for GitHub** — complete `gh auth login` so AEON Watch can pull private repos, create issues/PRs, and sync task board changes with approval.
- [ ] **Give AEON Watch dashboard API write access** — provide a safe auth path/service token or agent account so tasks can be created through the Keng's Landing `/tasks` API instead of only local markdown.
- [ ] **Define Telegram bot scope for Keng's Landing** — the bot is live via openclaw but has no Keng's Landing tasks wired to it. Define what it should handle: booking alerts, expense prompts, task nudges, morning briefings. Then decide: openclaw agent tool, or dedicated Hono webhook route in the backend
- [ ] **Evaluate Ubuntu path for the mini PC** — decide between staying Windows-native, adding WSL2 Ubuntu, or reinstalling Ubuntu Server for simpler automation and long-running services.
- [ ] **Set up local model/tooling baseline** — install/test a practical local model runtime if hardware allows, plus CLI tools AEON Watch needs for repo audits, docs indexing, and background jobs.
- [ ] **Create an AEON Watch ops dashboard** — local status page or markdown report for gateway health, tasks audit, cron jobs, repo sync status, disk, and recent work log.
- [ ] **Define standing autonomy levels** — document which actions AEON Watch can do silently, which need approval, and which are never allowed without Eric.

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
