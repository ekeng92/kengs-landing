-- V012: indexes
-- All performance and uniqueness indexes. Separated from table DDL for clarity.

-- workspace_memberships: one role per user per workspace
CREATE UNIQUE INDEX workspace_memberships_workspace_user_idx
    ON workspace_memberships (workspace_id, user_id);

-- properties: code must be unique within a workspace
CREATE UNIQUE INDEX properties_workspace_code_idx
    ON properties (workspace_id, code);

-- bookings: property-scoped date range queries
CREATE INDEX bookings_property_check_in_idx
    ON bookings (property_id, check_in_date);

-- bookings: workspace-scope dashboard queries (Slice 3)
CREATE INDEX bookings_workspace_check_in_idx
    ON bookings (workspace_id, check_in_date);

-- bookings: dedup lookup for platform imports
CREATE INDEX bookings_source_confirmation_idx
    ON bookings (source_platform, source_confirmation_code)
    WHERE source_confirmation_code IS NOT NULL;

-- expenses: property-scoped date queries
CREATE INDEX expenses_property_date_idx
    ON expenses (property_id, transaction_date);

-- expenses: workspace-scope dashboard queries (Slice 3)
CREATE INDEX expenses_workspace_date_idx
    ON expenses (workspace_id, transaction_date);

-- expenses: review queue filtering
CREATE INDEX expenses_category_review_state_idx
    ON expenses (category, review_state);

-- import_rows: review queue per job
CREATE INDEX import_rows_job_review_status_idx
    ON import_rows (import_job_id, review_status);

-- import_rows: idempotent promotion guard — same source row cannot promote twice into the same entity type
CREATE UNIQUE INDEX import_rows_dedupe_entity_type_idx
    ON import_rows (dedupe_key, promoted_entity_type)
    WHERE dedupe_key IS NOT NULL;

-- mileage_trips: property-scoped date queries
CREATE INDEX mileage_trips_property_date_idx
    ON mileage_trips (property_id, trip_date);

-- audit_events: entity history lookups
CREATE INDEX audit_events_workspace_entity_created_idx
    ON audit_events (workspace_id, entity_type, entity_id, created_at DESC);
