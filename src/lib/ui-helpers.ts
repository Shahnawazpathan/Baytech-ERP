import { LEAD_STATUSES, STATUS_COLORS, PRIORITY_COLORS } from './leads-constants'

/** Tailwind badge classes for lead/task/attendance statuses. Single source of truth. */
export function getStatusColor(status: string): string {
  const key = status?.toUpperCase()
  switch (key) {
    case 'NEW':
      return 'bg-blue-100 text-blue-800'
    case 'QUALIFIED':
      return 'bg-green-100 text-green-800'
    case 'APPLICATION':
      return 'bg-yellow-100 text-yellow-800'
    case 'CONTACTED':
      return 'bg-purple-100 text-purple-800'
    case 'PRESENT':
      return 'bg-green-100 text-green-800'
    case 'LATE':
      return 'bg-yellow-100 text-yellow-800'
    case 'ABSENT':
      return 'bg-red-100 text-red-800'
    case 'ACTIVE':
      return 'bg-green-100 text-green-800'
    case 'ON_LEAVE':
      return 'bg-yellow-100 text-yellow-800'
    case 'JUNK':
      return 'bg-red-100 text-red-800'
    case 'REAL':
      return 'bg-green-100 text-green-800'
    case 'APPROVED':
      return 'bg-emerald-100 text-emerald-800'
    case 'REJECTED':
      return 'bg-red-100 text-red-800'
    case 'CLOSED':
      return 'bg-gray-100 text-gray-700'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

/** Tailwind badge classes for priorities - includes URGENT which some copies missed. */
export function getPriorityColor(priority: string): string {
  switch (priority?.toUpperCase()) {
    case 'URGENT':
      return 'bg-red-100 text-red-900 ring-1 ring-red-300'
    case 'HIGH':
      return 'bg-orange-100 text-orange-800'
    case 'MEDIUM':
      return 'bg-yellow-100 text-yellow-800'
    case 'LOW':
      return 'bg-green-100 text-green-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

/** Pipeline order used by "advance status" actions. */
export const LEAD_STATUS_ORDER = [
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

/** Safely parse a JSON string field, returning the fallback on any error. */
export function safeJsonParse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}
