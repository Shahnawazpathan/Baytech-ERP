'use client'

import { useState } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { useLeads, useCreateLead, useUpdateLead, useDeleteLead, useEmployees } from '@/hooks/use-data'
import { useAuth } from '@/hooks/use-auth'
import { usePermissions } from '@/hooks/use-permissions'
import { useToast } from '@/hooks/use-toast'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Search, Edit, Trash2, Phone, DollarSign } from 'lucide-react'
import type { Lead, LeadStatus, LeadPriority } from '@/types'

const STATUS_OPTIONS: { value: LeadStatus; label: string; color: string; badge: string }[] = [
  { value: 'NEW', label: 'New', color: 'bg-blue-500', badge: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'CONTACTED', label: 'Contacted', color: 'bg-amber-500', badge: 'bg-amber-100 text-amber-700 border-amber-200' },
  { value: 'QUALIFIED', label: 'Qualified', color: 'bg-violet-500', badge: 'bg-violet-100 text-violet-700 border-violet-200' },
  { value: 'LOAN_PROCESS', label: 'Loan Process', color: 'bg-orange-500', badge: 'bg-orange-100 text-orange-700 border-orange-200' },
  { value: 'APPLICATION', label: 'Application', color: 'bg-yellow-500', badge: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  { value: 'APPROVED', label: 'Approved', color: 'bg-emerald-600', badge: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { value: 'REAL', label: 'Real', color: 'bg-green-600', badge: 'bg-green-100 text-green-700 border-green-200' },
  { value: 'REJECTED', label: 'Rejected', color: 'bg-red-500', badge: 'bg-red-100 text-red-700 border-red-200' },
  { value: 'CLOSED', label: 'Closed', color: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { value: 'LOST', label: 'Lost', color: 'bg-red-500', badge: 'bg-red-100 text-red-700 border-red-200' },
  { value: 'JUNK', label: 'Junk', color: 'bg-gray-500', badge: 'bg-gray-100 text-gray-700 border-gray-200' },
]

const PRIORITY_OPTIONS: { value: LeadPriority; label: string; badge: string }[] = [
  { value: 'LOW', label: 'Low', badge: 'bg-gray-100 text-gray-600 border-gray-200' },
  { value: 'MEDIUM', label: 'Medium', badge: 'bg-sky-100 text-sky-700 border-sky-200' },
  { value: 'HIGH', label: 'High', badge: 'bg-orange-100 text-orange-700 border-orange-200' },
  { value: 'URGENT', label: 'Urgent', badge: 'bg-red-100 text-red-700 border-red-200' },
]

type LeadWithApiShape = Lead & {
  name?: string
  propertyAddress?: string | null
  assignedTo?: Lead['assignedTo'] | string
}

export default function LeadsPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingLead, setEditingLead] = useState<LeadWithApiShape | null>(null)
  const { toast } = useToast()
  const { user } = useAuth()
  const { canCreateLeads, canUpdateLeads, canDeleteLeads } = usePermissions()

  const { data: leadsData, isLoading } = useLeads({
    status: statusFilter === 'ALL' ? undefined : statusFilter,
    priority: priorityFilter === 'ALL' ? undefined : priorityFilter,
    search: search || undefined,
    limit: 1000,
  })
  const { data: employeesData } = useEmployees({ limit: 1000 })

  const createLead = useCreateLead()
  const updateLead = useUpdateLead()
  const deleteLead = useDeleteLead()

  const leads = (leadsData?.data || []) as LeadWithApiShape[]
  const employees = employeesData?.data || []

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    loanAmount: '',
    propertyAddress: '',
    propertyType: '',
    creditScore: '',
    source: 'Website',
    status: 'NEW' as LeadStatus,
    priority: 'MEDIUM' as LeadPriority,
    assignedToId: '',
    notes: '',
  })

  const resetForm = () => {
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      loanAmount: '',
      propertyAddress: '',
      propertyType: '',
      creditScore: '',
      source: 'Website',
      status: 'NEW',
      priority: 'MEDIUM',
      assignedToId: '',
      notes: '',
    })
    setEditingLead(null)
  }

  const getLeadName = (lead: LeadWithApiShape) =>
    lead.name || `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || 'Unknown'

  const getAssignedToName = (assignedTo: LeadWithApiShape['assignedTo']) => {
    if (!assignedTo) return ''
    if (typeof assignedTo === 'string') return assignedTo === 'Unassigned' ? '' : assignedTo
    return `${assignedTo.firstName || ''} ${assignedTo.lastName || ''}`.trim()
  }

  const getStatusBadge = (status: LeadStatus) =>
    STATUS_OPTIONS.find(s => s.value === status)?.badge || 'bg-gray-100 text-gray-600 border-gray-200'

  const getPriorityBadge = (priority: LeadPriority) =>
    PRIORITY_OPTIONS.find(p => p.value === priority)?.badge || 'bg-gray-100 text-gray-600 border-gray-200'

  const statusCounts = STATUS_OPTIONS.map(status => ({
    ...status,
    count: leads.filter(lead => lead.status === status.value).length,
  }))

  const handleQuickStatusChange = async (leadId: string, newStatus: LeadStatus) => {
    try {
      await updateLead.mutateAsync({ id: leadId, lead: { status: newStatus } })
      toast({ title: 'Status updated' })
    } catch {
      toast({ title: 'Error', description: 'Failed to update status', variant: 'destructive' })
    }
  }

  const handleSubmit = async () => {
    try {
      const payload = {
        ...formData,
        loanAmount: formData.loanAmount ? parseFloat(formData.loanAmount) : undefined,
        creditScore: formData.creditScore ? parseInt(formData.creditScore) : undefined,
        assignedToId:
          formData.assignedToId ||
          (user && user.role !== 'Administrator' && user.role !== 'Manager' ? user.id : undefined),
      }

      if (editingLead) {
        await updateLead.mutateAsync({ id: editingLead.id, lead: payload })
        toast({ title: 'Lead updated' })
      } else {
        await createLead.mutateAsync(payload)
        toast({ title: 'Lead created' })
      }

      setIsModalOpen(false)
      resetForm()
    } catch {
      toast({ title: 'Error', description: 'Failed to save lead', variant: 'destructive' })
    }
  }

  const handleEdit = (lead: LeadWithApiShape) => {
    setEditingLead(lead)
    setFormData({
      firstName: lead.firstName || '',
      lastName: lead.lastName || '',
      email: lead.email || '',
      phone: lead.phone || '',
      loanAmount: lead.loanAmount?.toString() || '',
      propertyAddress: lead.address || lead.propertyAddress || '',
      propertyType: lead.propertyType || '',
      creditScore: lead.creditScore?.toString() || '',
      source: lead.source || 'Website',
      status: lead.status,
      priority: lead.priority,
      assignedToId: lead.assignedToId || '',
      notes: lead.notes || '',
    })
    setIsModalOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this lead?')) return
    try {
      await deleteLead.mutateAsync(id)
      toast({ title: 'Lead deleted' })
    } catch {
      toast({ title: 'Error', description: 'Failed to delete lead', variant: 'destructive' })
    }
  }

  return (
    <DashboardLayout>
      <div className="flex min-h-full flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Leads</h1>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
              {leadsData?.pagination?.total ?? leads.length} total leads
            </p>
          </div>
          {canCreateLeads && (
            <Button className="bg-blue-600 hover:bg-blue-700 shadow-sm" onClick={() => { resetForm(); setIsModalOpen(true) }}>
              <Plus className="mr-2 h-4 w-4" />
              Add Lead
            </Button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {statusCounts.map(status => (
            <button
              key={status.value}
              onClick={() => setStatusFilter(statusFilter === status.value ? 'ALL' : status.value)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                statusFilter === status.value
                  ? `${status.badge} shadow-sm`
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300'
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${status.color}`} />
              {status.label}
              <span className="ml-0.5 font-bold">{status.count}</span>
            </button>
          ))}
        </div>

        <Card className="shadow-sm">
          <CardContent className="p-3">
            <div className="flex flex-wrap gap-2">
              <div className="relative min-w-[220px] flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Search by name, phone, email..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="h-9 bg-gray-50 pl-9 dark:bg-gray-800"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 w-[150px] bg-gray-50 dark:bg-gray-800">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Status</SelectItem>
                  {STATUS_OPTIONS.map(status => (
                    <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="h-9 w-[150px] bg-gray-50 dark:bg-gray-800">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Priority</SelectItem>
                  {PRIORITY_OPTIONS.map(priority => (
                    <SelectItem key={priority.value} value={priority.value}>{priority.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <div className="overflow-x-auto rounded-xl border bg-white shadow-sm dark:bg-gray-800">
          {isLoading ? (
            <div className="flex min-h-[360px] items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
            </div>
          ) : leads.length === 0 ? (
            <div className="flex min-h-[360px] flex-col items-center justify-center gap-3 text-gray-400">
              <Phone className="h-12 w-12 text-gray-200 dark:text-gray-600" />
              <p className="font-medium text-gray-500">No leads found</p>
              <p className="text-sm">Adjust filters or add a new lead</p>
            </div>
          ) : (
            <div className="custom-scrollbar">
              <table className="w-full min-w-[980px] border-collapse text-sm">
                <thead>
                  <tr className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900">
                    <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">#</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Name</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Contact</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Loan Amount</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Status</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Priority</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Assigned To</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Source</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-300">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead, index) => {
                    const assignee = getAssignedToName(lead.assignedTo)
                    return (
                      <tr
                        key={lead.id}
                        className={`group border-b border-gray-100 transition-colors hover:bg-blue-50/50 dark:border-gray-700 dark:hover:bg-blue-900/10 ${
                          index % 2 === 1 ? 'bg-gray-50/40 dark:bg-gray-900/20' : ''
                        }`}
                      >
                        <td className="px-4 py-3 text-xs text-gray-400">{index + 1}</td>
                        <td className="px-4 py-3">
                          <p className="whitespace-nowrap font-semibold text-gray-900 dark:text-white">{getLeadName(lead)}</p>
                          <p className="mt-0.5 text-xs text-gray-400">{lead.leadNumber}</p>
                        </td>
                        <td className="px-4 py-3">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                              <Phone className="h-3 w-3 flex-shrink-0 text-gray-400" />
                              <span className="whitespace-nowrap text-xs">{lead.phone}</span>
                            </div>
                            {lead.email && <p className="max-w-[160px] truncate text-xs text-gray-400">{lead.email}</p>}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {lead.loanAmount ? (
                            <div className="flex items-center gap-1 whitespace-nowrap font-semibold text-gray-800 dark:text-gray-100">
                              <DollarSign className="h-3 w-3 text-gray-400" />
                              {lead.loanAmount.toLocaleString()}
                            </div>
                          ) : (
                            <span className="text-gray-300 dark:text-gray-600">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Select value={lead.status} onValueChange={(value) => handleQuickStatusChange(lead.id, value as LeadStatus)}>
                            <SelectTrigger className={`h-7 w-[130px] rounded-full border px-2 text-xs font-medium ${getStatusBadge(lead.status)}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {STATUS_OPTIONS.map(status => (
                                <SelectItem key={status.value} value={status.value} className="text-xs">{status.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium ${getPriorityBadge(lead.priority)}`}>
                            {lead.priority}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {assignee ? (
                            <div className="flex items-center gap-2">
                              <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 text-[10px] font-bold text-white">
                                {assignee.charAt(0).toUpperCase()}
                              </div>
                              <span className="max-w-[120px] truncate text-xs text-gray-700 dark:text-gray-200">{assignee}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">{lead.source}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                            {canUpdateLeads && (
                              <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-blue-100 dark:hover:bg-blue-900/30" onClick={() => handleEdit(lead)}>
                                <Edit className="h-3.5 w-3.5 text-blue-600" />
                              </Button>
                            )}
                            {canDeleteLeads && (
                              <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-red-100 dark:hover:bg-red-900/30" onClick={() => handleDelete(lead.id)}>
                                <Trash2 className="h-3.5 w-3.5 text-red-500" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingLead ? 'Edit Lead' : 'Add New Lead'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium">First Name *</label>
                <Input value={formData.firstName} onChange={(event) => setFormData({ ...formData, firstName: event.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Last Name</label>
                <Input value={formData.lastName} onChange={(event) => setFormData({ ...formData, lastName: event.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Email</label>
                <Input type="email" value={formData.email} onChange={(event) => setFormData({ ...formData, email: event.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Phone *</label>
                <Input value={formData.phone} onChange={(event) => setFormData({ ...formData, phone: event.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Loan Amount</label>
                <Input type="number" value={formData.loanAmount} onChange={(event) => setFormData({ ...formData, loanAmount: event.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Credit Score</label>
                <Input type="number" value={formData.creditScore} onChange={(event) => setFormData({ ...formData, creditScore: event.target.value })} />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Property Address</label>
              <Input value={formData.propertyAddress} onChange={(event) => setFormData({ ...formData, propertyAddress: event.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Status</label>
                <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value as LeadStatus })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(status => <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Priority</label>
                <Select value={formData.priority} onValueChange={(value) => setFormData({ ...formData, priority: value as LeadPriority })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map(priority => <SelectItem key={priority.value} value={priority.value}>{priority.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {(user?.role === 'Administrator' || user?.role === 'Manager') && (
              <div>
                <label className="mb-1 block text-sm font-medium">Assign To</label>
                <Select value={formData.assignedToId} onValueChange={(value) => setFormData({ ...formData, assignedToId: value })}>
                  <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                  <SelectContent>
                    {employees.map(employee => (
                      <SelectItem key={employee.id} value={employee.id}>{employee.firstName} {employee.lastName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <label className="mb-1 block text-sm font-medium">Source</label>
              <Input value={formData.source} onChange={(event) => setFormData({ ...formData, source: event.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Notes</label>
              <Input value={formData.notes} onChange={(event) => setFormData({ ...formData, notes: event.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleSubmit} disabled={createLead.isPending || updateLead.isPending}>
              {createLead.isPending || updateLead.isPending ? 'Saving...' : 'Save Lead'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
