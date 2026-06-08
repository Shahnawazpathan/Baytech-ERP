'use client'

import {
  useMutation,
  useQuery,
  useQueryClient,
  keepPreviousData,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query'
import type {
  Lead,
  LeadPoolItem,
  LeadFilters,
  PaginatedResponse,
  CreateLeadInput,
  UpdateLeadInput,
  ClaimLeadInput,
  BulkAssignInput,
} from '@/lib/lead-types'
import { DEFAULT_LEADS_PAGE_SIZE, DEFAULT_POOL_PAGE_SIZE } from '@/lib/leads-constants'

/** Headers to forward user identity on every fetch. */
function authHeaders(userId: string | undefined, companyId: string | undefined): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'x-user-id': userId || '',
    'x-company-id': companyId || '',
  }
}

/** Generic fetcher with structured error handling. */
async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  const text = await res.text()
  let body: any = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = { error: text }
  }
  if (!res.ok) {
    const message = body?.error || body?.message || res.statusText || 'Request failed'
    const error: any = new Error(message)
    error.status = res.status
    error.body = body
    throw error
  }
  return body as T
}

// ============== QUERY KEYS ==============
export const leadsKeys = {
  all: ['leads'] as const,
  list: (companyId: string | undefined, filters: LeadFilters) =>
    [...leadsKeys.all, 'list', companyId, filters] as const,
  detail: (id: string) => [...leadsKeys.all, 'detail', id] as const,
  pool: (companyId: string | undefined, filter: string) =>
    [...leadsKeys.all, 'pool', companyId, filter] as const,
}

/** Invalidate every lead query — call after any write. */
function invalidateAllLeads(qc: ReturnType<typeof useQueryClient>, companyId?: string) {
  qc.invalidateQueries({ queryKey: leadsKeys.all })
  if (companyId) {
    qc.invalidateQueries({ queryKey: ['leads', 'list', companyId] })
    qc.invalidateQueries({ queryKey: ['leads', 'pool', companyId] })
  }
}

// ============== QUERIES ==============

/**
 * Fetch a paginated, filtered list of leads.
 */
export function useLeads(
  userId: string | undefined,
  companyId: string | undefined,
  filters: LeadFilters = {},
  options: { enabled?: boolean } = {}
): UseQueryResult<PaginatedResponse<Lead>, Error> {
  const params = new URLSearchParams()
  params.set('page', String(filters.page ?? 1))
  params.set('limit', String(filters.limit ?? DEFAULT_LEADS_PAGE_SIZE))
  if (filters.search) params.set('search', filters.search)
  if (filters.status && filters.status !== 'ALL') params.set('status', filters.status)
  if (filters.priority && filters.priority !== 'ALL') params.set('priority', filters.priority)
  if (filters.assignedTo && filters.assignedTo !== 'ALL') params.set('assignedTo', filters.assignedTo)

  return useQuery({
    queryKey: leadsKeys.list(companyId, filters),
    queryFn: () =>
      jsonFetch<PaginatedResponse<Lead>>(`/api/leads?${params.toString()}`, {
        headers: authHeaders(userId, companyId),
      }),
    enabled: options.enabled ?? !!companyId,
    placeholderData: keepPreviousData,
    staleTime: 10_000,
  })
}

/**
 * Fetch a single lead by id.
 */
export function useLead(
  userId: string | undefined,
  companyId: string | undefined,
  leadId: string | undefined
): UseQueryResult<Lead, Error> {
  return useQuery({
    queryKey: leadId ? leadsKeys.detail(leadId) : ['leads', 'detail', 'none'],
    queryFn: () =>
      jsonFetch<Lead>(`/api/leads/${leadId}`, {
        headers: authHeaders(userId, companyId),
      }),
    enabled: !!leadId && !!companyId,
  })
}

/**
 * Fetch the leads pool.
 */
export function useLeadsPool(
  userId: string | undefined,
  companyId: string | undefined,
  filter: 'all' | 'unassigned' | 'available' | 'reassigned' = 'available',
  page: number = 1,
  limit: number = DEFAULT_POOL_PAGE_SIZE
): UseQueryResult<PaginatedResponse<LeadPoolItem>, Error> {
  const params = new URLSearchParams()
  params.set('filter', filter)
  params.set('page', String(page))
  params.set('limit', String(limit))

  return useQuery({
    queryKey: leadsKeys.pool(companyId, filter),
    queryFn: () =>
      jsonFetch<PaginatedResponse<LeadPoolItem>>(`/api/leads/pool?${params.toString()}`, {
        headers: authHeaders(userId, companyId),
      }),
    enabled: !!companyId,
    placeholderData: keepPreviousData,
    staleTime: 10_000,
  })
}

// ============== MUTATIONS ==============

/** Create a lead. */
export function useCreateLead(
  userId: string | undefined,
  companyId: string | undefined
): UseMutationResult<Lead, Error, CreateLeadInput> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input) =>
      jsonFetch<Lead>('/api/leads', {
        method: 'POST',
        headers: authHeaders(userId, companyId),
        body: JSON.stringify(input),
      }),
    onSuccess: () => invalidateAllLeads(qc, companyId),
  })
}

