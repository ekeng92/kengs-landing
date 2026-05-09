-- V023: Cleaning checklist system
-- Public-facing cleaning checklists accessible via token-based links.
-- No auth required for public routes — access is controlled by revocable tokens.

-- cleaning_links: who has access and to what property
CREATE TABLE cleaning_links (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    token           TEXT        UNIQUE NOT NULL,
    property_id     UUID        REFERENCES properties(id),
    workspace_id    UUID        NOT NULL REFERENCES workspaces(id),
    cleaner_name    TEXT        NOT NULL,
    cleaner_contact TEXT,
    cleaning_type   TEXT        NOT NULL DEFAULT 'all',
    is_active       BOOLEAN     NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at      TIMESTAMPTZ
);

CREATE INDEX idx_cleaning_links_token ON cleaning_links(token);

-- cleaning_sessions: each time the checklist is opened
CREATE TABLE cleaning_sessions (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    link_id           UUID        NOT NULL REFERENCES cleaning_links(id),
    workspace_id      UUID        NOT NULL REFERENCES workspaces(id),
    ip_address        TEXT,
    city              TEXT,
    country           TEXT,
    timezone          TEXT,
    user_agent        TEXT,
    screen_size       TEXT,
    language          TEXT,
    connection_type   TEXT,
    latitude          NUMERIC,
    longitude         NUMERIC,
    geo_accuracy      NUMERIC,
    referrer          TEXT,
    opened_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    submitted_at      TIMESTAMPTZ,
    duration_seconds  INTEGER,
    status            TEXT        NOT NULL DEFAULT 'in_progress',
    notes             TEXT
);

CREATE INDEX idx_cleaning_sessions_link ON cleaning_sessions(link_id);
CREATE INDEX idx_cleaning_sessions_status ON cleaning_sessions(status);

-- cleaning_items: individual checklist items per session
CREATE TABLE cleaning_items (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id  UUID        NOT NULL REFERENCES cleaning_sessions(id) ON DELETE CASCADE,
    item_key    TEXT        NOT NULL,
    item_label  TEXT        NOT NULL,
    section     TEXT,
    checked     BOOLEAN     NOT NULL DEFAULT false,
    checked_at  TIMESTAMPTZ
);

CREATE INDEX idx_cleaning_items_session ON cleaning_items(session_id);
