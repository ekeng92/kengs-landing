-- V010: documents
-- Receipts, source files, exports, or any supporting artifacts.
-- related_entity_type and related_entity_id are a polymorphic reference — validate at app layer.

CREATE TABLE documents (
    id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id         UUID        NOT NULL REFERENCES workspaces(id),
    property_id          UUID        REFERENCES properties(id),
    related_entity_type  TEXT,
    related_entity_id    UUID,
    document_type        TEXT        NOT NULL,
    storage_path         TEXT        NOT NULL,
    uploaded_by_user_id  UUID        NOT NULL,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
