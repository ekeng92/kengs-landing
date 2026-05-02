-- V020: Add completion_notes to tasks for review workflow
-- When an agent moves a task to 'review', completion_notes describes
-- what was built, how it was validated, and what commits contain the change.
-- This is the evidence trail for SAGE review.

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS completion_notes TEXT;
