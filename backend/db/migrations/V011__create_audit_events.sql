-- V011: audit_events
-- Append-only event log. No updated_at — audit events are never modified after insert.
-- old_values and new_values capture state deltas for classification and commit events.

CREATE TABLE audit_events (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id   UUID        NOT NULL REFERENCES workspaces(id),
    actor_user_id  UUID        NOT NULL,
    entity_type    TEXT        NOT NULL,
    entity_id      UUID        NOT NULL,
    event_type     TEXT        NOT NULL,
    old_values     JSONB,
    new_values     JSONB,
    metadata       JSONB,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
