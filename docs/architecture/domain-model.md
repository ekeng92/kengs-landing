# STR Finance Domain Model

## Purpose

Define the canonical business entities for the product so implementation can evolve without changing what the data means.

## Modeling Principles

- model the business truth, not the current UI tabs
- preserve provenance for imported and user-edited data
- support multiple properties from the first real schema
- keep user decisions reviewable and reversible where practical

## Core Entities

### User

Represents an authenticated person using the system.

Key concerns:

- identity
- membership in one or more workspaces
- role and permission boundaries

### Workspace

Represents the top-level operating container for a business or owner group.

Key concerns:

- ownership of properties and documents
- shared settings
- future collaboration boundaries

### Property

Represents a single rentable asset.

Key concerns:

- placed-in-service date
- ownership type
- market and descriptive metadata
- reporting scope for all operational records

### Booking

Represents a revenue-generating stay or reservation record.

Key concerns:

- source platform
- guest and stay details
- gross revenue, fees, taxes, and net payout
- relationship to one property

### Expense

Represents a business-related financial outflow or candidate outflow.

Key concerns:

- category
- merchant and description
- review state
- tax-period classification
- receipt or documentation status
- relationship to one property or shared/general overhead

### Mileage Trip

Represents a business travel record associated with operating a property.

Key concerns:

- trip date and purpose
- origin and destination
- mileage basis and calculation method
- property association

### Budget

Represents planned targets for revenue or expense categories.

Key concerns:

- category scope
- period scope
- property scope

### Import Job

Represents a single uploaded file or ingestion run.

Key concerns:

- source type
- upload metadata
- job status
- who initiated it
- source file retention

### Import Row

Represents a single row or parsed unit produced by an import job.

Key concerns:

- raw source payload
- normalized fields
- validation issues
- promotion status
- link to resulting booking or expense if promoted

### Document

Represents a stored receipt, source file, export, or supporting artifact.

Key concerns:

- storage location
- document type
- related entity
- retention value

### Audit Event

Represents a recorded business event or change log entry.

Key concerns:

- actor
- timestamp
- entity changed
- change type
- previous and new values where relevant

## Important Enumerations

These concepts must use a canonical vocabulary across product, docs, and implementation:

- review state: `Business`, `Personal`, `Review`
- tax period: `Pre-Service`, `Operational`
- documentation status: `CC`, `Y`, `N`
- import status: draft, parsed, flagged, promoted, failed

## Canonical Relationships

- a workspace has many properties
- a workspace has many users through membership
- a property has many bookings, expenses, mileage trips, budgets, and documents
- an import job has many import rows
- an import row may promote into a booking or expense
- an audit event belongs to a workspace and references one primary entity

## Lifecycle Notes

### Expense Lifecycle

1. imported or created
2. normalized
3. flagged or auto-classified
4. reviewed by a user if needed
5. committed as reportable business truth
6. revised later only through a tracked change

### Booking Lifecycle

1. imported from platform or entered manually
2. normalized against canonical booking fields
3. deduplicated or enriched
4. committed for reporting

### Import Lifecycle

1. file uploaded
2. import job created
3. rows parsed into import rows
4. validation and issue detection
5. rows promoted into domain entities
6. audit events recorded

## Open Questions

- whether collaboration should exist in the first real schema or be deferred behind a single-owner workspace assumption
- whether booking ingestion and financial ingestion should share one import abstraction or two specialized pipelines
- whether budgets belong only to properties or also to workspace-level portfolio views