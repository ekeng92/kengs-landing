# Export Formats

## Purpose

Define what the product must export for tax review, bookkeeping review, and operational analysis so exports are not invented ad hoc late in implementation.

## Core Principle

An export is a product surface, not a debug dump.

Every export must have a named business purpose, a clear scope, and fields that match the canonical product definitions.

## Initial Export Types

### 1. Expense Ledger Export

Purpose:

- support detailed bookkeeping review
- support CPA or owner inspection of committed expenses

Format:

- CSV first

Required fields:

- property
- transaction date
- merchant name
- description
- category
- amount
- review state
- tax period
- documentation status
- source import job reference when available

### 2. Booking Revenue Export

Purpose:

- support revenue review and cross-checking against platform data

Format:

- CSV first

Required fields:

- property
- source platform
- confirmation identifier when available
- guest name when available
- check-in date
- check-out date
- nights
- gross booking revenue
- platform fees
- taxes when captured
- net payout revenue

### 3. Tax Summary Export

Purpose:

- support Schedule E aligned review and CPA handoff

Format:

- CSV first, with printable summary later

Required outputs:

- business expenses grouped by canonical category
- clear separation of `Pre-Service` and `Operational` expense treatment
- property-level and workspace-level views when relevant
- explicit reporting period label

### 4. Audit-Oriented Import Review Export

Purpose:

- support trust and troubleshooting for import behavior

Format:

- CSV first

Required fields:

- import job id
- source filename
- source row index
- promotion status
- promoted entity type and id when available
- validation or review status

## Scope Rules

- exports must support property scope and workspace scope where the data model allows it
- exports must include an explicit period label
- exports must state whether they use committed records only or include review-state records

## Canonical Naming Rule

Export column names must align to the canonical metric and domain definitions already defined in the planning docs.

Do not label net payout as gross revenue, and do not collapse pre-service expenses into operating expenses without an explicit column.

## CPA-Ready Minimum Standard

For the first real version, "CPA-ready" means:

- the exported records are committed business truth, not staging data
- expense categories align to the product's canonical Schedule E taxonomy
- tax-period labeling is visible
- record provenance can be traced back to imports when needed
- the output is understandable without reading product-internal code or field names

## Out Of Scope

- direct tax filing integrations
- PDF tax packet generation in the first implementation pass
- custom accountant templates per firm