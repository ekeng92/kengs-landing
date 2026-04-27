-- V014: property_ical_feeds
-- Stores iCal feed URLs per property for automatic booking sync.
-- Each property can have multiple feeds (e.g. Airbnb + VRBO).

CREATE TABLE property_ical_feeds (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id       UUID        NOT NULL REFERENCES properties(id),
    workspace_id      UUID        NOT NULL REFERENCES workspaces(id),
    platform          TEXT        NOT NULL DEFAULT 'airbnb',
    ical_url          TEXT        NOT NULL,
    active            BOOLEAN     NOT NULL DEFAULT true,
    last_synced_at    TIMESTAMPTZ,
    last_sync_status  TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX property_ical_feeds_property_platform_idx
    ON property_ical_feeds (property_id, platform);
