-- V003: properties
-- A single rentable asset. All bookings, expenses, and mileage trips belong to a property.
-- code must be unique within a workspace (enforced via index in V012).

CREATE TABLE properties (
    id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id           UUID        NOT NULL REFERENCES workspaces(id),
    name                   TEXT        NOT NULL,
    code                   TEXT        NOT NULL,
    placed_in_service_date DATE,
    ownership_type         TEXT,
    market                 TEXT,
    notes                  TEXT,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
