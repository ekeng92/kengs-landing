-- V004: bookings
-- Revenue-generating stays or reservations. Always belongs to exactly one property.
-- source_confirmation_code is the dedup anchor for platform imports (Airbnb, VRBO).

CREATE TABLE bookings (
    id                      UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id            UUID           NOT NULL REFERENCES workspaces(id),
    property_id             UUID           NOT NULL REFERENCES properties(id),
    source_platform         TEXT           NOT NULL,
    source_confirmation_code TEXT,
    guest_name              TEXT,
    check_in_date           DATE           NOT NULL,
    check_out_date          DATE           NOT NULL,
    nights                  INTEGER,
    gross_revenue_amount    NUMERIC(12,2),
    cleaning_fee_amount     NUMERIC(12,2),
    platform_fee_amount     NUMERIC(12,2),
    tax_amount              NUMERIC(12,2),
    net_payout_amount       NUMERIC(12,2),
    status                  TEXT           NOT NULL DEFAULT 'draft'
                                           CHECK (status IN ('draft', 'committed', 'voided')),
    source_import_row_id    UUID,
    created_at              TIMESTAMPTZ    NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ    NOT NULL DEFAULT now()
);
