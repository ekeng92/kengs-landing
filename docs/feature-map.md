# Keng's Landing Feature Map

Purpose: map what Keng's Landing could/should become, then provide an execution order for agent-led development.

## Product thesis

Keng's Landing is both:

1. a real short-term-rental business operating system, and
2. the proving ground for an STR finance/tax product.

Features should either reduce Eric's real operational burden, improve tax/financial confidence, or validate a product workflow other STR owners would pay for.

## Guiding build order

1. **Protect the data** — tests, migrations, imports, audit trail.
2. **Make the board useful** — seed real tasks, recurring workflows, blocked follow-ups.
3. **Close tax readiness** — depreciation, pre-service buckets, CPA packet.
4. **Close guest/ops readiness** — guest guide gaps, turnover, supplies, vendor contacts.
5. **Improve revenue decisions** — competitor/rate tracking, booking reconciliation.
6. **Productize proven workflows** — multi-property, onboarding, exports, templates.

## Epics

### 1. Safety & developer confidence

Status: in progress.

- [x] Backend unit test runner
- [x] Typecheck green
- [x] CI gate for typecheck/tests
- [x] Migration safety check
- [x] Frontend link smoke check
- [x] Parser coverage for expense/Airbnb imports
- [x] Task/import route contract tests
- [ ] Frontend JS smoke tests with mocked API
- [ ] Import route happy-path tests with mocked Supabase
- [ ] Supabase local migration apply check
- [ ] Deployment preview checklist

### 2. Task board as external executive function

- [x] Waiting / Blocked lane
- [x] Follow-up date, energy, context, blocked reason fields
- [ ] Seed Keng's Landing launch/tax/ops cards from templates
- [ ] Task templates for recurring workflows
- [ ] Due/waiting digest endpoint
- [ ] Stale In Progress detector
- [ ] Morning/weekly digest automation
- [ ] Convert guest-book gaps into tasks

### 3. Tax readiness

- [ ] Freestone CAD land/building split captured
- [ ] Golf cart bill of sale captured
- [ ] Pre-service expense bucket workflow
- [ ] Depreciation schedule sheet/table
- [ ] Startup-cost vs capital-improvement classifier
- [ ] CPA packet export
- [ ] Receipt/documentation status dashboard
- [ ] Tax readiness score

### 4. Finance/import product core

- [x] Bank CSV parser
- [x] Airbnb parser
- [ ] VRBO parser from sample export
- [ ] Amazon order matching/import
- [ ] Import job happy-path route tests
- [ ] Review queue bulk actions
- [ ] Merchant rule memory
- [ ] Confidence explanation improvements
- [ ] Audit-event viewer
- [ ] Schedule E export

### 5. Bookings/revenue

- [ ] Booking calendar/reconciliation view
- [ ] iCal feed health dashboard
- [ ] Occupancy and ADR trends
- [ ] Rate change log
- [ ] Competitor rate tracker
- [ ] Platform fee/revenue reconciliation
- [ ] Direct booking support later

### 6. Guest operations

- [ ] Digital guest guide from `docs/GUEST-BOOK-OUTLINE.md`
- [ ] Check-in instructions section
- [ ] Septic rules section
- [ ] Emergency info section
- [ ] Pet policy / quiet hours / thermostat checkout
- [ ] Cleaner turnover checklist templates
- [ ] Maintenance log improvements
- [ ] Supplies inventory thresholds
- [ ] Vendor/contact sheet

### 7. Multi-property/productization

- [ ] Remove remaining 360-only assumptions
- [ ] Property switcher everywhere
- [ ] Workspace role model polish
- [ ] Onboarding wizard
- [ ] Demo/sample workspace seed
- [ ] CPA/bookkeeper role
- [ ] Product analytics events

## First execution queue

1. **Seed board cards** — make the board immediately useful.
2. **Frontend smoke tests** — ensure static pages do not silently break.
3. **Guest-guide gap tasks** — convert known missing guest-book sections into board cards.
4. **Import route happy-path tests** — protect parsing to staging rows.
5. **Tax readiness dashboard/card** — summarize blockers and next actions.

## Rule for agent work

Every meaningful feature slice should include at least one of:

- test coverage,
- a smoke/check script,
- a migration check,
- direct documented acceptance criteria.

Commit small. Keep the tree clean. Run gates before every commit.
