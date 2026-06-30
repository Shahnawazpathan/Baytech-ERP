/**
 * Centralized constants for the leads module.
 * Eliminates magic numbers/strings scattered across the codebase.
 */

// ============== BUSINESS RULES ==============
/** Hours an assigned lead can sit uncontacted before being eligible for pool reclamation. */
export const LEAD_RECLAIM_HOURS = 8

/** Maximum leads returned by the shared pool endpoint. Keeps the real-time queue responsive. */
export const MAX_POOL_PAGE_SIZE = 100

/** Default pagination size for the leads table. */
export const DEFAULT_LEADS_PAGE_SIZE = 10

/** Default pagination size for the leads pool. */
export const DEFAULT_POOL_PAGE_SIZE = 50

/** Debounce delay (ms) for the lead search input. */
export const LEAD_SEARCH_DEBOUNCE_MS = 300

/** TTL (ms) for the leads server-side cache. */
export const LEADS_CACHE_TTL_MS = 30_000

/** Maximum allowed CSV file size (10 MB). */
export const MAX_IMPORT_FILE_SIZE = 10 * 1024 * 1024

// ============== ENUMS ==============
export const LEAD_STATUSES = [
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'APPLICATION',
  'APPROVED',
  'REJECTED',
  'CLOSED',
  'JUNK',
  'REAL',
] as const
export type LeadStatus = typeof LEAD_STATUSES[number]

export const LEAD_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const
export type LeadPriority = typeof LEAD_PRIORITIES[number]

/** Business priority order for queueing. Higher value should be shown first. */
export const LEAD_PRIORITY_WEIGHT: Record<LeadPriority, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  URGENT: 4,
}

export const NOTES_STATUSES = ['RING', 'NOT_CONTACTABLE', 'FOLLOW_UP'] as const
export type NotesStatus = typeof NOTES_STATUSES[number]

/** Statuses considered "active" (not terminal / not in pipeline-as-finished). */
export const ACTIVE_LEAD_STATUSES: LeadStatus[] = ['NEW', 'CONTACTED', 'QUALIFIED']

/** Statuses considered "converted" (APPLICATION, APPROVED, REAL). */
export const CONVERTED_LEAD_STATUSES: LeadStatus[] = ['APPLICATION', 'APPROVED', 'REAL']

/** Statuses that are terminal and should never return to the leads pool. */
export const TERMINAL_LEAD_STATUSES: LeadStatus[] = ['APPROVED', 'REJECTED', 'CLOSED', 'JUNK', 'REAL']

// ============== CACHE KEYS ==============
export const CACHE_RESOURCE = {
  LEADS: 'leads',
  POOL: 'pool',
  EMPLOYEES: 'employees',
  NOTIFICATIONS: 'notifications',
  REPORTS: 'reports',
} as const

// ============== STATUS COLORS ==============
export const STATUS_COLORS: Record<LeadStatus, string> = {
  NEW: 'bg-blue-100 text-blue-800',
  CONTACTED: 'bg-purple-100 text-purple-800',
  QUALIFIED: 'bg-green-100 text-green-800',
  APPLICATION: 'bg-yellow-100 text-yellow-800',
  APPROVED: 'bg-teal-100 text-teal-800',
  REJECTED: 'bg-red-100 text-red-800',
  CLOSED: 'bg-gray-100 text-gray-800',
  JUNK: 'bg-gray-100 text-gray-800',
  REAL: 'bg-green-100 text-green-800',
}

export const PRIORITY_COLORS: Record<LeadPriority, string> = {
  URGENT: 'bg-red-100 text-red-800 border-red-300',
  HIGH: 'bg-orange-100 text-orange-800 border-orange-300',
  MEDIUM: 'bg-blue-100 text-blue-800 border-blue-300',
  LOW: 'bg-green-100 text-green-800 border-green-300',
}
