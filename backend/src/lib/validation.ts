import { z } from 'zod'

// Shared enums for task fields
export const taskStatus = z.enum([
  'backlog', 'todo', 'in_progress', 'review', 'waiting', 'done', 'archived',
])

export const taskPriority = z.enum(['low', 'medium', 'high', 'critical', 'urgent'])

export const taskEffort = z.enum(['quick', 'shallow', 'deep', 'errand', 'call'])

export const taskContext = z.enum(['phone', 'computer', 'errand', 'anywhere', 'home', 'property', 'cpa', 'vendor'])

// Query params for task list
export const TaskListQuery = z.object({
  workspace_id: z.string().min(1, 'workspace_id is required'),
  status: taskStatus.optional(),
  project: z.string().optional(),
  priority: taskPriority.optional(),
  context: taskContext.optional(),
  assigned_to: z.string().optional(),
})

// Create task body
export const CreateTaskBody = z.object({
  workspace_id: z.string().min(1, 'workspace_id is required'),
  title: z.string().min(1, 'title is required').max(500),
  description: z.string().max(5000).optional(),
  status: taskStatus.optional().default('backlog'),
  priority: taskPriority.optional().default('medium'),
  project: z.string().max(200).optional(),
  tags: z.array(z.string().max(50)).max(20).optional().default([]),
  assigned_to: z.string().nullable().optional(),
  due_date: z.string().date().nullable().optional(),
  effort: taskEffort.nullable().optional(),
  context: taskContext.nullable().optional(),
  blocked_reason: z.string().max(1000).nullable().optional(),
})

// Update task body (all fields optional)
export const UpdateTaskBody = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).nullable().optional(),
  status: taskStatus.optional(),
  priority: taskPriority.optional(),
  project: z.string().max(200).nullable().optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  assigned_to: z.string().nullable().optional(),
  due_date: z.string().date().nullable().optional(),
  effort: taskEffort.nullable().optional(),
  context: taskContext.nullable().optional(),
  blocked_reason: z.string().max(1000).nullable().optional(),
}).refine(obj => Object.keys(obj).length > 0, {
  message: 'At least one field must be provided for update',
})

// Move task body
export const MoveTaskBody = z.object({
  status: taskStatus,
})

// Bulk create body
export const BulkCreateTasksBody = z.object({
  workspace_id: z.string().min(1, 'workspace_id is required'),
  tasks: z.array(z.object({
    title: z.string().min(1).max(500),
    description: z.string().max(5000).optional(),
    status: taskStatus.optional().default('backlog'),
    priority: taskPriority.optional().default('medium'),
    project: z.string().max(200).optional(),
    tags: z.array(z.string().max(50)).max(20).optional().default([]),
    due_date: z.string().date().nullable().optional(),
    effort: taskEffort.nullable().optional(),
    context: taskContext.nullable().optional(),
    blocked_reason: z.string().max(1000).nullable().optional(),
  })).min(1, 'tasks array must have at least one item').max(100),
})
