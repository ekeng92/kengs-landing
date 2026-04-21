-- V002: workspace_memberships
-- Associates users with workspaces and assigns access roles.
-- Unique constraint (workspace_id, user_id) enforced via index in V012.

CREATE TABLE workspace_memberships (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id  UUID        NOT NULL REFERENCES workspaces(id),
    user_id       UUID        NOT NULL,
    role          TEXT        NOT NULL CHECK (role IN ('owner', 'reviewer', 'accountant')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
