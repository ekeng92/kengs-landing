-- V024: Custom roles with granular scopes + invite tracking system
-- Enables GitHub PAT-style permission management: create named roles,
-- assign granular per-feature access levels, invite users by email.

-- ─── Custom Roles ─────────────────────────────────────────────────────────────

CREATE TABLE workspace_roles (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name            TEXT        NOT NULL,
    description     TEXT,
    scopes          JSONB       NOT NULL DEFAULT '{}'::jsonb,
    is_system       BOOLEAN     NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_workspace_roles_unique_name ON workspace_roles(workspace_id, lower(name));
CREATE INDEX idx_workspace_roles_workspace ON workspace_roles(workspace_id);

COMMENT ON TABLE workspace_roles IS 'Custom named roles with granular per-feature scopes (like GitHub PAT fine-grained tokens)';
COMMENT ON COLUMN workspace_roles.scopes IS 'JSONB map of feature → access level. Example: {"dashboard":"read","cleaning":"write","tasks":"none"}';
COMMENT ON COLUMN workspace_roles.is_system IS 'True for built-in roles (owner, admin) that cannot be deleted';

-- ─── Workspace Invites ────────────────────────────────────────────────────────

CREATE TABLE workspace_invites (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    email           TEXT        NOT NULL,
    token           TEXT        UNIQUE NOT NULL,
    role_id         UUID        REFERENCES workspace_roles(id) ON DELETE SET NULL,
    custom_scopes   JSONB,
    invited_by      UUID        NOT NULL,
    status          TEXT        NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
    invited_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    accepted_at     TIMESTAMPTZ,
    revoked_at      TIMESTAMPTZ,
    expires_at      TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
    accepted_user_id UUID,
    metadata        JSONB
);

CREATE INDEX idx_workspace_invites_token ON workspace_invites(token);
CREATE INDEX idx_workspace_invites_email ON workspace_invites(lower(email));
CREATE INDEX idx_workspace_invites_workspace ON workspace_invites(workspace_id);
CREATE INDEX idx_workspace_invites_status ON workspace_invites(status);

COMMENT ON TABLE workspace_invites IS 'Email invitations to join a workspace with a specific role/scope';
COMMENT ON COLUMN workspace_invites.role_id IS 'Custom role to assign on acceptance. If NULL, custom_scopes defines access directly';
COMMENT ON COLUMN workspace_invites.custom_scopes IS 'Direct scope assignment (alternative to role_id). Used when inviting with ad-hoc permissions';
COMMENT ON COLUMN workspace_invites.token IS 'Secure token embedded in invite URL — used to accept the invite';

-- ─── User Access Log ──────────────────────────────────────────────────────────

CREATE TABLE user_access_log (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id         UUID        NOT NULL,
    event_type      TEXT        NOT NULL
                    CHECK (event_type IN ('login', 'logout', 'invite_accepted', 'page_view', 'api_call')),
    ip_address      TEXT,
    user_agent      TEXT,
    metadata        JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_access_log_user ON user_access_log(user_id, created_at DESC);
CREATE INDEX idx_user_access_log_workspace ON user_access_log(workspace_id, created_at DESC);

COMMENT ON TABLE user_access_log IS 'Audit trail of user access events for security and compliance';

-- ─── Expand feature scopes ────────────────────────────────────────────────────
-- Add 'cleaning' and 'operations' to the features available for scoping.
-- These are tracked in code (permissions.ts VALID_FEATURES), not in DB constraints.
-- No DDL needed — just a note for the code layer.

-- ─── Expand role constraint ───────────────────────────────────────────────────
-- Add 'custom' role type for users assigned via custom workspace_roles.

ALTER TABLE workspace_memberships
  DROP CONSTRAINT IF EXISTS workspace_memberships_role_check;

ALTER TABLE workspace_memberships
  ADD CONSTRAINT workspace_memberships_role_check
  CHECK (role IN ('owner', 'admin', 'manager', 'reviewer', 'accountant', 'agent', 'custom'));

-- Link membership to custom role
ALTER TABLE workspace_memberships
  ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES workspace_roles(id) ON DELETE SET NULL;

-- ─── Seed system roles for existing workspace ─────────────────────────────────
-- Creates default system roles. Idempotent — skips if roles already exist.

INSERT INTO workspace_roles (workspace_id, name, description, scopes, is_system)
SELECT w.id, 'Owner', 'Full access to everything',
  '{"dashboard":"admin","tasks":"admin","finances":"admin","bookings":"admin","expenses":"admin","mileage":"admin","imports":"admin","properties":"admin","users":"admin","settings":"admin","cleaning":"admin","operations":"admin"}'::jsonb,
  true
FROM workspaces w
ON CONFLICT (workspace_id, lower(name)) DO NOTHING;

INSERT INTO workspace_roles (workspace_id, name, description, scopes, is_system)
SELECT w.id, 'Admin', 'Full access to everything',
  '{"dashboard":"admin","tasks":"admin","finances":"admin","bookings":"admin","expenses":"admin","mileage":"admin","imports":"admin","properties":"admin","users":"admin","settings":"admin","cleaning":"admin","operations":"admin"}'::jsonb,
  true
FROM workspaces w
ON CONFLICT (workspace_id, lower(name)) DO NOTHING;

INSERT INTO workspace_roles (workspace_id, name, description, scopes, is_system)
SELECT w.id, 'Cleaner', 'Cleaning checklists and assigned tasks only',
  '{"dashboard":"none","tasks":"none","finances":"none","bookings":"none","expenses":"none","mileage":"none","imports":"none","properties":"none","users":"none","settings":"none","cleaning":"write","operations":"read"}'::jsonb,
  true
FROM workspaces w
ON CONFLICT (workspace_id, lower(name)) DO NOTHING;
