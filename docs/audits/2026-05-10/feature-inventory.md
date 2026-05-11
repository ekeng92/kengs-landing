# Kengs Landing — Feature Inventory

> Generated: 2026-05-10 | Deep Repo Audit Phase 1

## Summary

- **Total features**: 22 (13 backend, 9 frontend-only)
- **Total route files**: 13 (12 with tests, 1 without)
- **Total test assertions**: ~335
- **Total test files**: 16
- **Migrations**: 30 (V001–V030)
- **Frontend pages**: 16 HTML files across 11 sections

---

## Backend Features

### B01: Auth & Middleware
- **Files**: `lib/auth.ts`, `lib/permissions.ts`, `lib/email.ts`, `lib/supabase.ts`
- **Tests**: `lib/auth.test.ts` (96 lines)
- **Purpose**: JWT validation, API key auth, role-based permissions, Supabase client
- **Doc status**: No dedicated docs

### B02: Workspaces
- **Files**: `routes/workspaces.ts` (315 lines)
- **Tests**: `routes/workspaces.test.ts` (275 lines)
- **Purpose**: Workspace CRUD, membership management, tenant isolation root
- **Doc status**: Referenced in copilot-instructions

### B03: Properties
- **Files**: `routes/properties.ts` (107 lines)
- **Tests**: `routes/properties.test.ts` (109 lines)
- **Purpose**: Property CRUD for STR units
- **Doc status**: Referenced in copilot-instructions

### B04: Bookings
- **Files**: `routes/bookings.ts` (299 lines)
- **Tests**: `routes/bookings.test.ts` (210 lines)
- **Purpose**: Booking CRUD, guest management, reservation tracking
- **Doc status**: Referenced in copilot-instructions

### B05: Expenses
- **Files**: `routes/expenses.ts` (161 lines)
- **Tests**: `routes/expenses.test.ts` (160 lines)
- **Purpose**: Expense CRUD, categorization, property assignment
- **Doc status**: Referenced in copilot-instructions

### B06: Imports
- **Files**: `routes/imports.ts` (936 lines)
- **Tests**: `routes/imports.test.ts` (248 lines)
- **Purpose**: CSV import pipeline (upload, parse, review, commit), multi-entity support
- **Doc status**: Largest route file, core product feature

### B07: Universal CSV Parser
- **Files**: `lib/universal-csv-parser.ts` (831 lines)
- **Tests**: `lib/universal-csv-parser.test.ts` (952 lines)
- **Purpose**: Template-driven CSV parsing, auto-detection, header fingerprinting
- **Doc status**: New feature, no standalone docs

### B08: CSV Templates
- **Files**: `routes/csv-templates.ts` (142 lines)
- **Tests**: `routes/csv-templates.test.ts` (327 lines)
- **Purpose**: CRUD for CSV format templates, built-in templates
- **Doc status**: No standalone docs

### B09: Dashboard
- **Files**: `routes/dashboard.ts` (166 lines)
- **Tests**: `routes/dashboard.test.ts` (165 lines)
- **Purpose**: Aggregated KPIs, revenue/expense summaries, property stats
- **Doc status**: No standalone docs

### B10: Tasks
- **Files**: `routes/tasks.ts` (377 lines)
- **Tests**: `routes/tasks.test.ts` (386 lines)
- **Purpose**: Task board CRUD, status workflow, agent assignment, session tracking
- **Doc status**: Documented in task-board-operating-system.md

### B11: Mileage
- **Files**: `routes/mileage.ts` (224 lines)
- **Tests**: `routes/mileage.test.ts` (193 lines)
- **Purpose**: Mileage trip logging for tax deduction tracking
- **Doc status**: No standalone docs

### B12: Cleaning System
- **Files**: `routes/cleaning.ts` (483 lines), `routes/cleaning-lists.ts` (587 lines)
- **Tests**: `routes/cleaning.test.ts` (465 lines), `routes/cleaning-lists.test.ts` (451 lines)
- **Purpose**: Cleaning link generation, public cleaner portal, checklists, session tracking, task management
- **Doc status**: No standalone docs

### B13: Invites & User Management
- **Files**: `routes/invites.ts` (694 lines)
- **Tests**: `routes/invites.test.ts` (925 lines)
- **Purpose**: User invitation flow, role assignment, invite accept/revoke
- **Doc status**: No standalone docs

