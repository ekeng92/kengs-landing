# Tax Period Classification

## Purpose

Define how the product classifies records as `Pre-Service` or `Operational` so imports, reporting, and tax-ready outputs use one durable rule.

## Core Principle

`tax_period` is stored as a snapshot on committed expense records.

It is derived by default from property service timing, but once a record is committed it should not silently change because a property setting changed later. If classification needs to change, that change must be explicit, reviewable, and audited.

## Canonical Definitions

### Pre-Service

An expense incurred before the property is considered in service for rental operations.

### Operational

An expense incurred on or after the property's placed-in-service date and treated as part of normal rental operations.

## Default Rule

For property-scoped expenses:

- if `transaction_date` is before `placed_in_service_date`, default `tax_period = Pre-Service`
- if `transaction_date` is on or after `placed_in_service_date`, default `tax_period = Operational`

For workspace-level general overhead:

- no automatic property-based tax-period assumption should be made
- these records must be explicitly reviewed if tax treatment matters

## Source Of Truth For Service Start

The property's `placed_in_service_date` is the default source for service transition logic.

Only owners may change that date.

## Override Rules

- owners and reviewers may override `tax_period` on a committed expense only through an explicit edit action
- every override requires a reason note
- every override creates an audit event with old value, new value, actor, and timestamp
- overrides change only the targeted expense record, not the property's default logic

## Property Date Changes

If an owner changes `placed_in_service_date`:

- existing committed expenses do not auto-rewrite
- the system should flag potentially affected records for review
- future default classification uses the new date
- the date change itself must create an audit event

This avoids hidden restatements of historical records.

## Import Behavior

During import normalization:

- the candidate row should receive a default `tax_period` suggestion using the property rule when property resolution is confident
- if property resolution is ambiguous, the row should be flagged for review instead of receiving a silent tax-period assumption
- the committed expense stores the chosen final value at promotion time

## Reporting Rules

- operational performance dashboards exclude `Pre-Service` expenses by default
- tax-oriented views and exports may include both `Pre-Service` and `Operational` expenses when explicitly requested
- reports must label which tax-period scope they are using

## Edge Cases

### Backdated Expenses Entered Later

The classification uses the expense `transaction_date`, not the date the record was entered.

### Missing Property Assignment

If a property cannot be determined with confidence, the record should stay in review rather than receiving a default tax period.

### Reimbursement Or Correction Entries

Correction handling should preserve the original record's audit trail and classify the correcting record explicitly rather than rewriting history invisibly.

## Out Of Scope

- depreciation schedules
- capital-improvement treatment logic beyond tax-period labeling
- CPA-specific elections or filing advice