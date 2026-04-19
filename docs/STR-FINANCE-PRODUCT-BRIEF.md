# STR Finance Website Product Brief

## Purpose

Define the long-term intention of the Keng's Landing finance website before committing further to implementation details. This document is the planning anchor for product scope, architecture direction, and phased delivery.

## Product Thesis

Short-term rental owners do not need generic bookkeeping software. They need an operational finance system built around the way STR businesses actually work: payout imports, messy expense review, property-level reporting, mileage, tax prep, pre-service versus operational classification, and an audit trail that survives tax season.

The website should evolve from a local finance tool into a product-grade web application for STR owners, starting with Keng's Landing as the proving ground.

## Vision

Build a browser-based STR finance platform that turns raw financial inputs into organized, reviewable, tax-ready business records.

The platform should:

- help a host import and normalize revenue and expense data quickly
- support property-level bookkeeping and review workflows
- preserve a strong audit trail for tax prep and compliance
- remain inexpensive to operate on free tiers during early product development
- scale from one owner with one property to multiple owners and properties without a foundational rewrite

## Core Problem

Current STR finance workflows are fragmented across spreadsheets, bank exports, Airbnb/VRBO reports, screenshots, receipts, and tax-season memory. Existing tools are either:

- too generic, forcing hosts to adapt their operations to bookkeeping software
- too manual, leaving classification and review work unfinished until tax season
- too expensive or overbuilt for small operators

## Product Goal

Give STR owners a single web system to:

1. import raw financial data
2. review and classify transactions
3. track bookings, expenses, mileage, and budgets by property
4. produce tax-ready outputs and operational insight

## Target Users

### Primary User

Independent STR owner-operator with one or a few properties who currently manages finances manually.

### Secondary Users

- host with multiple properties needing property-level reporting
- spouse, co-host, or assistant helping review expenses
- CPA or bookkeeper consuming exported reports and audit trails

## Jobs To Be Done

When I run an STR business, I want to:

- import CSV or spreadsheet data instead of typing transactions manually
- keep business and personal transactions separate
- review uncertain expenses later without losing them
- understand revenue, expenses, occupancy, and cash performance by property
- preserve tax evidence and category logic throughout the year
- export clean records for tax filing and professional review

## Product Principles

- database first, spreadsheet compatible
- generic where useful to any STR owner
- opinionated where tax or workflow intelligence creates value
- auditable by default
- property-aware from the beginning
- modular enough to evolve without a rewrite
- free-tier friendly until scale justifies paid infrastructure

## Product Strategy

The product should be developed using a **prototype-first, durability-selective** strategy.

This means:

- prototype workflow expression, layout, navigation, and visual direction quickly
- keep data semantics, metric definitions, ownership boundaries, and import lifecycle durable from the start
- validate that operators complete real finance work faster and with more confidence before broadening product scope

This is not a contradiction. It is the operating model. Speed is appropriate in the presentation layer. Discipline is required in the business layer.

## Design Stance

The first real website should be **desktop-primary, mobile-capable**.

Why:

- dense review workflows, imports, reconciliations, and tables are desktop tasks
- mobile support matters for quick status checks, receipt capture, mileage logging, and light review
- designing the entire product mobile-first too early would optimize for the wrong workflow shape

Design work should happen ahead of implementation, but it should stay workflow-first rather than polish-first.

The recommended design sequence is:

1. define workflow and information hierarchy
2. sketch low-fidelity states and decision points
3. confirm edge cases and audit implications
4. implement
5. refine visuals once the workflow proves useful

## Current State

The current implementation proves the workflow but not the final architecture.

What exists now:

- a deployable Vite frontend under `finances/dashboard/`
- a legacy spreadsheet-driven dashboard under `finances/dashboard.html`
- import scripts that normalize Airbnb and bank data
- browser local storage persistence
- spreadsheet import and export as the effective source of truth

What this means:

