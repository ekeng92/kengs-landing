# MVP Workflow Slices

## Purpose

Define the first implementation slices for the real web product in workflow terms rather than screen terms.

## Slice 1: Expense Import And Review

### User Outcome

An owner uploads a file, sees uncertain expense records clearly, classifies them, and trusts that the resulting records are reportable later.

### Why First

This is the most painful recurring workflow and the strongest differentiator from generic bookkeeping tools.

### Workflow

1. user uploads a bank or card export
2. system creates an import job
3. rows are parsed and normalized into candidate expenses
4. system flags ambiguous or low-confidence rows
5. user reviews flagged items in a queue
6. user applies classifications or leaves items in review
7. committed records become available to reporting

### Durable Decisions In This Slice

- import job and import row lifecycle
- expense review state semantics
- audit trail behavior for classification changes

### Disposable Decisions In This Slice

- queue layout
- filter placement
- badge styling

### Acceptance Criteria

- uploaded files create a traceable import job
- ambiguous rows are reviewable before they affect final reporting
- changing a classification creates a visible audit trail
- committed expenses can be filtered by property, category, and review state

## Slice 2: Booking And Revenue Ingestion

### User Outcome

An owner imports or records bookings and sees revenue represented consistently at the property level.

### Why Second

Revenue is the other half of the trust equation. Expense classification without reliable booking data limits product value.

### Workflow

1. user uploads Airbnb data or enters booking data manually
2. system parses and normalizes booking candidates
3. system deduplicates against existing bookings
4. user confirms or corrects edge cases
5. committed bookings feed revenue reporting

### Acceptance Criteria

- bookings can be associated with exactly one property
- duplicate imports do not create duplicate committed bookings
- gross revenue, fees, and net payout remain distinct values

## Slice 3: Property-Level Dashboard And Exports

### User Outcome

An owner sees a reliable property view of performance and can export clean data for tax or professional review.

### Why Third

Dashboards are useful only after the underlying records become trustworthy.

### Workflow

1. user selects workspace or property scope
2. system loads committed bookings and expenses
3. dashboard shows canonical metrics
4. user exports summaries or records as needed

### Acceptance Criteria

- dashboard metrics use one canonical definition each
- exports pull from committed records, not temporary import rows
- property filters behave consistently across views

## Out Of Scope For MVP Slices

- direct bank integrations
- full accountant collaboration model
- depreciation engine
- AI-trained categorization model
- native mobile application