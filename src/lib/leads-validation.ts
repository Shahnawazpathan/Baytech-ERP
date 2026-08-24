import { z } from 'zod'
import { LEAD_STATUSES, LEAD_PRIORITIES, NOTES_STATUSES } from './leads-constants'

/** Zod schema for creating a new lead. */
export const createLeadSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(100),
  lastName: z.string().trim().max(100).optional().nullable(),
  email: z.string().trim().email('Invalid email').optional().nullable().or(z.literal('')),
  phone: z.string().trim().min(1, 'Phone is required').max(30),
  loanAmount: z.number().nonnegative().optional().nullable(),
  status: z.enum(LEAD_STATUSES).optional().default('NEW'),
  priority: z.enum(LEAD_PRIORITIES).optional().default('MEDIUM'),
  assignedToId: z.string().optional().nullable(),
  propertyAddress: z.string().trim().max(500).optional().nullable(),
  creditScore: z.number().int().min(0).max(850).optional().nullable(),
  source: z.string().trim().max(100).optional().default('Website'),
  notes: z.string().trim().max(2000).optional().nullable(),
  // companyId intentionally excluded - bound to the verified session server-side
  notesStatus: z.enum(NOTES_STATUSES).optional().nullable(),
  followUpDate: z.string().optional().nullable(),
})

/** Zod schema for updating an existing lead (all fields optional). */
export const updateLeadSchema = z.object({
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().max(100).optional().nullable(),
  email: z.string().trim().email().optional().nullable().or(z.literal('')),
  phone: z.string().trim().min(1).max(30).optional(),
  loanAmount: z.number().nonnegative().optional().nullable(),
  status: z.enum(LEAD_STATUSES).optional(),
  priority: z.enum(LEAD_PRIORITIES).optional(),
  assignedToId: z.string().optional().nullable(),
  propertyAddress: z.string().trim().max(500).optional().nullable(),
  creditScore: z.number().int().min(0).max(850).optional().nullable(),
  source: z.string().trim().max(100).optional(),
  notes: z.string().trim().max(2000).optional().nullable(),
  notesStatus: z.enum(NOTES_STATUSES).optional().nullable(),
  followUpDate: z.string().optional().nullable(),
})

/** Zod schema for updating only the lead's status. */
export const updateStatusSchema = z.object({
  status: z.enum(LEAD_STATUSES),
})

/** Zod schema for assigning a single lead. */
export const assignLeadSchema = z.object({
  leadId: z.string().min(1),
  employeeId: z.string().min(1),
  notes: z.string().max(500).optional(),
})

/** Zod schema for bulk assignment. */
export const bulkAssignSchema = z.object({
  leadIds: z.array(z.string().min(1)).min(1, 'At least one lead is required'),
  employeeId: z.string().optional(),
  employeeIds: z.array(z.string()).optional(),
  strategy: z.enum(['round_robin', 'equal', 'least_loaded']).optional().default('round_robin'),
})

/** Zod schema for claiming a lead from the pool. */
export const claimLeadSchema = z.object({
  leadId: z.string().min(1),
  employeeId: z.string().min(1).optional(),
  force: z.boolean().optional().default(false),
})

/** Zod schema for returning a lead to the pool. */
export const returnLeadSchema = z.object({
  leadId: z.string().min(1),
  employeeId: z.string().min(1),
})

/** Zod schema for marking a lead as contacted. */
export const markContactedSchema = z.object({
  leadId: z.string().min(1),
})

/** Zod schema for bulk-deleting leads. */
export const deleteLeadsSchema = z.object({
  leadIds: z.array(z.string().min(1)).min(1, 'At least one lead is required'),
})

/** Zod schema for bulk importing leads. */
export const bulkImportSchema = z.object({
  leads: z.array(createLeadSchema).min(1, 'No leads provided'),
  autoAssign: z.boolean().optional().default(true),
  // companyId intentionally excluded - bound to the verified session server-side
})
