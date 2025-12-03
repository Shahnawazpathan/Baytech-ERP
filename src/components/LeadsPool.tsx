"use client"

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useToast } from '@/hooks/use-toast'
import {
  Users,
  Search,
  Filter,
  TrendingUp,
  Phone,
  Mail,
  DollarSign,
  Calendar,
  AlertCircle,
  CheckCircle,
  Clock,
  RefreshCw,
  UserPlus,
  ArrowRight
} from 'lucide-react'

interface LeadsPoolProps {
  user: any
  onLeadClaimed?: () => void
}

export function LeadsPool({ user, onLeadClaimed }: LeadsPoolProps) {
  const { toast } = useToast()
  const [leads, setLeads] = useState<any[]>([])
  const [filteredLeads, setFilteredLeads] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('available') // all, unassigned, available
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [selectedLead, setSelectedLead] = useState<any>(null)
  const [showClaimDialog, setShowClaimDialog] = useState(false)
  const [claiming, setClaiming] = useState(false)

  const normalizeLeads = (data: any): any[] => {
    if (Array.isArray(data)) return data
    if (data && Array.isArray(data.data)) return data.data
    return []
  }

  // Fetch leads pool
  const fetchLeadsPool = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/leads/pool?filter=${filterType}`, {
        headers: {
          'x-user-id': user?.id || '',
          'x-company-id': user?.companyId || 'default-company'
        }
      })

      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          const parsed = normalizeLeads(result.data)
          setLeads(parsed)
          setFilteredLeads(parsed)
        }
      }
    } catch (error) {
      console.error('Error fetching leads pool:', error)
      toast({
        title: "Error",
        description: "Failed to fetch leads pool",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  // Filter leads based on search and filters
  useEffect(() => {
    let filtered = [...normalizeLeads(leads)]

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(lead =>
        lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.phone?.includes(searchTerm) ||
        lead.leadNumber?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Priority filter
    if (priorityFilter !== 'all') {
      filtered = filtered.filter(lead => lead.priority === priorityFilter)
    }

    setFilteredLeads(filtered)
  }, [searchTerm, priorityFilter, leads])

  // Fetch on mount and when filter changes
  useEffect(() => {
    fetchLeadsPool()
  }, [filterType])

  // Handle claim lead
  const handleClaimLead = async () => {
    if (!selectedLead) return

    try {
      setClaiming(true)
      const response = await fetch('/api/leads/pool', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user?.id || '',
          'x-company-id': user?.companyId || 'default-company'
        },
        body: JSON.stringify({
          leadId: selectedLead.id,
          employeeId: user?.id,
          force: false
        })
      })

      const result = await response.json()

      if (response.ok && result.success) {
        toast({
          title: "Lead Claimed Successfully",
          description: `You have claimed ${selectedLead.name}`,
        })
        setShowClaimDialog(false)
        setSelectedLead(null)
        fetchLeadsPool()
        if (onLeadClaimed) onLeadClaimed()
      } else {
        toast({
          title: "Failed to Claim Lead",
          description: result.error || "An error occurred",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error('Error claiming lead:', error)
      toast({
        title: "Error",
        description: "Failed to claim lead",
        variant: "destructive"
      })
    } finally {
      setClaiming(false)
    }
  }

  // Priority colors
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'URGENT':
        return 'bg-red-100 text-red-800 border-red-300'
      case 'HIGH':
        return 'bg-orange-100 text-orange-800 border-orange-300'
      case 'MEDIUM':
        return 'bg-blue-100 text-blue-800 border-blue-300'
      case 'LOW':
        return 'bg-green-100 text-green-800 border-green-300'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }

  // Status colors
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'NEW':
        return 'bg-blue-100 text-blue-800'
      case 'CONTACTED':
        return 'bg-purple-100 text-purple-800'
      case 'QUALIFIED':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Leads Pool</h2>
          <p className="text-sm text-gray-500">
            Claim available leads from the shared pool
          </p>
        </div>
        <Button onClick={fetchLeadsPool} variant="outline" disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Available</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{normalizeLeads(leads).length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Unassigned</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {normalizeLeads(leads).filter(l => !l.assignedToId).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>High Priority</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {normalizeLeads(leads).filter(l => l.priority === 'HIGH' || l.priority === 'URGENT').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search leads..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Type Filter */}
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Leads</SelectItem>
                <SelectItem value="unassigned">Unassigned Only</SelectItem>
                <SelectItem value="available">Available to Claim</SelectItem>
              </SelectContent>
            </Select>

            {/* Priority Filter */}
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="URGENT">Urgent</SelectItem>
                <SelectItem value="HIGH">High</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="LOW">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Leads List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Available Leads ({filteredLeads.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
              <p className="mt-2 text-gray-500">Loading leads...</p>
            </div>
          ) : filteredLeads.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">No leads available in the pool</p>
            </div>
          ) : (
            <ScrollArea className="h-[600px] pr-4">
              <div className="space-y-4">
                {filteredLeads.map((lead) => (
                  <Card key={lead.id} className="border-2 hover:border-blue-300 transition-colors">
                    <CardContent className="p-4">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        {/* Lead Info */}
                        <div className="flex-1 space-y-2">
                          <div className="flex items-start justify-between">
                            <div>
                              <h3 className="font-semibold text-lg text-gray-900">
                                {lead.name}
                              </h3>
                              <p className="text-sm text-gray-500">#{lead.leadNumber}</p>
                            </div>
                            <div className="flex gap-2">
                              <Badge className={getPriorityColor(lead.priority)}>
                                {lead.priority}
                              </Badge>
                              <Badge className={getStatusColor(lead.status)}>
                                {lead.status}
                              </Badge>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                            {lead.email && (
                              <div className="flex items-center gap-2 text-gray-600">
                                <Mail className="h-4 w-4" />
                                <span className="truncate">{lead.email}</span>
                              </div>
                            )}
                            {lead.phone && (
                              <div className="flex items-center gap-2 text-gray-600">
                                <Phone className="h-4 w-4" />
                                <span>{lead.phone}</span>
                              </div>
                            )}
                            {lead.loanAmount && (
                              <div className="flex items-center gap-2 text-gray-600">
                                <DollarSign className="h-4 w-4" />
                                <span>${lead.loanAmount.toLocaleString()}</span>
                              </div>
                            )}
                            {lead.source && (
                              <div className="flex items-center gap-2 text-gray-600">
                                <TrendingUp className="h-4 w-4" />
                                <span>{lead.source}</span>
                              </div>
                            )}
                          </div>

                          {lead.assignedToId && (
                            <div className="flex items-center gap-2 text-sm">
                              <span className="text-gray-500">Currently assigned to:</span>
                              <Badge variant="outline" className="text-blue-700 border-blue-300">
                                {lead.assignedTo}
                              </Badge>
                            </div>
                          )}

                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <Calendar className="h-3 w-3" />
                            <span>
                              Created: {new Date(lead.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        {/* Action Button */}
                        <div className="flex md:flex-col gap-2">
                          {lead.canBeTaken ? (
                            <Button
                              onClick={() => {
                                setSelectedLead(lead)
                                setShowClaimDialog(true)
                              }}
                              className="bg-green-600 hover:bg-green-700 whitespace-nowrap"
                              disabled={lead.assignedToId === user?.id}
                            >
                              <UserPlus className="h-4 w-4 mr-2" />
                              Claim Lead
                            </Button>
                          ) : (
                            <Button variant="outline" disabled>
                              <AlertCircle className="h-4 w-4 mr-2" />
                              Not Available
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Claim Confirmation Dialog */}
      <Dialog open={showClaimDialog} onOpenChange={setShowClaimDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Claim Lead from Pool</DialogTitle>
            <DialogDescription>
              Are you sure you want to claim this lead? It will be assigned to you.
            </DialogDescription>
          </DialogHeader>

          {selectedLead && (
            <div className="space-y-4 py-4">
              <div className="p-4 bg-gray-50 rounded-lg space-y-2">
                <h4 className="font-semibold text-lg">{selectedLead.name}</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-500">Phone:</span>
                    <p className="font-medium">{selectedLead.phone}</p>
                  </div>
                  {selectedLead.email && (
                    <div>
                      <span className="text-gray-500">Email:</span>
                      <p className="font-medium truncate">{selectedLead.email}</p>
                    </div>
                  )}
                  <div>
                    <span className="text-gray-500">Priority:</span>
                    <Badge className={`${getPriorityColor(selectedLead.priority)} mt-1`}>
                      {selectedLead.priority}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-gray-500">Status:</span>
                    <Badge className={`${getStatusColor(selectedLead.status)} mt-1`}>
                      {selectedLead.status}
                    </Badge>
                  </div>
                </div>

                {selectedLead.assignedToId && (
                  <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                    <div className="flex items-center gap-2 text-sm text-yellow-800">
                      <AlertCircle className="h-4 w-4" />
                      <span>
                        This lead is currently assigned to <strong>{selectedLead.assignedTo}</strong>.
                        They will be notified when you claim it.
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowClaimDialog(false)
                setSelectedLead(null)
              }}
              disabled={claiming}
            >
              Cancel
            </Button>
            <Button
              onClick={handleClaimLead}
              disabled={claiming}
              className="bg-green-600 hover:bg-green-700"
            >
              {claiming ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Claiming...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Confirm Claim
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
