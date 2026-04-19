# ADR-002: Initial Product Platform

## Status

Accepted

## Context

The product is transitioning from spreadsheet-driven prototype behavior into a real web application. The platform choice must support:

- authenticated multi-workspace ownership boundaries
- relational system-of-record data
- object storage for imports and receipts
- row-level security for workspace isolation
- low-cost early-stage operation

The product brief already points toward a Postgres-backed system with Supabase and Cloudflare Pages. This ADR turns that direction into a durable decision for the first real build.

## Decision

The initial product platform will use:

- Cloudflare Pages for frontend hosting
- Supabase Postgres as the canonical database
- Supabase Auth for authenticated user identity
- Supabase Storage for source files, receipts, and export artifacts
- server-side product workflows implemented through a protected backend layer compatible with Supabase and the chosen frontend

## Why This Decision

- Postgres fits the relational domain model and audit-heavy workflow better than local-only or document-first persistence
- Supabase provides auth, storage, and row-level security without requiring a large custom backend from day one
- the platform supports the product's free-tier-friendly constraint during early validation
- this stack preserves a path to scale without forcing the spreadsheet to remain the live backend

## Non-Decision

This ADR does not lock the frontend framework beyond the current Vite direction, and it does not require every server-side workflow to be implemented the same way. It locks the core data and auth platform, not every implementation detail above it.

## Consequences

### Positive

- one clear system of record path
- access control can be enforced in the database layer
- file provenance and auditability become first-class product features
- the build can move from prototype UI to durable backend without rethinking the storage model again

### Negative

- the team must define row-level security and workspace access correctly before broad backend implementation
- prototype-only local persistence should be treated as transitional from this point onward

## Operating Rule

Any new backend-facing feature must align to this platform decision unless a later ADR explicitly changes it.