import { z } from 'zod'

// Shared enums for task fields
export const taskStatus = z.enum([
  'backlog', 'todo', 'in_progress', 'review', 'waiting', 'done', 'archived',
])

export const taskPriority = z.enum(['low', 'medium', 'high', 'critical', 'urgent'])

export const taskEffort = z.enum(['quick', 'shallow', 'deep', 'errand', 'call'])

export const taskContext = z.enum(['phone', 'computer', 'errand', 'anywhere', 'home', 'property', 'cpa', 'vendor'])

// Pagination — reusable across all list queries
export const paginationParams = {
  limit: z.coerce.number().int().min(1).max(500).optional().default(100),
  offset: z.coerce.number().int().min(0).optional().default(0),
}

// Query params for task list
export const TaskListQuery = z.object({
  workspace_id: z.string().min(1, 'workspace_id is required'),
  status: taskStatus.optional(),
  project: z.string().optional(),
  priority: taskPriority.optional(),
  context: taskContext.optional(),
  assigned_to: z.string().optional(),
  assigned_agent: z.string().optional(),
  session_id: z.string().optional(),
  ...paginationParams,
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
  completion_notes: z.string().max(5000).nullable().optional(),
  clarification_notes: z.string().max(5000).nullable().optional(),
  assigned_agent: z.string().max(100).nullable().optional(),
  session_id: z.string().max(200).nullable().optional(),
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
  completion_notes: z.string().max(5000).nullable().optional(),
  clarification_notes: z.string().max(5000).nullable().optional(),
  assigned_agent: z.string().max(100).nullable().optional(),
  session_id: z.string().max(200).nullable().optional(),
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
    completion_notes: z.string().max(5000).nullable().optional(),
    clarification_notes: z.string().max(5000).nullable().optional(),
    assigned_agent: z.string().max(100).nullable().optional(),
    session_id: z.string().max(200).nullable().optional(),
  })).min(1, 'tasks array must have at least one item').max(100),
})

// ─── Shared enums ─────────────────────────────────────────────────────────────

export const recordStatus = z.enum(['draft', 'committed', 'voided'])
export const expenseReviewState = z.enum(['Business', 'Personal', 'Review'])
export const taxPeriod = z.enum(['Pre-Service', 'Operational'])
export const sourcePlatform = z.enum(['airbnb', 'vrbo', 'direct', 'other'])

// ─── Bookings ─────────────────────────────────────────────────────────────────

export const BookingListQuery = z.object({
  workspace_id: z.string().min(1, 'workspace_id is required'),
  property_id: z.string().optional(),
  status: recordStatus.optional(),
  source_platform: z.string().max(50).optional(),
  ...paginationParams,
})

export const CreateBookingBody = z.object({
  workspace_id: z.string().min(1, 'workspace_id is required'),
  property_id: z.string().min(1, 'property_id is required'),
  check_in_date: z.string().date('check_in_date must be YYYY-MM-DD'),
  check_out_date: z.string().date('check_out_date must be YYYY-MM-DD'),
  net_payout_amount: z.coerce.number(),
  source_platform: z.string().max(50).optional().default('direct'),
  source_confirmation_code: z.string().max(100).nullable().optional(),
  guest_name: z.string().max(200).nullable().optional(),
  gross_revenue_amount: z.coerce.number().nullable().optional(),
  cleaning_fee_amount: z.coerce.number().nullable().optional(),
  platform_fee_amount: z.coerce.number().nullable().optional(),
  tax_amount: z.coerce.number().nullable().optional(),
})

export const UpdateBookingBody = z.object({
  guest_name: z.string().max(200).nullable().optional(),
  source_confirmation_code: z.string().max(100).nullable().optional(),
  source_platform: z.string().max(50).optional(),
  check_in_date: z.string().date().optional(),
  check_out_date: z.string().date().optional(),
  gross_revenue_amount: z.coerce.number().nullable().optional(),
  cleaning_fee_amount: z.coerce.number().nullable().optional(),
  platform_fee_amount: z.coerce.number().nullable().optional(),
  tax_amount: z.coerce.number().nullable().optional(),
  net_payout_amount: z.coerce.number().optional(),
  notes: z.string().max(5000).nullable().optional(),
}).refine(obj => Object.keys(obj).length > 0, {
  message: 'At least one field must be provided for update',
})

// ─── Expenses ─────────────────────────────────────────────────────────────────

export const ExpenseListQuery = z.object({
  workspace_id: z.string().min(1, 'workspace_id is required'),
  property_id: z.string().optional(),
  review_state: expenseReviewState.optional(),
  status: recordStatus.optional(),
  ...paginationParams,
})

export const CreateExpenseBody = z.object({
  workspace_id: z.string().min(1, 'workspace_id is required'),
  property_id: z.string().min(1, 'property_id is required'),
  transaction_date: z.string().date('transaction_date must be YYYY-MM-DD'),
  amount: z.coerce.number(),
  vendor: z.string().max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  category: z.string().max(100).nullable().optional(),
  review_state: expenseReviewState.optional().default('Review'),
  tax_period: taxPeriod.nullable().optional(),
  documentation_status: z.enum(['CC', 'Y', 'N']).nullable().optional(),
  source_account: z.string().max(100).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
})

export const UpdateExpenseBody = z.object({
  property_id: z.string().optional(),
  transaction_date: z.string().date().optional(),
  amount: z.coerce.number().optional(),
  vendor: z.string().max(200).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  category: z.string().max(100).nullable().optional(),
  review_state: expenseReviewState.optional(),
  tax_period: taxPeriod.nullable().optional(),
  documentation_status: z.enum(['CC', 'Y', 'N']).nullable().optional(),
  source_account: z.string().max(100).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
}).refine(obj => Object.keys(obj).length > 0, {
  message: 'At least one field must be provided for update',
})