- the frontend direction is valid
- the data architecture is still prototype-grade
- Excel should become an import/export format, not the live backend

## Prototype Validation Goal

The prototype phase is not successful because it looks credible. It is successful if it proves that real STR finance work becomes meaningfully easier.

The prototype should answer these questions:

1. does the product reduce time-to-clean-records compared with spreadsheet-first workflows
2. do users trust the review queue and import results enough to rely on them
3. does property-level reporting remain understandable and believable after real use
4. does the workflow expose recurring value strong enough to justify backend and product hardening

## Prototype Success Signals

The prototype has earned further investment if all of the following become true during real use:

- a real monthly expense import and review cycle can be completed in the product without falling back to spreadsheet-first work for the core decision loop
- import provenance and classification history are understandable enough that the operator trusts the resulting records
- at least one operator can use the system repeatedly without needing the workflow re-explained every time
- the reporting output is good enough to support tax prep or CPA handoff with manageable cleanup rather than full reconstruction
- the product reveals repeatable workflow value that would matter to STR owners beyond Eric's specific setup

## Stop Or Reframe Signals

The current direction should be paused, narrowed, or reframed if one or more of these becomes true after real usage:

- users still prefer spreadsheet cleanup because the product adds review overhead without enough confidence gain
- the same import or classification ambiguity repeatedly requires manual rescue with no clear path to better rules
- dashboard views look useful but do not change decisions or reduce tax-prep effort
- the workflow only makes sense for Eric's exact setup and does not generalize cleanly to another STR owner
- product complexity grows faster than confidence in the underlying business value

## Future Product Scope

### Core Domain Areas

1. Property management context
2. Booking and payout tracking
3. Expense ingestion and review
4. Mileage and travel tracking
5. Budgeting and operating performance
6. Tax intelligence and year-end reporting
7. Supporting documents and audit history

### Core Features For The First Real Website

#### 1. Authentication And Workspace

- secure login
- user-owned workspace
- one or more properties per user or organization
- role support for owner, reviewer, and accountant later

#### 2. Property Management

- create and manage properties
- store placed-in-service date, ownership type, market, and notes
- property-specific reporting and filtering everywhere

#### 3. Data Import Pipeline

- upload CSV and spreadsheet files
- parse and normalize source files into staging records
- surface import issues and ambiguous rows for review
- preserve original source files for auditability

#### 4. Expense Review Workflow

- classify Business, Personal, or Review
- map transactions to Schedule E aligned categories
- attach receipt status and supporting files
- support bulk review for repeated merchants or categories

#### 5. Bookings And Revenue

- track booking source, guest, stay dates, fees, and net payout
- support Airbnb first, VRBO second, direct bookings later
- roll revenue into property-level reporting

#### 6. Dashboard And Reporting

- portfolio and property-level overview
- revenue, expenses, profit, occupancy, and budget views
- category breakdowns and monthly trends
- exportable summaries for tax prep and bookkeeping review

#### 7. Mileage And Travel

- track business trips tied to a property
- preserve mileage evidence and deduction calculations
- keep travel expenses and mileage logic distinct

#### 8. Tax Intelligence

- pre-service versus operational classification
- startup versus improvement tagging
- depreciation schedule support later
- Schedule E aligned outputs

## Non-Goals For The First Real Version

- full double-entry accounting system
- payroll, invoicing, or broad small-business ERP features
- custom mobile apps before the desktop workflow is proven
- AI categorization automation that requires model training before the workflow is stable
- direct bank integrations before the manual import pipeline is reliable

## Architecture Guardrails

These are the choices that prevent painful future rewrites.

### 1. The Database Must Be The Source Of Truth

Canonical data belongs in a relational database, not in Excel and not in browser local storage.

Spreadsheet files remain useful for:

- bootstrapping existing data
- manual import
- export for external review
- backup and interoperability

### 2. Imports Must Be First-Class Workflows

