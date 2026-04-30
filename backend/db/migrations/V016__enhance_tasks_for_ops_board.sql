-- V016: Enhance tasks for STR operations / executive-function board
-- Adds a Waiting/Blocked lane plus lightweight planning metadata.

ALTER TABLE tasks
  DROP CONSTRAINT IF EXISTS tasks_status_check;

ALTER TABLE tasks
  ADD CONSTRAINT tasks_status_check
  CHECK (status IN ('backlog', 'todo', 'in_progress', 'waiting', 'done', 'archived'));

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS due_date date,
  ADD COLUMN IF NOT EXISTS effort text CHECK (effort IS NULL OR effort IN ('quick', 'deep', 'errand', 'call')),
  ADD COLUMN IF NOT EXISTS context text CHECK (context IS NULL OR context IN ('computer', 'phone', 'home', 'property', 'cpa', 'vendor')),
  ADD COLUMN IF NOT EXISTS blocked_reason text;

CREATE INDEX IF NOT EXISTS tasks_workspace_due_date
  ON tasks (workspace_id, due_date)
  WHERE due_date IS NOT NULL;