// ─── Mileage ──────────────────────────────────────────────────────────────────

export const MileageListQuery = z.object({
  workspace_id: z.string().min(1, 'workspace_id is required'),
  property_id: z.string().optional(),
  ...paginationParams,
})

export const CreateMileageBody = z.object({
  workspace_id: z.string().min(1, 'workspace_id is required'),
  property_id: z.string().min(1, 'property_id is required'),
  trip_date: z.string().date('trip_date must be YYYY-MM-DD'),
  miles: z.coerce.number().positive('miles must be a positive number'),
  origin: z.string().max(200).nullable().optional(),
  destination: z.string().max(200).nullable().optional(),
  purpose: z.string().max(500).nullable().optional(),
  deduction_rate: z.coerce.number().min(0).max(10).nullable().optional(),
  deduction_amount: z.coerce.number().nullable().optional(),
})

export const UpdateMileageBody = z.object({
  property_id: z.string().optional(),
  trip_date: z.string().date().optional(),
  miles: z.coerce.number().positive().optional(),
  origin: z.string().max(200).nullable().optional(),
  destination: z.string().max(200).nullable().optional(),
  purpose: z.string().max(500).nullable().optional(),
  deduction_rate: z.coerce.number().min(0).max(10).nullable().optional(),
  deduction_amount: z.coerce.number().nullable().optional(),
}).refine(obj => Object.keys(obj).length > 0, {
  message: 'At least one field must be provided for update',
})

// ─── Properties ───────────────────────────────────────────────────────────────

export const CreatePropertyBody = z.object({
  workspace_id: z.string().min(1, 'workspace_id is required'),
  name: z.string().min(1, 'name is required').max(200),
  code: z.string().min(1, 'code is required').max(50),
  placed_in_service_date: z.string().date().nullable().optional(),
  ownership_type: z.string().max(50).nullable().optional(),
  market: z.string().max(100).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
})

export const UpdatePropertyBody = z.object({
  name: z.string().min(1).max(200).optional(),
  code: z.string().min(1).max(50).optional(),
  placed_in_service_date: z.string().date().nullable().optional(),
  ownership_type: z.string().max(50).nullable().optional(),
  market: z.string().max(100).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
}).refine(obj => Object.keys(obj).length > 0, {
  message: 'At least one field must be provided for update',
})

// ─── Dashboard ────────────────────────────────────────────────────────────────

export const DashboardMetricsQuery = z.object({
  workspace_id: z.string().min(1, 'workspace_id is required'),
  property_id: z.string().min(1, 'property_id is required'),
  date_from: z.string().date('date_from must be YYYY-MM-DD'),
  date_to: z.string().date('date_to must be YYYY-MM-DD'),
})

export const DashboardExportQuery = z.object({
  workspace_id: z.string().min(1, 'workspace_id is required'),
  property_id: z.string().min(1, 'property_id is required'),
  date_from: z.string().date('date_from must be YYYY-MM-DD'),
  date_to: z.string().date('date_to must be YYYY-MM-DD'),
  // Optional filters for exports
  tax_period: taxPeriod.optional(),
  category: z.string().max(100).optional(),
  review_state: expenseReviewState.optional(),
  source_platform: z.string().max(50).optional(),
})

// ─── Workspaces ───────────────────────────────────────────────────────────────

export const CreateWorkspaceBody = z.object({
  name: z.string().min(1, 'name is required').max(200),
})

export const UpdateWorkspaceBody = z.object({
  name: z.string().min(1).max(200).optional(),
}).refine(obj => Object.keys(obj).length > 0, {
  message: 'At least one field must be provided for update',
})

// ─── Property Tasks ───────────────────────────────────────────────────────────

export const propertyTaskStatus = z.enum(['pending', 'in_progress', 'completed', 'expired'])
export const propertyTaskPriority = z.enum(['low', 'medium', 'high', 'urgent'])

export const PropertyTaskListQuery = z.object({
  workspace_id: z.string().min(1, 'workspace_id is required'),
  property_id: z.string().optional(),
  status: propertyTaskStatus.optional(),
  priority: propertyTaskPriority.optional(),
  ...paginationParams,
})

export const CreatePropertyTaskBody = z.object({
  workspace_id: z.string().min(1, 'workspace_id is required'),
  property_id: z.string().min(1, 'property_id is required'),
  title: z.string().min(1, 'title is required').max(500),
  description: z.string().max(5000).optional(),
  status: propertyTaskStatus.optional().default('pending'),
  priority: propertyTaskPriority.optional().default('medium'),
  due_date: z.string().date().nullable().optional(),
  auto_expire: z.boolean().optional().default(false),
  notes: z.string().max(5000).nullable().optional(),
})

export const UpdatePropertyTaskBody = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).nullable().optional(),
  status: propertyTaskStatus.optional(),
  priority: propertyTaskPriority.optional(),
  due_date: z.string().date().nullable().optional(),
  auto_expire: z.boolean().optional(),
  notes: z.string().max(5000).nullable().optional(),
}).refine(obj => Object.keys(obj).length > 0, {
  message: 'At least one field must be provided for update',
})

// ─── Shared helpers ───────────────────────────────────────────────────────────

/** Format Zod errors into a client-friendly message */
export function formatZodError(err: z.ZodError): string {
  return err.issues.map(e => `${e.path.join('.')}: ${e.message}`).join('; ')
}

/** Map Supabase/Postgres errors to safe client responses */
export function mapDbError(error: { code?: string; message?: string }): { status: number; message: string } {
  if (error.code === '23505') return { status: 409, message: 'Duplicate entry' }
  if (error.code === '23503') return { status: 422, message: 'Referenced entity not found' }
  return { status: 500, message: 'Internal server error' }
}