### B14: Property Tasks
- **Files**: `routes/property-tasks.ts` (196 lines)
- **Tests**: `routes/property-tasks.test.ts` (423 lines)
- **Purpose**: Per-property task management, cleaner-facing task endpoints, auto-expire
- **Doc status**: No standalone docs

### B15: iCal Sync
- **Files**: `routes/ical-sync.ts` (223 lines)
- **Tests**: ❌ NONE
- **Purpose**: iCal feed sync for booking calendars (Airbnb, VRBO, etc.)
- **Doc status**: No standalone docs

### B16: Validation Schemas
- **Files**: `lib/validation.ts` (379 lines)
- **Tests**: None (tested indirectly via route tests)
- **Purpose**: Centralized Zod schemas for all entities
- **Doc status**: No standalone docs

---

## Frontend Features

### F01: Login Page
- **Files**: `login.html` (257 lines)
- **Purpose**: Supabase auth, email/password login
- **Doc status**: None

### F02: Register Page
- **Files**: `register/index.html` (581 lines)
- **Purpose**: Invite-based registration flow
- **Doc status**: None

### F03: Hub (Home)
- **Files**: `index.html` (238 lines)
- **Purpose**: Navigation hub linking to all sections
- **Doc status**: None

### F04: Dashboard
- **Files**: `dashboard/index.html` (601 lines)
- **Purpose**: KPI cards, revenue/expense charts, property summaries
- **Doc status**: None

### F05: Tasks Kanban
- **Files**: `tasks/index.html` (840 lines)
- **Purpose**: Drag-and-drop kanban board, task CRUD, filters
- **Doc status**: None

### F06: Expense Review
- **Files**: `expense-review/index.html` (442 lines), `expense-review/js/expense-review.js`
- **Purpose**: CSV import review, categorization, approval workflow
- **Doc status**: None

### F07: Booking Review
- **Files**: `booking-review/index.html` (314 lines), `booking-review/js/booking-review.js`
- **Purpose**: Booking CSV import review
- **Doc status**: None

### F08: Operations Hub
- **Files**: `operations/index.html` (135 lines) + 4 sub-pages (cleaning reference, cleaning sheet, maintenance log, supplies inventory)
- **Purpose**: Operational tools and reference documents
- **Doc status**: None

### F09: Cleaning Management
- **Files**: `cleaning/index.html` (798 lines)
- **Purpose**: Admin cleaning link management, session history, checklist config
- **Doc status**: None

### F10: Cleaner Portal
- **Files**: `clean/index.html` (986 lines)
- **Purpose**: Public-facing cleaning checklist for cleaners (token-based access)
- **Doc status**: None

### F11: Users & Invitations
- **Files**: `users/index.html` (737 lines)
- **Purpose**: Member management, invitation CRUD, role assignment
- **Doc status**: None

### F12: Settings
- **Files**: `settings/index.html` (271 lines), `settings/csv-templates.html` (623 lines)
- **Purpose**: Workspace settings, CSV template library management
- **Doc status**: None

### F13: CSV Mapping Wizard
- **Files**: `js/csv-mapping-wizard.js` (854 lines)
- **Purpose**: Shared wizard for CSV column mapping during import
- **Doc status**: None

### F14: App Shell
- **Files**: `js/app-shell.js` (184 lines), `css/app-shell.css`, `js/auth.js` (150 lines)
- **Purpose**: Shared header/nav/footer, auth state management, logout
- **Doc status**: None

---

## Infrastructure

### I01: Migrations
- **Files**: 30 SQL files (V001–V030) in `backend/db/migrations/`
- **Purpose**: Schema evolution, Flyway-compatible
- **Doc status**: README in migrations folder

### I02: Scripts
- **Files**: `migrate.mjs`, `check-migrations.mjs`, `check-frontend-links.mjs`, `bootstrap-dev.ps1`
- **Purpose**: Migration runner, CI checks, dev environment bootstrap
- **Doc status**: None

### I03: CI/CD
- **Files**: `.github/workflows/` (assumed, per copilot-instructions)
- **Purpose**: Typecheck + vitest + migration checks on PR/push
- **Doc status**: Referenced in copilot-instructions

---

## Key Gaps Identified

1. ❌ `ical-sync.ts` has ZERO tests (223 lines of untested code)
2. ⚠️ No standalone documentation for any feature
3. ⚠️ Frontend has no automated tests (no Cypress specs active)
4. ⚠️ `imports.ts` is 936 lines, likely needs decomposition review
5. ⚠️ Several `.bak` files in frontend (cleanup candidate)