/** Update an existing lead. */
export function useUpdateLead(
  userId: string | undefined,
  companyId: string | undefined
): UseMutationResult<Lead, Error, { id: string; data: UpdateLeadInput }> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }) =>
      jsonFetch<Lead>(`/api/leads/${id}`, {
        method: 'PUT',
        headers: authHeaders(userId, companyId),
        body: JSON.stringify(data),
      }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: leadsKeys.detail(vars.id) })
      invalidateAllLeads(qc, companyId)
    },
  })
}

/** Update only the lead status. */
export function useUpdateLeadStatus(
  userId: string | undefined,
  companyId: string | undefined
): UseMutationResult<Lead, Error, { id: string; status: Lead['status'] }> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }) =>
      jsonFetch<Lead>(`/api/leads/${id}/status`, {
        method: 'PATCH',
        headers: authHeaders(userId, companyId),
        body: JSON.stringify({ status }),
      }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: leadsKeys.detail(vars.id) })
      invalidateAllLeads(qc, companyId)
    },
  })
}

/** Soft-delete one or more leads. */
export function useDeleteLeads(
  userId: string | undefined,
  companyId: string | undefined
): UseMutationResult<{ success: boolean; deleted: number }, Error, { leadIds: string[] }> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ leadIds }) =>
      jsonFetch<{ success: boolean; deleted: number }>('/api/leads', {
        method: 'DELETE',
        headers: authHeaders(userId, companyId),
        body: JSON.stringify({ leadIds }),
      }),
    onSuccess: () => invalidateAllLeads(qc, companyId),
  })
}

/** Assign a single lead to an employee. */
export function useAssignLead(
  userId: string | undefined,
  companyId: string | undefined
): UseMutationResult<
  { success: boolean; data: any },
  Error,
  { leadId: string; employeeId: string; notes?: string }
> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ leadId, employeeId, notes }) =>
      jsonFetch<{ success: boolean; data: any }>('/api/leads/assign', {
        method: 'POST',
        headers: authHeaders(userId, companyId),
        body: JSON.stringify({ leadId, employeeId, notes }),
      }),
    onSuccess: () => invalidateAllLeads(qc, companyId),
  })
}

/** Bulk-assign leads (one or many employees, with strategy). */
export function useBulkAssignLeads(
  userId: string | undefined,
  companyId: string | undefined
): UseMutationResult<{ success: boolean; data: any }, Error, BulkAssignInput> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input) =>
      jsonFetch<{ success: boolean; data: any }>('/api/leads/assign', {
        method: 'PUT',
        headers: authHeaders(userId, companyId),
        body: JSON.stringify(input),
      }),
    onSuccess: () => invalidateAllLeads(qc, companyId),
  })
}

/** Claim a lead from the pool. */
export function useClaimLead(
  userId: string | undefined,
  companyId: string | undefined
): UseMutationResult<{ success: boolean; data: any }, Error, ClaimLeadInput> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input) =>
      jsonFetch<{ success: boolean; data: any }>('/api/leads/pool', {
        method: 'POST',
        headers: authHeaders(userId, companyId),
        body: JSON.stringify(input),
      }),
    onSuccess: () => invalidateAllLeads(qc, companyId),
  })
}

/** Return a lead back to the pool. */
export function useReturnLeadToPool(
  userId: string | undefined,
  companyId: string | undefined
): UseMutationResult<{ success: boolean; data: any }, Error, { leadId: string; employeeId: string }> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ leadId, employeeId }) => {
      const params = new URLSearchParams({ leadId, employeeId })
      return jsonFetch<{ success: boolean; data: any }>(`/api/leads/pool?${params.toString()}`, {
        method: 'DELETE',
        headers: authHeaders(userId, companyId),
      })
    },
    onSuccess: () => invalidateAllLeads(qc, companyId),
  })
}

/** Mark a lead as contacted. */
export function useMarkContacted(
  userId: string | undefined,
  companyId: string | undefined
): UseMutationResult<{ success: boolean; data: any }, Error, { leadId: string }> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ leadId }) =>
      jsonFetch<{ success: boolean; data: any }>('/api/leads/mark-contacted', {
        method: 'POST',
        headers: authHeaders(userId, companyId),
        body: JSON.stringify({ leadId }),
      }),
    onSuccess: () => invalidateAllLeads(qc, companyId),
  })
}

/** Bulk import leads (from CSV / form). */
export function useBulkImportLeads(
  userId: string | undefined,
  companyId: string | undefined
): UseMutationResult<
  { success: boolean; imported: number; leads: Lead[]; assignedToEmployees?: number },
  Error,
  { leads: any[]; autoAssign?: boolean; companyId: string }
> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input) =>
      jsonFetch<{ success: boolean; imported: number; leads: Lead[]; assignedToEmployees?: number }>(
        '/api/leads',
        {
          method: 'PUT',
          headers: authHeaders(userId, companyId),
          body: JSON.stringify(input),
        }
      ),
    onSuccess: () => invalidateAllLeads(qc, companyId),
  })
}