Imported files should not write directly into live business records.

The system should support:

- raw file upload
- staging rows
- validation and review
- promotion into canonical records
- preserved audit history

### 3. Multi-Property Must Exist In The Data Model From Day One

Even if the UI starts with one property, the schema should support many properties immediately. This is the cleanest way to avoid a destructive redesign later.

### 4. Auth And Data Access Must Be Built Early

Do not postpone user identity until after the app becomes useful. Ownership and access rules shape the schema, queries, and audit history.

### 5. Domain Logic Should Live In Explicit Services

Tax classification, reporting math, import parsing, and review rules should not be scattered across UI components. Keep business rules centralized so the frontend can change without rewriting the logic.

### 6. Auditability Is A Product Feature

The system must retain:

- source file provenance
- who changed what
- when a classification changed
- what evidence supports a deduction

### 7. Frontend And Backend Should Be Loosely Coupled

The frontend should consume stable domain APIs or a clear data access layer. That keeps redesign, framework shifts, or UI rewrites possible without throwing away the core system.

## Recommended Early Technical Direction

### Frontend

- Vite web app
- modular UI components and domain-focused client services
- hosted on Cloudflare Pages

### Backend

- Postgres-backed system of record
- Supabase for database, auth, storage, and row-level security
- server-side functions for imports, validation, and protected workflows

### Storage

- object storage for receipts, source CSV files, and spreadsheet imports

### Exports

- Excel export remains supported
- CSV and report exports added over time

## Suggested Domain Model

The initial data model should expect these core entities:

- users
- organizations or workspaces
- properties
- bookings
- expenses
- mileage_trips
- budgets
- import_jobs
- import_rows
- documents
- audit_events

This model is enough to support the current workflows while leaving room for collaboration, reporting, and automation later.

## Phased Delivery

### Phase 1: Product Foundation

- define schema and source-of-truth model
- stand up auth, properties, expenses, bookings, and imports
- move dashboard reads from spreadsheet state to database state
- retain spreadsheet import and export compatibility

### Phase 2: Workflow Completion

- add review queues and bulk actions
- add receipts and supporting document storage
- add stronger reporting and filters
- add audit history and import traceability

### Phase 3: Product Expansion

- VRBO and additional import connectors
- accountant and collaborator access
- richer tax workflows and depreciation support
- multi-property portfolio reporting

## Success Criteria

The first true version of the website is successful if it:

- works as a real web application without requiring Excel as the live backend
- supports at least one owner managing one or more properties cleanly
- preserves audit history for imports and transaction review
- keeps hosting and infrastructure within free-tier limits during early usage
- can absorb new workflows without structural redesign

More importantly, the product direction is validated only if it also proves:

- the expense import and review workflow is materially better than spreadsheet cleanup
- the booking and reporting model produces records a human can explain and trust
- the system can generalize from Keng's Landing to at least one plausible external STR operator profile without redefining the core workflow

## Open Questions

These questions should shape the next planning documents:

1. Will Keng's Landing remain a single-workspace product initially, or should collaboration be present from the start?
2. What reports are mandatory for a CPA-ready export package?
3. Which parts of tax intelligence should be hard-coded workflow support versus configurable rules?
4. What import sources matter most after Airbnb and bank CSVs?
5. Should booking ingestion and financial ingestion share one import pipeline or separate ones?
6. What exact threshold defines "materially better" for monthly finance operations: time saved, fewer cleanup errors, stronger audit confidence, or some combination?
7. Which mobile workflows actually matter in phase one: receipt capture, quick review, dashboard glance, mileage entry, or none yet?

## Recommended Next Documents

After this brief, planning should continue in this order:

1. architecture decision record for system boundaries
2. domain model and database schema draft
3. MVP feature breakdown by workflow
4. implementation roadmap by phase

This sequence keeps product intent ahead of implementation detail and reduces the chance of cornering the system into brittle decisions.