# Metric Definitions

## Purpose

Define the canonical metrics used by dashboard, reporting, and exports so the product never shows the same label with two different formulas.

## Core Principle

If two numbers answer different business questions, they must have different names.

Do not collapse gross revenue, net payout, and profit into a single generic "revenue" figure.

## Record Eligibility Rules

Unless a report explicitly states otherwise:

- dashboard metrics use committed records only
- expenses included in operational metrics must have `review_state = Business`
- `Pre-Service` expenses are excluded from operational dashboard metrics by default
- import rows never count as reportable records

## Canonical Metrics

### Gross Booking Revenue

The sum of `bookings.gross_revenue_amount` for committed bookings in the selected scope and period.

Use when answering: how much rental revenue was earned before platform deductions.

### Platform Fees

The sum of `bookings.platform_fee_amount` for committed bookings in the selected scope and period.

Use when answering: how much was retained by the booking platform.

### Net Payout Revenue

The sum of `bookings.net_payout_amount` for committed bookings in the selected scope and period.

Use when answering: how much cash reached the operator from bookings.

### Business Operating Expenses

The sum of committed `expenses.amount` where:

- `review_state = Business`
- `tax_period = Operational`
- the record falls in the selected scope and period

Use when answering: what operating spend applied to normal rental operations.

### Pre-Service Expenses

The sum of committed `expenses.amount` where:

- `review_state = Business`
- `tax_period = Pre-Service`
- the record falls in the selected scope and period

This is a distinct metric and must not be mixed into operating performance by default.

### Net Operating Result

`Net Payout Revenue - Business Operating Expenses`

Use when answering: how the property or workspace performed after platform deductions and operating spend.

Do not label this as profit without context.

### Occupancy Rate

`Booked Nights / Available Nights`

Where:

- booked nights come from committed bookings in the selected period and property scope
- available nights are the count of nights the property was rentable in that same period

Occupancy is a property-level metric first. Workspace occupancy must be presented as an aggregated portfolio metric, not implied as a single-property value.

## Scope Rules

### Property Scope

- property dashboards include records belonging to that property only
- workspace-general expenses do not silently appear in a property unless explicitly allocated

### Workspace Scope

- workspace rollups may include all property-scoped records plus workspace-general expenses
- workspace rollups must clearly label when general overhead is included

### Time Scope

- monthly views use record dates within the selected calendar month
- year-to-date views use the selected year start through the selected as-of date
- exports must state their date basis explicitly

## Naming Rules

- use `Gross Booking Revenue`, not `Revenue`, when the number is before fees
- use `Net Payout Revenue`, not `Revenue`, when the number is after fees
- use `Net Operating Result`, not `Profit`, unless taxes and non-operating treatment are clearly excluded or stated
- use `Business Operating Expenses`, not `Expenses`, when personal and pre-service records are excluded

## Excluded By Default

The following records do not count in operational dashboard metrics unless a report explicitly opts in:

- expenses in `Review`
- expenses in `Personal`
- expenses in `Pre-Service`
- failed or unpromoted import rows

## Export Alignment Rule

Exports must reuse the same metric names and formulas defined here.

If an export needs a different formula, it must define a new named metric rather than overloading an existing one.