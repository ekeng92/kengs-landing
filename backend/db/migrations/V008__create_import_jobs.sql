-- V008: import_jobs
-- Represents a single uploaded file or ingestion run.
-- status lifecycle: uploaded → parsed → flagged → promoted | failed
-- (Note: domain model used 'draft' as first status; schema uses 'uploaded' — see schema-draft.md open questions.)

CREATE TABLE import_jobs (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id        UUID        NOT NULL REFERENCES workspaces(id),
    created_by_user_id  UUID        NOT NULL,
    import_type         TEXT        NOT NULL,
    original_filename   TEXT,
    storage_path        TEXT,
    status              TEXT        NOT NULL DEFAULT 'uploaded'
                                    CHECK (status IN ('uploaded', 'parsed', 'flagged', 'promoted', 'failed')),
    row_count           INTEGER,
    error_count         INTEGER,
    metadata            JSONB,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
