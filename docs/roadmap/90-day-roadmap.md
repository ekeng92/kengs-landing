# 90-Day Roadmap

## Purpose

Sequence the next 90 days of work by risk retirement so product learning stays fast without creating semantic debt.

## Phase 1: Weeks 1-3

### Goal

Lock the durable foundation before substantial new implementation.

### Deliverables

- accepted prototype-boundary ADR
- first-pass domain model
- first-pass MVP workflow slices
- clarified success signals for prototype validation

### Success Signal

Agents can describe what is disposable versus durable without improvising the answer.

## Phase 2: Weeks 4-6

### Goal

Stand up the first real product backbone.

### Deliverables

- schema draft for workspace, property, booking, expense, import job, import row, and audit event
- backend platform decision locked for initial build
- first import workflow contract defined end to end

### Success Signal

There is one clear system of record path for expense and booking data, even if the UI is still rough.

## Phase 3: Weeks 7-9

### Goal

Ship one workflow completely enough to judge product value.

### Deliverables

- expense import and review implemented against the product data model
- review queue usable on desktop
- audit trail visible for classification changes

### Success Signal

You can process a real batch of expenses without falling back to spreadsheet-first operations for the core decision loop.

## Phase 4: Weeks 10-12

### Goal

Close the minimum trust loop for revenue plus reporting.

### Deliverables

- booking ingestion path
- property-level dashboard based on committed records
- export path for external review

### Success Signal

The product can support one owner operating one or more properties with credible records and exports.

## Immediate Next Questions

- what exact success threshold tells us the prototype has earned deeper investment
- which exports are mandatory for CPA-ready output
- what first-pass booking reconciliation rule should be treated as durable before booking ingestion work begins