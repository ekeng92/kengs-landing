-- V015: Create tasks table for AEON Kanban board
-- Supports cross-project task tracking with short reference codes

CREATE SEQUENCE IF NOT EXISTS tasks_ref_seq;

CREATE TABLE IF NOT EXISTS tasks (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id  uuid NOT NULL REFERENCES workspaces(id),
  ref_number    integer NOT NULL DEFAULT nextval('tasks_ref_seq'),
  ref_code      text GENERATED ALWAYS AS ('AEON-' || lpad(ref_number::text, 3, '0')) STORED,
  title         text NOT NULL,
  description   text,
  status        text NOT NULL DEFAULT 'backlog'
                  CHECK (status IN ('backlog', 'todo', 'in_progress', 'done', 'archived')),
  priority      text NOT NULL DEFAULT 'medium'
                  CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  project       text,
  tags          text[] DEFAULT '{}',
  created_by    text,
  assigned_to   text,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

ALTER SEQUENCE tasks_ref_seq OWNED BY tasks.ref_number;

CREATE UNIQUE INDEX IF NOT EXISTS tasks_ref_number_workspace
  ON tasks (workspace_id, ref_number);

CREATE INDEX IF NOT EXISTS tasks_workspace_status
  ON tasks (workspace_id, status);

CREATE INDEX IF NOT EXISTS tasks_workspace_project
  ON tasks (workspace_id, project);

-- RLS
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY tasks_workspace_access ON tasks
  FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_memberships
      WHERE user_id = auth.uid()
    )
  );
