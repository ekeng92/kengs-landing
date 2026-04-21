-- V005: expenses
-- Business-related financial outflows. May be property-specific or workspace-general (property_id nullable).
-- review_state: Business | Personal | Review — canonical classification vocabulary.
-- tax_period: Pre-Service | Operational — snapshot at commit time.
-- status: draft → committed | voided — only committed expenses feed reporting (Slice 3 requirement).

CREATE TABLE expenses (
    id                      UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id            UUID           NOT NULL REFERENCES workspaces(id),
    property_id             UUID           REFERENCES properties(id),
    transaction_date        DATE           NOT NULL,
    merchant_name           TEXT,
    description             TEXT,
    category                TEXT,
    amount                  NUMERIC(12,2)  NOT NULL,
    payment_method          TEXT,
    review_state            TEXT           NOT NULL DEFAULT 'Review'
                                           CHECK (review_state IN ('Business', 'Personal', 'Review')),
    tax_period              TEXT           CHECK (tax_period IN ('Pre-Service', 'Operational')),
    documentation_status    TEXT           CHECK (documentation_status IN ('CC', 'Y', 'N')),
    needs_receipt_followup  BOOLEAN        NOT NULL DEFAULT false,
    status                  TEXT           NOT NULL DEFAULT 'draft'
                                           CHECK (status IN ('draft', 'committed', 'voided')),
    source_import_row_id    UUID,
    created_at              TIMESTAMPTZ    NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ    NOT NULL DEFAULT now()
);
