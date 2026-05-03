# Keng's Landing Management Hub Gap Brief

Status: draft  
Owner: AEON Watch  
Related task: AEON-033  
Created: 2026-05-02

## Purpose

Make the deployed Keng's Landing site the business operating system: the browser is where Eric can see reality, make operational decisions, and hand off work to agents without dropping back into VS Code, local scripts, or scattered memory.

The hub does not need to become a perfect all-in-one product before it is useful. It needs to close the highest-friction operating loops first, using the existing Cloudflare Worker API as the source of truth and Telegram/OpenClaw as the fast-entry layer.

## Current Deployed Surface

Frontend pages already present under `frontend/`:

- `/` — navigation hub
- `/dashboard/` — finance metrics and KPIs
- `/expense-review/` — expense review workflow
- `/booking-review/` — booking review workflow
- `/tasks/` — kanban task board
- `/operations/` — operations docs/tools landing page
- `/settings/` — settings page
- `/users/` — user management page
- `/login.html` — Supabase auth entry

Backend APIs already present under `backend/src/routes/`:

- `/tasks` — task board CRUD and status movement
- `/expenses` — expense review / commit workflow
- `/bookings` — booking records / commit workflow
- `/imports` — import job workflow
- `/dashboard` — metrics and exports
- `/properties` — property records
- `/workspaces` — workspace records
- `/mileage` — mileage records
- `/ical-sync` — calendar sync trigger/status

This is enough foundation for the management hub. The remaining work is mostly integration, workflow completeness, and operational affordances — not a ground-up rewrite.

## Operating-System Definition

The deployed site becomes the management hub when these loops are true:

1. **Task loop:** Eric can capture, prioritize, block, and review business work from the site or Telegram; the API task board remains canonical.
2. **Finance loop:** Imported expenses/bookings can be reviewed, categorized, committed, and exported without spreadsheet-first cleanup.
3. **Tax-readiness loop:** blockers, missing documents, pre-service buckets, depreciation inputs, and CPA exports are visible as current state, not hidden in notes.
4. **Guest/ops loop:** guest guide gaps, turnover checklists, vendor contacts, supplies, and maintenance actions are represented as durable tasks or operations pages.
5. **Agent loop:** OpenClaw/Telegram mutations flow through the same API and show up immediately on the dashboard/task board.

## Gap Map

### 1. Hub navigation and status summary

Current state:

- There is a deployed root hub and dedicated pages, but no single at-a-glance operating summary.

Needed:

- Add compact status cards on the root hub:
  - critical/high tasks needing action
  - waiting tasks blocked on Eric/vendor/CPA
  - import/review counts
  - next booking/check-in if available
  - tax readiness blockers
- Link each card directly to the page/action that resolves it.

Acceptance criteria:

- Eric can open `/` and know the one next business action within 30 seconds.
- No status card depends on local files or VS Code state.

### 2. Task board as canonical work queue

Current state:

- `/tasks/` and `/tasks` API exist.
- Telegram scope draft recommends task add/list/update through OpenClaw.

Needed:

- Keep all active KL work in the API board, not markdown.
- Add digest/query patterns for:
  - critical unblocked tasks
  - waiting tasks with stale follow-up
  - in-progress tasks untouched for 2+ days
  - tasks assigned to `aeon-watch` / `aeon-dev`
- Add recurring/template tasks for turnover, monthly import review, tax document collection, and guest guide maintenance.

Acceptance criteria:

- `business/finances/TASKS.md` can stay read-only historical reference.
- Agents can inspect and update task metadata without touching repo files.

### 3. Telegram/OpenClaw command layer

Current state:

- OpenClaw Telegram is live.
- `docs/specs/telegram-bot-scope.md` defines conservative phase 1 commands.
- Deployed API key auth works for Watch task operations.

Needed:

- Implement thin command helpers for:
  - `kl brief`
  - task add/list/update by explicit ref
  - safe blocked-reason / clarification-note updates
- Use the API as the only mutation layer.
- Preserve audit text in notes for financial/tax-affecting updates.

Acceptance criteria:

- Eric can create a task from Telegram and receive an `AEON-NNN` ref.
- Eric can ask for high/critical KL tasks and get a compact digest.
- Ambiguous commands ask one clarification instead of guessing.

### 4. Finance review completion path

Current state:

- Expense, booking, imports, dashboard, and export routes exist.
- Review pages exist for expenses and bookings.

Needed:

- Confirm browser workflow can complete a real monthly import/review cycle.
- Add visible counts for staged/review/committed records.
- Add clear export entry points for CPA/tax handoff.
- Keep uncertain records in Review with notes rather than over-committing.

Acceptance criteria:

- A monthly finance review can be done from browser + exported from dashboard.
- The dashboard shows enough review debt that Eric knows what remains unfinished.

### 5. Tax readiness cockpit

Current state:

- Tax blockers exist as tasks: land/building split, golf cart bill of sale, pre-service categories, ATM/context issues.
- Tax classification guidance exists in architecture/spec docs.

Needed:

- Create a tax readiness section/card that groups:
  - depreciation inputs
  - missing receipts/docs
  - pre-service classification progress
  - unresolved review expenses
  - CPA export status
- Link each blocker to its canonical task or review queue.

Acceptance criteria:

- Eric can answer "what still blocks tax readiness?" from the site without asking an agent to reconstruct context.

### 6. Guest and property operations

Current state:

- Operations pages exist for cleaning reference, cleaning sheet, maintenance log, supplies inventory.
- Guest book docs/content exist under `docs/`.

Needed:

- Convert guest-book gaps into API tasks.
- Make operations pages navigable from root hub with clear ownership and last-updated expectations.
- Add vendor/contact sheet and turnover checklist templates when ready.

Acceptance criteria:

- Operational work appears as tasks, not just static docs.
- Root hub exposes the operations surface clearly enough for non-dev use.

## Recommended Execution Order

1. **Root hub status summary** — highest leverage; makes the site feel like the OS instead of a link list.
2. **Telegram phase 1 task commands** — closes fast capture and agent mutation loop.
3. **Task digest/stale query helpers** — supports morning briefings and board grooming.
4. **Tax readiness cockpit** — reduces tax-season reconstruction risk.
5. **Finance review counters and export affordances** — makes browser-first review trustworthy.
6. **Operations template/task seeding** — turns guest/property ops into recurring durable workflows.

## Agent Boundary

AEON Watch should continue to handle:

- board grooming
- status briefs
- documentation/specs
- health/repo monitoring
- safe task metadata updates

AEON Dev should handle:

- frontend implementation
- backend route/helper additions
- tests and CI gates
- deployment changes

## Notes For AEON Dev

If implementation begins, prefer small slices with clear gates:

- frontend root-hub status card with mocked/real API smoke check
- task query helper endpoint or client-side filtered query, covered by route tests if backend changes
- Telegram command layer behind conservative parser and dry-run behavior for financial mutations
- tax readiness card assembled from existing tasks/review data before introducing new tables

Do not make Telegram a second source of truth. Do not let markdown task files regain canonical status. The deployed API and dashboard should remain the center.
