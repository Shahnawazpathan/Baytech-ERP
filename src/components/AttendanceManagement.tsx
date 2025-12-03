"use client"

import React, { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { useDebounce } from '@/hooks/use-debounce'
import {
  Calendar,
  Clock,
  MapPin,
  Search,
  Download,
  CheckCircle,
  XCircle,
  AlertCircle,
  TrendingUp,
  Users,
  Timer,
  Navigation
} from 'lucide-react'

interface AttendanceManagementProps {
  user: any
  attendanceRecords: any[]
  loading: boolean
  onRefresh: () => void
  onCheckIn: () => void
  onCheckOut: () => void
  checkInStatus: string
}

export function AttendanceManagement({
  user,
  attendanceRecords,
  loading,
  onRefresh,
  onCheckIn,
  onCheckOut,
  checkInStatus
}: AttendanceManagementProps) {
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('today')

  const debouncedSearch = useDebounce(searchTerm, 300)

  const records = useMemo(() => {
    if (Array.isArray(attendanceRecords)) return attendanceRecords
    if (attendanceRecords && Array.isArray((attendanceRecords as any).data)) return (attendanceRecords as any).data
    return []
  }, [attendanceRecords])

  // Calculate statistics
  const stats = useMemo(() => {
    const present = records.filter(a => a.status === 'PRESENT').length
    const late = records.filter(a => a.status === 'LATE').length
    const onLeave = records.filter(a => a.status === 'ON_LEAVE').length
    const absent = records.filter(a => a.status === 'ABSENT').length
    const total = records.length
    const presentPercentage = total > 0 ? Math.round((present / total) * 100) : 0
    const latePercentage = total > 0 ? Math.round((late / total) * 100) : 0

    // Calculate average hours
    const totalHours = records.reduce((sum, record) => {
      if (record.checkInTime && record.checkOutTime) {
        const checkIn = new Date(record.checkInTime)
        const checkOut = new Date(record.checkOutTime)
        const hours = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60)
        return sum + hours
      }
      return sum
    }, 0)
    const avgHours = records.length > 0 ? (totalHours / records.length).toFixed(1) : '0.0'

    return {
      present,
      late,
      onLeave,
      absent,
      total,
      presentPercentage,
      latePercentage,
      avgHours
    }
  }, [records])

  // Filter records
  const filteredRecords = useMemo(() => {
    return records.filter(record => {
      const matchesSearch = record.name?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
                           record.department?.toLowerCase().includes(debouncedSearch.toLowerCase())
      const matchesStatus = statusFilter === 'all' || record.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [records, debouncedSearch, statusFilter])

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PRESENT':
        return <Badge className="bg-green-100 text-green-800 border-green-300"><CheckCircle className="h-3 w-3 mr-1" />Present</Badge>
      case 'LATE':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300"><Clock className="h-3 w-3 mr-1" />Late</Badge>
      case 'ABSENT':
        return <Badge className="bg-red-100 text-red-800 border-red-300"><XCircle className="h-3 w-3 mr-1" />Absent</Badge>
      case 'ON_LEAVE':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-300"><AlertCircle className="h-3 w-3 mr-1" />On Leave</Badge>
      case 'HALF_DAY':
        return <Badge className="bg-purple-100 text-purple-800 border-purple-300"><Timer className="h-3 w-3 mr-1" />Half Day</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  // Calculate work hours
  const calculateWorkHours = (checkInTime: string, checkOutTime: string) => {
    if (!checkInTime || !checkOutTime) return '-'
    const checkIn = new Date(checkInTime)
    const checkOut = new Date(checkOutTime)
    const diff = checkOut.getTime() - checkIn.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    return `${hours}h ${minutes}m`
  }

  // Export to CSV
  const handleExport = () => {
    const csvContent = [
      ['Employee', 'Department', 'Check In', 'Check Out', 'Hours', 'Status', 'Location'],
      ...filteredRecords.map(record => [
        record.name,
        record.department || 'N/A',
        record.checkIn || '-',
        record.checkOut || '-',
        calculateWorkHours(record.checkInTime, record.checkOutTime),
        record.status,
        record.location || 'N/A'
      ])
    ].map(row => row.join(',')).join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `attendance_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)

    toast({
      title: "Export Successful",
      description: `Exported ${filteredRecords.length} attendance records`,
    })
  }

  return (
    <div className="space-y-6">
      {/* Header with Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Attendance Tracking</h2>
          <p className="text-sm text-gray-500">Real-time employee attendance management</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={onCheckIn}
            disabled={checkInStatus === 'checking'}
            className="bg-green-600 hover:bg-green-700"
          >
            {checkInStatus === 'checking' ? (
              <Clock className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <CheckCircle className="h-4 w-4 mr-2" />
            )}
            Check In
          </Button>
          <Button
            onClick={onCheckOut}
            disabled={checkInStatus === 'checking'}
            variant="outline"
            className="border-red-500 text-red-600 hover:bg-red-50"
          >
            {checkInStatus === 'checking' ? (
              <Clock className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Navigation className="h-4 w-4 mr-2" />
            )}
            Check Out
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardHeader className="pb-2">
            <CardDescription className="text-green-700 font-medium flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Present Today
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-3xl font-bold text-green-900">{stats.present}</div>
              <div className="text-right">
                <div className="text-sm font-semibold text-green-700">{stats.presentPercentage}%</div>
                <div className="text-xs text-green-600">attendance</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200">
          <CardHeader className="pb-2">
            <CardDescription className="text-yellow-700 font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Late Arrivals
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-3xl font-bold text-yellow-900">{stats.late}</div>
              <div className="text-right">
                <div className="text-sm font-semibold text-yellow-700">{stats.latePercentage}%</div>
                <div className="text-xs text-yellow-600">late rate</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardHeader className="pb-2">
            <CardDescription className="text-blue-700 font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              On Leave
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-3xl font-bold text-blue-900">{stats.onLeave}</div>
              <div className="text-right">
                <div className="text-xs text-blue-600">approved leave</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardHeader className="pb-2">
            <CardDescription className="text-purple-700 font-medium flex items-center gap-2">
              <Timer className="h-4 w-4" />
              Avg. Hours
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-3xl font-bold text-purple-900">{stats.avgHours}</div>
              <div className="text-right">
                <div className="text-xs text-purple-600">hours/day</div>
              </div>
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
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by name or department..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="PRESENT">Present</SelectItem>
                <SelectItem value="LATE">Late</SelectItem>
                <SelectItem value="ABSENT">Absent</SelectItem>
                <SelectItem value="ON_LEAVE">On Leave</SelectItem>
                <SelectItem value="HALF_DAY">Half Day</SelectItem>
              </SelectContent>
            </Select>

            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Select date range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="yesterday">Yesterday</SelectItem>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Attendance Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              Attendance Records ({filteredRecords.length})
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={onRefresh}>
              <TrendingUp className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-4 border rounded-lg animate-pulse">
                  <div className="bg-gray-200 rounded-full h-12 w-12" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-1/4" />
                    <div className="h-3 bg-gray-200 rounded w-1/6" />
                  </div>
                  <div className="h-6 bg-gray-200 rounded w-20" />
                </div>
              ))}
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">No attendance records found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRecords.map((record) => (
                <Card key={record.id} className="border-l-4 hover:shadow-md transition-shadow" style={{
                  borderLeftColor: record.status === 'PRESENT' ? '#10b981' :
                                  record.status === 'LATE' ? '#f59e0b' :
                                  record.status === 'ABSENT' ? '#ef4444' :
                                  record.status === 'ON_LEAVE' ? '#3b82f6' : '#8b5cf6'
                }}>
                  <CardContent className="p-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      {/* Employee Info */}
                      <div className="flex items-center gap-4 flex-1">
                        <Avatar className="h-12 w-12">
                          <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white font-semibold">
                            {(record.name || 'U').split(' ').map((n: string) => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-semibold text-gray-900">{record.name}</p>
                          <p className="text-sm text-gray-500">{record.department || 'No Department'}</p>
                        </div>
                      </div>

                      {/* Time Info */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-1">
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Check In</p>
                          <p className="font-medium text-sm flex items-center gap-1">
                            <Clock className="h-3 w-3 text-green-600" />
                            {record.checkIn || '-'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Check Out</p>
                          <p className="font-medium text-sm flex items-center gap-1">
                            <Clock className="h-3 w-3 text-red-600" />
                            {record.checkOut || '-'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Hours</p>
                          <p className="font-medium text-sm flex items-center gap-1">
                            <Timer className="h-3 w-3 text-blue-600" />
                            {calculateWorkHours(record.checkInTime, record.checkOutTime)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Status</p>
                          {getStatusBadge(record.status)}
                        </div>
                      </div>

                      {/* Location */}
                      {record.location && (
                        <div className="flex items-center gap-2 text-sm text-gray-600 max-w-xs">
                          <MapPin className="h-4 w-4 flex-shrink-0 text-gray-400" />
                          <span className="truncate">{record.location}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
