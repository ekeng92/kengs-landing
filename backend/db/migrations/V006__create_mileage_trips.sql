-- V006: mileage_trips
-- Business travel records associated with operating a property.
-- deduction_amount may be stored as a snapshot or computed at read time from miles * deduction_rate.

CREATE TABLE mileage_trips (
    id                UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id      UUID           NOT NULL REFERENCES workspaces(id),
    property_id       UUID           NOT NULL REFERENCES properties(id),
    trip_date         DATE           NOT NULL,
    origin            TEXT,
    destination       TEXT,
    miles             NUMERIC(10,2)  NOT NULL,
    purpose           TEXT,
    deduction_rate    NUMERIC(10,4),
    deduction_amount  NUMERIC(12,2),
    created_at        TIMESTAMPTZ    NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ    NOT NULL DEFAULT now()
);
