import type {
  LeadStatus,
  LeadPriority,
  NotesStatus,
} from './leads-constants'

/** Minimal embedded employee shape (for assignedTo). */
export interface LeadEmployee {
  id: string
  firstName: string
  lastName?: string | null
  email?: string | null
}

/** Lead object as exposed by the API to the client. */
export interface Lead {
  id: string
  leadNumber: string
  name: string
  firstName: string
  lastName: string
  email: string | null
  phone: string
  loanAmount: number | null
  status: LeadStatus
  priority: LeadPriority
  source: string | null
  creditScore: number | null
  propertyAddress: string | null
  notes: string | null
  notesStatus: NotesStatus | null
  followUpDate: string | null
  assignedTo: string           // human-friendly name, e.g. "Jane Doe" or "Unassigned"
  assignedToId: string | null
  assignedAt: string | null
  contactedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface LeadPoolItem extends Lead {
  canBeTaken: boolean
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    total: number
    page: number
    limit: number
    pages: number
    totalPages?: number
    hasMore?: boolean
  }
}

export interface LeadFilters {
  search?: string
  status?: LeadStatus | 'ALL'
  priority?: LeadPriority | 'ALL'
  assignedTo?: string | 'ALL' | 'unassigned' | 'mine'
  page?: number
  limit?: number
}

export interface CreateLeadInput {
  firstName: string
  lastName?: string
  email?: string
  phone: string
  loanAmount?: number
  status?: LeadStatus
  priority?: LeadPriority
  assignedToId?: string | null
  propertyAddress?: string
  creditScore?: number
  source?: string
  notes?: string
  companyId: string
}

export interface UpdateLeadInput {
  firstName?: string
  lastName?: string | null
  email?: string | null
  phone?: string
  loanAmount?: number | null
  status?: LeadStatus
  priority?: LeadPriority
  assignedToId?: string | null
  propertyAddress?: string | null
  creditScore?: number | null
  source?: string
  notes?: string | null
  notesStatus?: NotesStatus | null
  followUpDate?: string | null
}

export interface ClaimLeadInput {
  leadId: string
  employeeId: string
  force?: boolean
}

export interface BulkAssignInput {
  leadIds: string[]
  employeeIds?: string[]
  employeeId?: string
  strategy?: 'round_robin' | 'equal' | 'least_loaded'
}
