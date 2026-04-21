-- V007: budgets
-- Planned revenue or expense targets. Scoped to a workspace or property+year+category.
-- property_id is nullable for workspace-wide portfolio targets.

CREATE TABLE budgets (
    id            UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id  UUID           NOT NULL REFERENCES workspaces(id),
    property_id   UUID           REFERENCES properties(id),
    year          INTEGER        NOT NULL,
    category      TEXT           NOT NULL,
    amount        NUMERIC(12,2)  NOT NULL,
    created_at    TIMESTAMPTZ    NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ    NOT NULL DEFAULT now()
);
