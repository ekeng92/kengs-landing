-- V018: Add 'review' status to tasks for PR-style workflow
-- Flow: backlog → todo → in_progress → review → done
-- 'review' means work is complete but needs SAGE review/acceptance before closing

ALTER TABLE tasks
  DROP CONSTRAINT IF EXISTS tasks_status_check;

ALTER TABLE tasks
  ADD CONSTRAINT tasks_status_check
  CHECK (status IN ('backlog', 'todo', 'in_progress', 'review', 'waiting', 'done', 'archived'));
