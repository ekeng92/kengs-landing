-- V013: add confidence_score to import_rows
-- Flagged as a schema dependency in docs/specs/expense-import-review.md (Auto-Approval Rules).
-- Required by the expense-import auto-approval logic to persist and surface the row's
-- confidence evaluation score. Range: 0.0000–1.0000. NULL means row failed parsing.

ALTER TABLE import_rows
    ADD COLUMN confidence_score NUMERIC(5,4)
        CHECK (confidence_score >= 0 AND confidence_score <= 1);
