-- V009: import_rows
-- A single parsed unit from an import job. Never a reporting source after promotion.
-- dedupe_key + promoted_entity_type uniqueness (partial, enforced in V012) makes promotion idempotent.

CREATE TABLE import_rows (
    id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    import_job_id         UUID        NOT NULL REFERENCES import_jobs(id),
    row_index             INTEGER     NOT NULL,
    entity_type           TEXT,
    raw_payload           JSONB       NOT NULL,
    normalized_payload    JSONB,
    validation_errors     JSONB,
    review_status         TEXT        NOT NULL DEFAULT 'pending'
                                      CHECK (review_status IN ('pending', 'flagged', 'approved', 'rejected', 'promoted')),
    promoted_entity_type  TEXT,
    promoted_entity_id    UUID,
    dedupe_key            TEXT,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
