-- V025: Property-level task system for cleaning/maintenance tasks
-- Visible to cleaners via token-based cleaning links.
-- Admin CRUD via authenticated API; cleaner completion via public token routes.

CREATE TABLE property_tasks (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    property_id     UUID        NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    title           TEXT        NOT NULL,
    description     TEXT,
    status          TEXT        NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'in_progress', 'completed', 'expired')),
    priority        TEXT        NOT NULL DEFAULT 'medium'
                    CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    due_date        DATE,
    auto_expire     BOOLEAN     NOT NULL DEFAULT false,
    notes           TEXT,
    created_by      UUID,
    completed_by    TEXT,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_property_tasks_workspace_property ON property_tasks(workspace_id, property_id);
CREATE INDEX idx_property_tasks_workspace_status ON property_tasks(workspace_id, status);
CREATE INDEX idx_property_tasks_due_date ON property_tasks(due_date) WHERE due_date IS NOT NULL;
