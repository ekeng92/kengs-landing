# ADR-001: Prototype Boundaries And Durable Decisions

## Status

Accepted

## Context

The STR finance website should move quickly enough to validate product demand, but not so loosely that temporary prototype choices become accidental long-term architecture.

The current repo already proves there is workflow value in imports, review, reporting, and tax-aware bookkeeping. The risk now is not whether the idea is possible. The risk is that future implementation work mixes disposable UI experimentation with durable data and reporting decisions.

## Decision

Keng's Landing will use a **prototype-first, durability-selective** strategy.

This means:

- We will prototype workflows, layout, navigation, and AI assistance quickly.
- We will treat data semantics, ownership boundaries, import lifecycle, auditability, and metric definitions as durable from the start.
- We will allow rework in presentation and interaction layers, but avoid casual rework in the domain model.

## Durable From Day One

These areas are expensive to get wrong and must be defined intentionally before broad implementation:

- user, workspace, and property ownership boundaries
- canonical entity definitions
- import stages and promotion rules
- audit trail behavior
- revenue, expense, payout, occupancy, and tax-period semantics
- spreadsheet import and export compatibility rules

## Intentionally Disposable

These areas may change rapidly during validation:

- page layout and navigation structure
- component composition
- visual design direction
- dashboard arrangement
- mobile shell strategy
- AI-assisted affordances and prompts

## Alternatives Considered

### Build Durable Everywhere From The Start

Rejected because it increases upfront cost before real product fit is validated.

### Prototype Everything And Rebuild Later

Rejected because finance products accumulate hidden semantic debt. A later rebuild becomes much harder once users depend on outputs whose definitions were never stabilized.

## Consequences

### Positive

- preserves speed where learning is highest
- protects the most expensive-to-reverse decisions
- gives agents a clear rule for what can be improvised and what cannot

### Negative

- requires lightweight documentation before some implementation work
- may feel slower than freeform prototyping in the short term

## Operating Rule

Any feature that changes data meaning, import behavior, or reported business metrics must update a planning artifact in `docs/` as part of the same task.