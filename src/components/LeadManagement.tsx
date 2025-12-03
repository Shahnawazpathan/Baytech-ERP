'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useDebounce } from '@/hooks/use-debounce';
import { 
  Search, 
  Download, 
  UserPlus,
  Upload,
  X,
  TrendingUp,
  Phone,
  DollarSign,
  Users 
} from 'lucide-react';

interface LeadManagementProps {
  user: any;
  leads: any[];
  employees: any[];
  canViewLeads: boolean;
  canCreateLeads: boolean;
  loading: boolean;
  onRefresh: () => void;
  refreshData: () => void;
  showBulkImportModal: boolean;
  setShowBulkImportModal: (show: boolean) => void;
  handleBulkImportComplete: (importedLeads: any[]) => void;
}

export function LeadManagement({
  user,
  leads,
  employees,
  canViewLeads,
  canCreateLeads,
  loading,
  refreshData,
  showBulkImportModal,
  setShowBulkImportModal,
  handleBulkImportComplete
}: LeadManagementProps) {
  const { toast } = useToast();
  const [showAddLeadModal, setShowAddLeadModal] = useState(false);
  const [editingLead, setEditingLead] = useState<any>(null);
  const [newLead, setNewLead] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    loanAmount: '',
    propertyAddress: '',
    propertyType: '',
    creditScore: '',
    source: 'Website',
    priority: 'MEDIUM',
    notes: ''
  });

  // Filter states
  const [leadFilter, setLeadFilter] = useState({
    search: '',
    status: 'ALL',
    priority: 'ALL'
  });

  // Debounced search
  const debouncedLeadSearch = useDebounce(leadFilter.search, 300);

  const itemsPerPage = 10;
  const [leadPage, setLeadPage] = useState(1);

  const leadsList = useMemo(() => {
    if (Array.isArray(leads)) return leads;
    if (leads && Array.isArray((leads as any).data)) return (leads as any).data;
    return [];
  }, [leads]);

  // Filtered data
  const filteredLeads = useMemo(() => {
    return leadsList.filter(lead => {
      const matchesSearch = (lead.name && lead.name.toLowerCase().includes(debouncedLeadSearch.toLowerCase())) ||
                           (lead.email && lead.email.toLowerCase().includes(debouncedLeadSearch.toLowerCase()))
      const matchesStatus = leadFilter.status === 'ALL' || lead.status === leadFilter.status
      const matchesPriority = leadFilter.priority === 'ALL' || lead.priority === leadFilter.priority

      // Role-based filtering
      let roleMatches = true;
      if (user?.role !== 'Administrator' && user?.role !== 'Manager') {
        // Employee can only see leads assigned to them
        roleMatches = lead.assignedToId === user?.id || !lead.assignedToId; // Can see unassigned leads too
      }

      return (debouncedLeadSearch === '' || matchesSearch) && matchesStatus && matchesPriority && roleMatches
    })
  }, [leadsList, debouncedLeadSearch, leadFilter.status, leadFilter.priority, user?.role, user?.id]);

  // Paginated data
  const paginatedLeads = useMemo(() => {
    const startIndex = (leadPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return filteredLeads.slice(startIndex, endIndex)
  }, [filteredLeads, leadPage, itemsPerPage]);

  // Total pages for pagination
  const totalLeadPages = Math.ceil(filteredLeads.length / itemsPerPage);

  // Reset pagination when filters change
  React.useEffect(() => {
    setLeadPage(1)
  }, [debouncedLeadSearch, leadFilter.status, leadFilter.priority]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'NEW': return 'bg-blue-100 text-blue-800'
      case 'QUALIFIED': return 'bg-green-100 text-green-800'
      case 'APPLICATION': return 'bg-yellow-100 text-yellow-800'
      case 'CONTACTED': return 'bg-purple-100 text-purple-800'
      case 'APPROVED': return 'bg-teal-100 text-teal-800'
      case 'REJECTED': return 'bg-red-100 text-red-800'
      case 'CLOSED': return 'bg-gray-100 text-gray-800'
      case 'JUNK': return 'bg-gray-100 text-gray-800'
      case 'REAL': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'HIGH': return 'bg-red-100 text-red-800'
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800'
      case 'LOW': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const handleExportLeads = () => {
    const csvContent = [
      ['Name', 'Email', 'Phone', 'Loan Amount', 'Status', 'Priority', 'Assigned To', 'Property Address', 'Credit Score'],
      ...filteredLeads.map(lead => [
        lead.name, lead.email, lead.phone, lead.loanAmount, lead.status, lead.priority,
        lead.assignedTo, lead.propertyAddress, lead.creditScore
      ])
    ].map(row => row.join(',')).join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `leads_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const handleEditLeadClick = async (lead: any) => {
    setEditingLead(lead);
    setNewLead({
      firstName: lead.firstName || lead.name?.split(' ')[0] || '',
      lastName: lead.lastName || lead.name?.split(' ').slice(1).join(' ') || '',
      email: lead.email,
      phone: lead.phone,
      loanAmount: lead.loanAmount?.toString() || '',
      propertyAddress: lead.propertyAddress || '',
      propertyType: lead.propertyType || '',
      creditScore: lead.creditScore?.toString() || '',
      source: lead.source || 'Website',
      priority: lead.priority || 'MEDIUM',
      notes: lead.notes || ''
    });
    setShowAddLeadModal(true);
  };

  const handleUpdateLead = async () => {
    if (editingLead && newLead.firstName && newLead.lastName && newLead.email && newLead.phone) {
      try {
        const response = await fetch(`/api/leads/${editingLead.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': user?.id,
            'x-company-id': user?.companyId
          },
          body: JSON.stringify({
            firstName: newLead.firstName,
            lastName: newLead.lastName,
            email: newLead.email,
            phone: newLead.phone,
            loanAmount: parseInt(newLead.loanAmount) || 0,
            status: editingLead.status, // Keep current status
            priority: newLead.priority,
            assignedToId: editingLead.assignedToId, // Keep current assignment
            propertyAddress: newLead.propertyAddress,
            creditScore: parseInt(newLead.creditScore) || 0,
            source: newLead.source,
            companyId: user?.companyId,
            notes: newLead.notes
          })
        })

        if (response.ok) {
          const updatedLead = await response.json()
          setEditingLead(null);
          setNewLead({
            firstName: '',
            lastName: '',
            email: '',
            phone: '',
            loanAmount: '',
            propertyAddress: '',
            propertyType: '',
            creditScore: '',
            source: 'Website',
            priority: 'MEDIUM',
            notes: ''
          });
          setShowAddLeadModal(false);

          toast({
            title: "Success",
            description: "Lead updated successfully",
          });
        } else {
          throw new Error('Failed to update lead');
        }
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to update lead",
          variant: "destructive",
        });
      }
    }
  };

  const toggleLeadStatus = async (leadId: string, currentStatus: string) => {
    try {
      // Define the next status in the pipeline
      const statusOrder = ['NEW', 'CONTACTED', 'QUALIFIED', 'APPLICATION', 'APPROVED', 'REJECTED', 'CLOSED', 'JUNK', 'REAL'];
      const currentIndex = statusOrder.indexOf(currentStatus);
      const nextIndex = (currentIndex + 1) % statusOrder.length;
      const newStatus = statusOrder[nextIndex];

      const response = await fetch(`/api/leads/${leadId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user?.id,
          'x-company-id': user?.companyId
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (response.ok) {
        await refreshData();

        toast({
          title: "Success",
          description: `Lead status updated to ${newStatus}`,
        });
      } else {
        throw new Error('Failed to update lead status');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update lead status",
        variant: "destructive",
      });
    }
  };

  const handleAddLead = async () => {
    if (newLead.firstName && newLead.lastName && newLead.email && newLead.phone) {
      try {
        const response = await fetch('/api/leads', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': user?.id,
            'x-company-id': user?.companyId
          },
          body: JSON.stringify({
            firstName: newLead.firstName,
            lastName: newLead.lastName,
            email: newLead.email,
            phone: newLead.phone,
            loanAmount: parseInt(newLead.loanAmount) || 0,
            status: "NEW",
            priority: newLead.priority,
            assignedToId: null, // Initially unassigned
            propertyAddress: newLead.propertyAddress,
            creditScore: parseInt(newLead.creditScore) || 0,
            source: newLead.source,
            companyId: user?.companyId
          })
        })

        if (response.ok) {
          const createdLead = await response.json()
          setNewLead({
            firstName: '',
            lastName: '',
            email: '',
            phone: '',
            loanAmount: '',
            propertyAddress: '',
            propertyType: '',
            creditScore: '',
            source: 'Website',
            priority: 'MEDIUM',
            notes: ''
          })
          setShowAddLeadModal(false)
          refreshData() // Refresh data

          toast({
            title: "Success",
            description: "Lead added successfully",
          })
        } else {
          throw new Error('Failed to add lead')
        }
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to add lead",
          variant: "destructive",
        })
      }
    } else {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields (First Name, Last Name, Email, Phone)",
        variant: "destructive",
      })
    }
  }

  const handleLeadInputChange = (field: string, value: string) => {
    setNewLead(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleAddLeadClick = () => {
    setShowAddLeadModal(true)
  }

  const handleBulkImportClick = () => {
    setShowBulkImportModal(true)
  }

  return (
    <div className="space-y-6">
      {/* Lead Management Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Lead Management</h2>
          <p className="text-sm text-gray-500">Track and manage mortgage leads</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleExportLeads}
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          {(user?.role === 'Administrator' || user?.role === 'Manager') && (
            <Button
              variant="outline"
              onClick={handleBulkImportClick}
            >
              <Upload className="h-4 w-4 mr-2" />
              Import
            </Button>
          )}
          {canCreateLeads && (
            <Button
              onClick={handleAddLeadClick}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Add Lead
            </Button>
          )}
        </div>
      </div>

      {/* Lead Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Leads</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{leadsList.length}</div>
            <p className="text-xs text-green-600">+{leadsList.filter(l => l.createdAt && new Date(l.createdAt) >= new Date(new Date().setDate(new Date().getDate() - 30))).length} this month</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Active Leads</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{leadsList.filter(l => !['APPLICATION', 'REJECTED', 'CLOSED', 'JUNK'].includes(l.status)).length}</div>
            <p className="text-xs text-gray-500">In pipeline</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Converted</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{leadsList.filter(l => l.status === 'APPLICATION' || l.status === 'APPROVED' || l.status === 'REAL').length}</div>
            <p className="text-xs text-green-600">{leadsList.length ? Math.round((leadsList.filter(l => l.status === 'APPLICATION' || l.status === 'APPROVED' || l.status === 'REAL').length / leadsList.length) * 100) : 0}% conversion</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">High Priority</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{leadsList.filter(l => l.priority === 'HIGH' || l.priority === 'URGENT').length}</div>
            <p className="text-xs text-red-600">Need attention</p>
          </CardContent>
        </Card>
      </div>

      {/* Lead List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Lead Pipeline</CardTitle>
              <CardDescription>Manage and track all leads</CardDescription>
            </div>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search leads..."
                  value={leadFilter.search}
                  onChange={(e) => setLeadFilter({...leadFilter, search: e.target.value})}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-md text-sm w-64"
                />
              </div>
              <Select value={leadFilter.status} onValueChange={(value) => setLeadFilter({...leadFilter, status: value})}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Status</SelectItem>
                  <SelectItem value="NEW">NEW</SelectItem>
                  <SelectItem value="CONTACTED">CONTACTED</SelectItem>
                  <SelectItem value="QUALIFIED">QUALIFIED</SelectItem>
                  <SelectItem value="APPLICATION">APPLICATION</SelectItem>
                  <SelectItem value="APPROVED">APPROVED</SelectItem>
                  <SelectItem value="REJECTED">REJECTED</SelectItem>
                  <SelectItem value="CLOSED">CLOSED</SelectItem>
                  <SelectItem value="JUNK">JUNK</SelectItem>
                  <SelectItem value="REAL">REAL</SelectItem>
                </SelectContent>
              </Select>
              <Select value={leadFilter.priority} onValueChange={(value) => setLeadFilter({...leadFilter, priority: value})}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Priority</SelectItem>
                  <SelectItem value="HIGH">HIGH</SelectItem>
                  <SelectItem value="MEDIUM">MEDIUM</SelectItem>
                  <SelectItem value="LOW">LOW</SelectItem>
                </SelectContent>
              </Select>
              {leadFilter.search || leadFilter.status !== 'ALL' || leadFilter.priority !== 'ALL' ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setLeadFilter({ search: '', status: 'ALL', priority: 'ALL' })}
                >
                  <X className="h-4 w-4 mr-2" />
                  Clear
                </Button>
              ) : null}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, index) => (
                <div key={index} className="flex items-center p-3 border-b animate-pulse">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="bg-gray-200 rounded-full h-10 w-10" />
                    <div className="space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-32" />
                      <div className="h-3 bg-gray-200 rounded w-24" />
                    </div>
                  </div>
                  <div className="h-4 bg-gray-200 rounded w-24" />
                  <div className="h-6 bg-gray-200 rounded w-16" />
                  <div className="h-6 bg-gray-200 rounded w-16 ml-2" />
                  <div className="h-6 bg-gray-200 rounded w-24 ml-2" />
                  <div className="h-8 bg-gray-200 rounded w-32 ml-2 flex gap-2" />
                </div>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3">Lead</th>
                    <th className="text-left p-3">Contact</th>
                    <th className="text-left p-3">Loan Amount</th>
                    <th className="text-left p-3">Status</th>
                    <th className="text-left p-3">Priority</th>
                    <th className="text-left p-3">Assigned To</th>
                    <th className="text-left p-3">Assigned At</th>
                    <th className="text-left p-3">Contact Required By</th>
                    <th className="text-left p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedLeads.map((lead) => {
                    // Calculate the 2-hour contact deadline if assigned
                    const contactDeadline = lead.assignedAt ? new Date(new Date(lead.assignedAt).getTime() + 2 * 60 * 60 * 1000) : null;
                    const isOverdue = contactDeadline && new Date() > contactDeadline && !lead.contactedAt;

                    return (
                      <tr key={lead.id} className={`border-b hover:bg-gray-50 transition-colors ${isOverdue ? 'bg-red-50' : ''}`}>
                        <td className="p-3">
                          <div className="flex items-center gap-3">
                            <Avatar>
                              <AvatarFallback>{(lead.name || 'U').split(' ').map(n => n[0]).join('')}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{lead.name}</p>
                              <p className="text-sm text-gray-500">{lead.phone}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-3">{lead.email}</td>
                        <td className="p-3">${lead.loanAmount?.toLocaleString() || 0}</td>
                        <td className="p-3">
                          <Badge className={getStatusColor(lead.status)}>
                            {lead.status}
                          </Badge>
                        </td>
                        <td className="p-3">
                          <Badge className={getPriorityColor(lead.priority)}>
                            {lead.priority}
                          </Badge>
                        </td>
                        <td className="p-3">
                          <span>{lead.assignedTo || 'Unassigned'}</span>
                        </td>
                        <td className="p-3">
                          {lead.assignedAt ? new Date(lead.assignedAt).toLocaleString() : '-'}
                        </td>
                        <td className="p-3">
                          {contactDeadline ? (
                            <div className={isOverdue ? 'text-red-600' : ''}>
                              {contactDeadline.toLocaleString()}
                              {isOverdue && (
                                <div className="text-xs text-red-500 mt-1">Overdue for contact</div>
                              )}
                            </div>
                          ) : '-'}
                        </td>
                        <td className="p-3">
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => toggleLeadStatus(lead.id, lead.status)}
                            >
                              Next Status
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditLeadClick(lead)}
                            >
                              Edit
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredLeads.length === 0 && (
                    <tr>
                      <td colSpan={9} className="p-3 text-center text-gray-500">
                        No leads found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
          {/* Pagination Controls */}
          {filteredLeads.length > itemsPerPage && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <div className="text-sm text-gray-500">
                Showing {((leadPage - 1) * itemsPerPage) + 1} to {Math.min(leadPage * itemsPerPage, filteredLeads.length)} of {filteredLeads.length} leads
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setLeadPage(prev => Math.max(1, prev - 1))}
                  disabled={leadPage === 1}
                >
                  Previous
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(totalLeadPages, 10) }, (_, i) => i + 1).map(page => (
                    <Button
                      key={page}
                      variant={leadPage === page ? "default" : "outline"}
                      size="sm"
                      onClick={() => setLeadPage(page)}
                      className="w-8 h-8 p-0"
                    >
                      {page}
                    </Button>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setLeadPage(prev => Math.min(totalLeadPages, prev + 1))}
                  disabled={leadPage === totalLeadPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Lead Modal */}
      {showAddLeadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">
                  {editingLead ? 'Edit Lead' : 'Add New Lead'}
                </h3>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowAddLeadModal(false);
                    setEditingLead(null);
                    setNewLead({
                      firstName: '',
                      lastName: '',
                      email: '',
                      phone: '',
                      loanAmount: '',
                      propertyAddress: '',
                      propertyType: '',
                      creditScore: '',
                      source: 'Website',
                      priority: 'MEDIUM',
                      notes: ''
                    });
                  }}
                >
                  Close
                </Button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input
                    id="firstName"
                    value={newLead.firstName}
                    onChange={(e) => handleLeadInputChange('firstName', e.target.value)}
                    placeholder="Enter first name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name *</Label>
                  <Input
                    id="lastName"
                    value={newLead.lastName}
                    onChange={(e) => handleLeadInputChange('lastName', e.target.value)}
                    placeholder="Enter last name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newLead.email}
                    onChange={(e) => handleLeadInputChange('email', e.target.value)}
                    placeholder="Enter email address"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone *</Label>
                  <Input
                    id="phone"
                    value={newLead.phone}
                    onChange={(e) => handleLeadInputChange('phone', e.target.value)}
                    placeholder="Enter phone number"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="loanAmount">Loan Amount ($)</Label>
                  <Input
                    id="loanAmount"
                    type="number"
                    value={newLead.loanAmount}
                    onChange={(e) => handleLeadInputChange('loanAmount', e.target.value)}
                    placeholder="Enter loan amount"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="creditScore">Credit Score</Label>
                  <Input
                    id="creditScore"
                    type="number"
                    value={newLead.creditScore}
                    onChange={(e) => handleLeadInputChange('creditScore', e.target.value)}
                    min="300"
                    max="850"
                    placeholder="Enter credit score"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="propertyAddress">Property Address</Label>
                  <Input
                    id="propertyAddress"
                    value={newLead.propertyAddress}
                    onChange={(e) => handleLeadInputChange('propertyAddress', e.target.value)}
                    placeholder="Enter property address"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="propertyType">Property Type</Label>
                  <Select value={newLead.propertyType} onValueChange={(value) => handleLeadInputChange('propertyType', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select property type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="single-family">Single Family</SelectItem>
                      <SelectItem value="condo">Condo</SelectItem>
                      <SelectItem value="townhouse">Townhouse</SelectItem>
                      <SelectItem value="multi-family">Multi-Family</SelectItem>
                      <SelectItem value="commercial">Commercial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="source">Lead Source</Label>
                  <Select value={newLead.source} onValueChange={(value) => handleLeadInputChange('source', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Website">Website</SelectItem>
                      <SelectItem value="Referral">Referral</SelectItem>
                      <SelectItem value="Social Media">Social Media</SelectItem>
                      <SelectItem value="Email Campaign">Email Campaign</SelectItem>
                      <SelectItem value="Phone Call">Phone Call</SelectItem>
                      <SelectItem value="Walk-in">Walk-in</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="priority">Priority</Label>
                  <Select value={newLead.priority} onValueChange={(value) => handleLeadInputChange('priority', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOW">Low</SelectItem>
                      <SelectItem value="MEDIUM">Medium</SelectItem>
                      <SelectItem value="HIGH">High</SelectItem>
                      <SelectItem value="URGENT">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="notes">Notes</Label>
                  <textarea
                    id="notes"
                    value={newLead.notes}
                    onChange={(e) => handleLeadInputChange('notes', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md resize-none"
                    rows={3}
                    placeholder="Additional notes about this lead..."
                  />
                </div>
              </div>
              
              <div className="flex justify-end gap-2 mt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAddLeadModal(false)
                    setEditingLead(null)
                    setNewLead({
                      firstName: '',
                      lastName: '',
                      email: '',
                      phone: '',
                      loanAmount: '',
                      propertyAddress: '',
                      propertyType: '',
                      creditScore: '',
                      source: 'Website',
                      priority: 'MEDIUM',
                      notes: ''
                    })
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={editingLead ? handleUpdateLead : handleAddLead} className="bg-blue-600 hover:bg-blue-700 text-white">
                  {editingLead ? 'Update Lead' : 'Add Lead'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
