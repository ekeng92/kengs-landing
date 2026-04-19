# Access Control Model

## Purpose

Define who can see, create, edit, approve, and export records in the product so auth, database policy, and workflow design start from the same truth.

## Core Principle

The product is single-workspace safe from day one and collaboration-ready by design, even if early real-world usage begins with one owner.

This means:

- every business record belongs to exactly one workspace
- every authenticated user acts inside an explicit workspace membership
- access is granted by workspace role, not by hidden assumptions in the UI
- database policy must enforce isolation even if frontend checks fail

## Canonical Roles

### Owner

The operator with full control over workspace data, configuration, members, and exports.

### Reviewer

The person who helps process operational finance work such as imports, classification, receipt follow-up, and record review.

### Accountant

The person who needs clean visibility into records, audit history, and exports without participating in day-to-day operational editing.

## MVP Activation Rule

The first real implementation may launch with owner-only live usage, but the schema and access model must support all three roles from the beginning.

Do not hardcode single-user assumptions into the backend.

## Permission Matrix

| Capability | Owner | Reviewer | Accountant |
|---|---|---|---|
| View workspace records | yes | yes | yes |
| Create and edit properties | yes | no | no |
| Change placed-in-service date | yes | no | no |
| Upload source files | yes | yes | no |
| Create import jobs | yes | yes | no |
| Review import rows | yes | yes | no |
| Promote import rows into committed records | yes | yes | no |
| Edit committed expense classification | yes | yes | no |
| Edit committed booking details | yes | limited | no |
| Upload supporting documents | yes | yes | no |
| View audit trail | yes | yes | yes |
| Export reports and ledgers | yes | yes | yes |
| Manage workspace members | yes | no | no |
| Delete committed business records | yes | no | no |

## Field-Level Rules

### Properties

- only owners may create, archive, or materially redefine properties
- changing a property's placed-in-service date is treated as a durable business change and must create an audit event

### Expenses

- owners and reviewers may change category, review state, description, documentation status, property assignment, and tax period override state
- deleting a committed expense is owner-only and should be rare
- when practical, replacement or reversal should be preferred over silent deletion

### Bookings

- owners may fully edit committed bookings
- reviewers may correct booking metadata tied to import cleanup, but may not reassign booking ownership boundaries or delete committed bookings
- accountants remain read-only for bookings

### Imports

- owners and reviewers may upload files, inspect parsing results, resolve flagged rows, and promote rows into canonical records
- accountants may view import provenance and errors but may not run imports

## Workspace Isolation Rules

- users may only access records belonging to workspaces where they have membership
- all core tables must enforce workspace ownership in the database layer
- all reads and writes must scope by `workspace_id`
- denormalized `workspace_id` values on child tables exist as guardrails, not optional metadata

## Audit Rules

The following actions must always create audit events:

- role membership changes
- property creation or placed-in-service changes
- import row promotion into committed records
- manual changes to committed booking or expense meaning
- any explicit tax-period override
- record deletion or archival actions

## Database Enforcement Direction

For the first real backend:

- row-level security should be the default enforcement layer for workspace isolation
- application code may provide additional guardrails, but must not be the only protection
- role checks should resolve from `workspace_memberships`, not from global user flags

## Product Design Implications

- every page that edits business records must understand the acting workspace and role
- owner-only actions should be visually distinct
- reviewers should be optimized for throughput on imports and classifications
- accountant workflows should optimize trust, visibility, and export access rather than editing power

## Out Of Scope

- public sharing links
- client or guest portal access
- granular custom permission builders
- approval chains beyond the core role model

## Open Questions

- whether a future manager or operator role is needed separate from reviewer
- whether accountant export access should eventually be scoped by export type