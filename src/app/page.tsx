"use client"

import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ProtectedRoute } from '@/components/auth/protected-route'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import { useLenis } from '@/hooks/use-lenis'
import { useDebounce } from '@/hooks/use-debounce'
import { useQuery, useQueryClient } from '@tanstack/react-query'

// Lazy load heavy components for better performance
const LeadImportModal = lazy(() => import('@/components/LeadImportModal').then(mod => ({ default: mod.LeadImportModal })))
const LeadsPool = lazy(() => import('@/components/LeadsPool').then(mod => ({ default: mod.LeadsPool })))
const TaskManagement = lazy(() => import('@/components/TaskManagement').then(mod => ({ default: mod.TaskManagement })))
const AttendanceManagement = lazy(() => import('@/components/AttendanceManagement').then(mod => ({ default: mod.AttendanceManagement })))
import {
  Users,
  Phone,
  Calendar,
  Bell,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock,
  MapPin,
  DollarSign,
  BarChart3,
  Info,
  X,
  LogOut,
  CheckSquare,
  Menu,
  ChevronDown
} from 'lucide-react'
import { EmployeeManagement } from '@/components/EmployeeManagement'
import { LeadManagement } from '@/components/LeadManagement'
import { AnalyticsDashboard } from '@/components/AnalyticsDashboard'
import { usePermissions } from '@/hooks/use-permissions'
import { io, Socket } from 'socket.io-client'

export default function Home() {
  const { user, logout } = useAuth()
  const { canViewEmployees, canCreateEmployees, canViewLeads, canCreateLeads, canViewAttendance, canCreateAttendance, canViewReports, loading: permissionsLoading } = usePermissions();
  const router = useRouter()
  const { toast } = useToast()
  const { scrollToElement, scrollToTop } = useLenis()
  const safeUserId = user?.id || ''
  const safeCompanyId = user?.companyId || ''
  const [activeTab, setActiveTab] = useState('overview')
  const [showBulkImportModal, setShowBulkImportModal] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return window.innerWidth >= 1024
  })
  const [unreadNotifications, setUnreadNotifications] = useState(0)
  const [socket, setSocket] = useState<Socket | null>(null)
  const [notificationPopoverOpen, setNotificationPopoverOpen] = useState(false)
  
  const queryClient = useQueryClient()

  const normalizeList = useCallback((value: any) => {
    if (Array.isArray(value)) return value
    if (value && Array.isArray(value.data)) return value.data
    return []
  }, [])

  // Identity is derived from the httpOnly session cookie by the server -
  // never send user ids from the client.
  const jsonFetch = useCallback((url: string) =>
    fetch(url).then(async (r) => {
      if (!r.ok) {
        const body = await r.json().catch(() => null)
        throw new Error(body?.error || `Request failed (${r.status})`)
      }
      return r.json()
    }), [])

  // React Query Data Fetching
  const { data: employeesData, isLoading: employeesLoading, error: employeesError } = useQuery({
    queryKey: ['employees', safeCompanyId],
    queryFn: () => jsonFetch('/api/employees'),
    enabled: !!safeCompanyId && canViewEmployees && !permissionsLoading,
    staleTime: 60_000,
  });
  const employees = employeesData ? normalizeList(employeesData) : [];

  // Overview KPIs only need a small window of leads - not the entire table
  const { data: leadsQueryData, isLoading: leadsLoading, error: leadsError } = useQuery({
    queryKey: ['leads_overview', safeCompanyId],
    queryFn: () => jsonFetch('/api/leads?limit=200'),
    enabled: !!safeCompanyId && canViewLeads && !permissionsLoading,
    staleTime: 60_000,
  });
  const leads = leadsQueryData?.data ? normalizeList(leadsQueryData.data) : [];
  const { data: attendanceData, isLoading: attendanceLoading, error: attendanceError } = useQuery({
    queryKey: ['attendance', safeCompanyId],
    queryFn: () => jsonFetch('/api/attendance'),
    enabled: !!safeCompanyId && canViewAttendance && !permissionsLoading,
    staleTime: 30_000,
  });
  const attendanceRecords = attendanceData ? normalizeList(attendanceData) : [];
  const { data: notificationsData, isLoading: notificationsLoading, error: notificationsError } = useQuery({
    queryKey: ['notifications', safeCompanyId],
    queryFn: () => jsonFetch('/api/notifications'),
    enabled: !!safeCompanyId && !permissionsLoading,
    staleTime: 30_000,
  });

  // Departments and roles via React Query (replaces silent-catch useEffect)
  const { data: departmentsData } = useQuery({
    queryKey: ['departments', safeCompanyId],
    queryFn: () => jsonFetch('/api/departments'),
    enabled: !!safeCompanyId && !permissionsLoading,
    staleTime: 5 * 60_000,
  });
  const { data: rolesData } = useQuery({
    queryKey: ['roles', safeCompanyId],
    queryFn: () => jsonFetch('/api/roles'),
    enabled: !!safeCompanyId && !permissionsLoading,
    staleTime: 5 * 60_000,
  });
  const departments: any[] = useMemo(() => normalizeList(departmentsData), [departmentsData, normalizeList])
  const roles: any[] = useMemo(() => normalizeList(rolesData), [rolesData, normalizeList])
  const notifications = notificationsData || [];
  const setNotifications = (updater: ((prev: any[]) => any[]) | any[]) => {
    queryClient.setQueryData(['notifications', safeCompanyId], (old: any) => {
      const prev = Array.isArray(old) ? old : [];
      return typeof updater === 'function' ? updater(prev) : updater;
    });
  };

  const { data: reportsData } = useQuery({
    queryKey: ['reports', safeCompanyId],
    queryFn: () => jsonFetch('/api/reports'),
    enabled: !!safeCompanyId && canViewReports && !permissionsLoading,
    staleTime: 2 * 60_000,
  });
  const reports = reportsData?.success ? reportsData.data || [] : [];
  const setReports = (updater: ((prev: any[]) => any[]) | any[]) => {
    queryClient.setQueryData(['reports', safeCompanyId], (old: any) => {
      const prev = old?.success ? old.data || [] : [];
      const next = typeof updater === 'function' ? updater(prev) : updater;
      return { success: true, data: next };
    });
  };

  const { data: statsData, isLoading: statsLoading, error: statsError } = useQuery({
    queryKey: ['stats', safeCompanyId],
    queryFn: () => jsonFetch('/api/reports/overview-stats'),
    enabled: !!safeCompanyId && canViewReports && !permissionsLoading,
    staleTime: 2 * 60_000,
  });

  const loading = {
    employees: employeesLoading,
    leads: leadsLoading,
    attendance: attendanceLoading,
    notifications: notificationsLoading,
    stats: statsLoading
  };

  const firstError = employeesError || leadsError || attendanceError || notificationsError || statsError
  const dataErrorMessage = firstError instanceof Error ? firstError.message : ''

  useEffect(() => {
    if (notificationsData) {
      setUnreadNotifications(notificationsData.filter((n: any) => !n.isRead).length);
    }
  }, [notificationsData]);

  const [isRefreshing, setIsRefreshing] = useState(false)
  const roleLower = user?.role?.toLowerCase() || ''
  const isAdminOnly = roleLower.includes('admin')
  const isManager = roleLower.includes('manager')

  // Helper function to check if user is admin or manager (can set passwords)
  const isAdmin = useCallback(() => {
    if (!user) return false
    if (user.role && (user.role.toLowerCase().includes('admin') || user.role.toLowerCase().includes('manager'))) return true
    return false
  }, [user])

  // Initialize socket connection
  useEffect(() => {
    if (user) {
      // Initialize socket connection
      const newSocket = io(`${window.location.protocol}//${window.location.hostname}:${window.location.port}`, {
        path: '/api/socketio',
        withCredentials: true,
      });

      newSocket.on('connect', () => {
        // Authenticate user after connection
        newSocket.emit('authenticate', {
          userId: user.id,
          companyId: user.companyId
        });
      });

      // Listen for real-time notifications
      newSocket.on('notification', (notification) => {
        // Add notification to our list and update unread count
        setNotifications(prev => [notification, ...prev]);
        setUnreadNotifications(prev => prev + 1);
        
        // Show toast notification
        toast({
          title: notification.title,
          description: notification.message,
          duration: 5000,
        });
      });

      // Listen for batch notifications
      newSocket.on('notifications', (newNotifications) => {
        setNotifications(newNotifications);
        setUnreadNotifications(newNotifications.filter((n: any) => !n.isRead).length);
      });

      setSocket(newSocket);

      // Clean up connection on unmount
      return () => {
        newSocket.disconnect();
      };
    }
  }, [user]);

  // Handle responsive sidebar state
  useEffect(() => {
    const handleResize = () => {
      // Auto-open sidebar on desktop, close on mobile
      if (window.innerWidth >= 1024) {
        setSidebarOpen(true)
      } else {
        setSidebarOpen(false)
      }
    }

    // Set initial state
    handleResize()

    // Listen for window resize
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Filter states
  const [employeeFilter, setEmployeeFilter] = useState({
    search: '',
    department: 'ALL',
    status: 'ALL'
  })

  const [leadFilter, setLeadFilter] = useState({
    search: '',
    status: 'ALL',
    priority: 'ALL'
  })

  const [selectedAgentId, setSelectedAgentId] = useState('all')

  const [attendanceFilter, setAttendanceFilter] = useState({
    search: '',
    department: 'ALL',
    status: 'ALL'
  })

  // Debounced search values for better performance (300ms delay)
  const debouncedEmployeeSearch = useDebounce(employeeFilter.search, 300)
  const debouncedLeadSearch = useDebounce(leadFilter.search, 300)
  const debouncedAttendanceSearch = useDebounce(attendanceFilter.search, 300)

  // Pagination states for better performance with large lists
  const [employeePage, setEmployeePage] = useState(1)
  const [leadPage, setLeadPage] = useState(1)
  const [attendancePage, setAttendancePage] = useState(1)
  const itemsPerPage = 10

  // Local states
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [checkInStatus, setCheckInStatus] = useState<'idle' | 'checking' | 'success' | 'error'>('idle')

  // Analytics state
  const [initialized, setInitialized] = useState(false)

  // Targeted invalidation: only refetch the queries this page owns.
  const fetchData = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['employees'] }),
      queryClient.invalidateQueries({ queryKey: ['leads_overview'] }),
      queryClient.invalidateQueries({ queryKey: ['attendance'] }),
      queryClient.invalidateQueries({ queryKey: ['notifications'] }),
      queryClient.invalidateQueries({ queryKey: ['stats'] }),
      queryClient.invalidateQueries({ queryKey: ['reports'] }),
    ]);
  }, [queryClient])

  const refreshLeads = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['leads'] })
    await queryClient.invalidateQueries({ queryKey: ['leads_overview'] })
  }, [queryClient])

  const refreshData = useCallback(async () => {
    setIsRefreshing(true)
    try {
      await fetchData()
      toast({
        title: "Data Refreshed",
        description: "All data has been updated successfully.",
      })
    } finally {
      setIsRefreshing(false)
    }
  }, [fetchData, toast])

  // Mark notification as read
  const markNotificationAsRead = useCallback(async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' }
      })

      if (response.ok) {
        // Update local state to reflect the change
        setNotifications(prev => prev.map(n =>
          n.id === notificationId ? { ...n, isRead: true } : n
        ))
        setUnreadNotifications(prev => Math.max(0, prev - 1))
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to mark notification as read",
        variant: "destructive",
      })
    }
  }, [toast, setNotifications])

  // Mark all notifications as read
  const markAllNotificationsAsRead = useCallback(async () => {
    try {
      const response = await fetch('/api/notifications/mark-all-read', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' }
      })

      if (response.ok) {
        // Update local state to reflect the change
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
        setUnreadNotifications(0)
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to mark notifications as read",
        variant: "destructive",
      })
    }
  }, [toast, setNotifications])

  // Function to specifically fetch reports data
  const fetchReportsData = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['reports'] });
  }, [queryClient])



  // React Query handles fetching per-key with staleTime; no global
  // invalidate-everything on mount or on every tab switch.
  useEffect(() => {
    if (permissionsLoading) return
    setInitialized(true)
  }, [permissionsLoading])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'NEW': return 'bg-blue-100 text-blue-800'
      case 'QUALIFIED': return 'bg-green-100 text-green-800'
      case 'APPLICATION': return 'bg-yellow-100 text-yellow-800'
      case 'CONTACTED': return 'bg-purple-100 text-purple-800'
      case 'PRESENT': return 'bg-green-100 text-green-800'
      case 'LATE': return 'bg-yellow-100 text-yellow-800'
      case 'ABSENT': return 'bg-red-100 text-red-800'
      case 'ACTIVE': return 'bg-green-100 text-green-800'
      case 'ON_LEAVE': return 'bg-yellow-100 text-yellow-800'
      case 'JUNK': return 'bg-red-100 text-red-800'
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

  // Filtered data with debounced search for better performance
  const employeesList = useMemo(() => normalizeList(employees), [employees, normalizeList])
  const leadsList = useMemo(() => normalizeList(leads), [leads, normalizeList])
  const attendanceList = useMemo(() => normalizeList(attendanceRecords), [attendanceRecords, normalizeList])

  const dashboardLeads = useMemo(() => {
    let baseLeads = leadsList

    if (!isAdminOnly && !isManager) {
      baseLeads = baseLeads.filter(lead => lead.assignedToId === user?.id || !lead.assignedToId)
    }

    if (isAdminOnly && selectedAgentId !== 'all') {
      baseLeads = baseLeads.filter(lead =>
        lead.assignedToId === selectedAgentId &&
        (lead.contactedAt || lead.status === 'CONTACTED')
      )
    }

    return baseLeads
  }, [leadsList, isAdminOnly, isManager, selectedAgentId, user?.id])

  const agentLeadSummary = useMemo(() => {
    return employeesList
      .map(employee => {
        const assignedLeads = leadsList.filter(lead => lead.assignedToId === employee.id)
        const contactedLeads = assignedLeads.filter(lead => lead.contactedAt || lead.status === 'CONTACTED')
        return {
          id: employee.id,
          name: employee.name,
          assignedCount: assignedLeads.length,
          contactedCount: contactedLeads.length
        }
      })
      .sort((a, b) => b.assignedCount - a.assignedCount)
  }, [employeesList, leadsList])

  const filteredEmployees = useMemo(() => {
    return employeesList.filter(employee => {
      const matchesSearch = (employee.name && employee.name.toLowerCase().includes(debouncedEmployeeSearch.toLowerCase())) ||
                           (employee.email && employee.email.toLowerCase().includes(debouncedEmployeeSearch.toLowerCase())) ||
                           (employee.position && employee.position.toLowerCase().includes(debouncedEmployeeSearch.toLowerCase()))
      const matchesDepartment = employeeFilter.department === 'ALL' || employee.departmentId === employeeFilter.department
      const matchesStatus = employeeFilter.status === 'ALL' || employee.status === employeeFilter.status

      // Role-based filtering
      let roleMatches = true;
      if (user?.role !== 'Administrator' && user?.role !== 'Manager') {
        // Employee can only see their own record
        roleMatches = employee.id === user?.id;
      }

      return (debouncedEmployeeSearch === '' || matchesSearch) && matchesDepartment && matchesStatus && roleMatches
    })
  }, [employeesList, debouncedEmployeeSearch, employeeFilter.department, employeeFilter.status, user?.role, user?.id])

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
  }, [leadsList, debouncedLeadSearch, leadFilter.status, leadFilter.priority, user?.role, user?.id])

  const filteredAttendance = useMemo(() => {
    return attendanceList.filter(record => {
      const matchesSearch = (record.name && record.name.toLowerCase().includes(debouncedAttendanceSearch.toLowerCase())) ||
                           (record.department && record.department.toLowerCase().includes(debouncedAttendanceSearch.toLowerCase())) ||
                           (record.location && record.location.toLowerCase().includes(debouncedAttendanceSearch.toLowerCase()))
      const matchesDepartment = attendanceFilter.department === 'ALL' || record.department === attendanceFilter.department
      const matchesStatus = attendanceFilter.status === 'ALL' || record.status === attendanceFilter.status

      // Role-based filtering
      let roleMatches = true;
      if (user?.role !== 'Administrator' && user?.role !== 'Manager') {
        // Employee can only see their own attendance records
        roleMatches = record.employeeId === user?.id;
      }

      return (debouncedAttendanceSearch === '' || matchesSearch) && matchesDepartment && matchesStatus && roleMatches
    })
  }, [attendanceList, debouncedAttendanceSearch, attendanceFilter.department, attendanceFilter.status, user?.role, user?.id])

  // Recent data for overview
  const recentLeads = useMemo(() => {
    return leadsList.slice(0, 4).map(lead => ({
      id: lead.id,
      name: lead.name,
      amount: lead.loanAmount,
      status: lead.status,
      priority: lead.priority,
      assignedTo: lead.assignedTo
    }))
  }, [leadsList])

  const recentAttendance = useMemo(() => {
    return attendanceList.slice(0, 4).map(record => ({
      id: record.id,
      name: record.name,
      checkIn: record.checkIn,
      status: record.status,
      location: record.location
    }))
  }, [attendanceList])

  // Reset pagination when filters change
  useEffect(() => {
    setEmployeePage(1)
  }, [debouncedEmployeeSearch, employeeFilter.department, employeeFilter.status])

  useEffect(() => {
    setLeadPage(1)
  }, [debouncedLeadSearch, leadFilter.status, leadFilter.priority])

  useEffect(() => {
    setAttendancePage(1)
  }, [debouncedAttendanceSearch, attendanceFilter.department, attendanceFilter.status])

  // Lead Management Functions
  const handleBulkImportComplete = async (importedLeads: any[]) => {
    try {
      // Use the bulk import endpoint with auto-assignment
      const response = await fetch('/api/leads', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leads: importedLeads,
          autoAssign: true, // Enable automatic assignment
          companyId: user?.companyId
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to import leads');
      }

      const result = await response.json();

      // Refresh leads list from backend
      await refreshLeads();

      toast({
        title: "Bulk Import Successful",
        description: `Successfully imported ${result.imported} leads and assigned to ${result.assignedToEmployees} employees`,
        duration: 4000,
      });
    } catch (error) {
      toast({
        title: "Import Failed",
        description: error instanceof Error ? error.message : "Failed to import leads. Please try again.",
        variant: "destructive",
        duration: 4000,
      });
      throw error;
    }
  }

  // Attendance Management Functions
  const getCurrentLocation = () => {
    return new Promise<{ lat: number; lng: number } | null>((resolve) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        resolve(null)
        return
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          })
        },
        () => {
          // Gracefully allow check-in/out without location
          resolve(null)
        },
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
      )
    })
  }

  const handleCheckIn = async () => {
    if (!safeUserId || !safeCompanyId) {
      toast({
        title: "Unable to check in",
        description: "User session missing. Please log in again.",
        variant: "destructive",
      })
      return
    }
    setCheckInStatus('checking')
    try {
      const location = await getCurrentLocation()
      if (location) {
        setCurrentLocation(location)
      }
      
      const response = await fetch('/api/attendance/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: location?.lat ?? null,
          longitude: location?.lng ?? null,
          notes: ''
        })
      })

      const result = await response.json()
      
      if (result.success) {
        fetchData() // Refresh attendance data
        
        // Emit real-time event for attendance update
        if (socket) {
          socket.emit('attendance_update', {
            employeeId: user?.id,
            companyId: user?.companyId,
            action: 'checked in',
            timestamp: new Date()
          });
        }
        
        setCheckInStatus('success')
        toast({
          title: "Check-in Successful",
          description: `Checked in successfully`,
          duration: 4000,
        })
        setTimeout(() => setCheckInStatus('idle'), 2000)
      } else {
        throw new Error(result.error || 'Check-in failed')
      }
    } catch (error) {
      setCheckInStatus('error')
      toast({
        title: "Check-in Failed",
        description: error instanceof Error ? error.message : "Failed to check in",
        variant: "destructive",
        duration: 4000,
      })
      setTimeout(() => setCheckInStatus('idle'), 2000)
    }
  }

  const handleCheckOut = async () => {
    if (!safeUserId || !safeCompanyId) {
      toast({
        title: "Unable to check out",
        description: "User session missing. Please log in again.",
        variant: "destructive",
      })
      return
    }
    setCheckInStatus('checking')
    try {
      const location = await getCurrentLocation()
      if (location) {
        setCurrentLocation(location)
      }
      
      const response = await fetch('/api/attendance/check-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: location?.lat ?? null,
          longitude: location?.lng ?? null,
          notes: ''
        })
      })

      const result = await response.json()
      
      if (result.success) {
        fetchData() // Refresh attendance data
        
        // Emit real-time event for attendance update
        if (socket) {
          socket.emit('attendance_update', {
            employeeId: user?.id,
            companyId: user?.companyId,
            action: 'checked out',
            timestamp: new Date()
          });
        }
        
        setCheckInStatus('success')
        toast({
          title: "Check-out Successful",
          description: `Checked out successfully`,
          duration: 4000,
        })
        setTimeout(() => setCheckInStatus('idle'), 2000)
      } else {
        throw new Error(result.error || 'Check-out failed')
      }
    } catch (error) {
      setCheckInStatus('error')
      toast({
        title: "Check-out Failed",
        description: error instanceof Error ? error.message : "Failed to check out",
        variant: "destructive",
        duration: 4000,
      })
      setTimeout(() => setCheckInStatus('idle'), 2000)
    }
  }

  const handleNavigation = (section: string) => {
    setActiveTab(section)
    // Smooth scroll to top when changing tabs
    scrollToTop()
    // Close sidebar on mobile after navigation
    if (window.innerWidth < 1024) {
      setSidebarOpen(false)
    }
  }

  const handleLeadClick = () => {
    setActiveTab('leads')
  }

  const handleNotificationClick = (notification: any) => {
    markNotificationAsRead(notification.id)
    toast({
      title: notification.title,
      description: notification.message,
      duration: 5000,
    })
  }

  const handleBulkImportClick = () => {
    setShowBulkImportModal(true)
  }

  const handleAttendanceCheckIn = async (data: any) => {
    try {
      const response = await fetch('/api/attendance/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: data.latitude,
          longitude: data.longitude,
          notes: 'Geofence check-in'
        })
      })

      const result = await response.json()
      
      if (result.success) {
        fetchData() // Refresh attendance data
        toast({
          title: "Geofence Check-in Successful",
          description: `Checked in at ${data.locationName || 'work location'} with location verification`,
          duration: 4000,
        })
      } else {
        throw new Error(result.error || 'Check-in failed')
      }
    } catch (error) {
      toast({
        title: "Geofence Check-in Failed",
        description: error instanceof Error ? error.message : "Failed to check in",
        variant: "destructive",
        duration: 4000,
      })
    }
  }

  const handleAttendanceCheckOut = async (data: any) => {
    try {
      const response = await fetch('/api/attendance/check-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: data.latitude,
          longitude: data.longitude,
          notes: 'Geofence check-out'
        })
      })

      const result = await response.json()
      
      if (result.success) {
        fetchData() // Refresh attendance data
        toast({
          title: "Geofence Check-out Successful",
          description: `Checked out from ${data.locationName || 'location'} with location verification`,
          duration: 4000,
        })
      } else {
        throw new Error(result.error || 'Check-out failed')
      }
    } catch (error) {
      toast({
        title: "Geofence Check-out Failed",
        description: error instanceof Error ? error.message : "Failed to check out",
        variant: "destructive",
        duration: 4000,
      })
    }
  }

  const handleLogout = async () => {
    await logout()
    // Full navigation so middleware sees the cleared cookie
    window.location.href = '/login'
  }

  // Loading indicators
  if (loading.stats && activeTab === 'overview') {
    return (
      <ProtectedRoute>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
            <p className="text-lg text-gray-600">Loading dashboard...</p>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <div className="flex min-h-screen min-h-dvh bg-gray-50 transition-colors duration-200">

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden transition-opacity duration-300"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        ${sidebarOpen ? 'lg:w-64' : 'lg:w-16'}
        fixed lg:sticky
        inset-y-0 lg:top-0 left-0
        z-50 lg:z-auto
        w-64
        lg:h-screen
        bg-white border-r border-gray-200 max-h-screen
        flex flex-col
        transition-all duration-300 ease-in-out
        shadow-xl lg:shadow-none
      `}>
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 flex items-center justify-between">
          <div
            className={`flex items-center gap-3 ${sidebarOpen ? 'w-[calc(100%-40px)]' : 'w-full'} overflow-hidden`}
            onClick={() => !sidebarOpen && setSidebarOpen(true)}
            style={{ cursor: sidebarOpen ? 'default' : 'pointer' }}
          >
            <img src="/baytechlogo.svg" alt="Baytech Logo" className="h-8 w-8 flex-shrink-0" />
            {sidebarOpen && (
              <div className="min-w-0 flex-1">
                <h1 className="text-xl font-bold text-gray-900 truncate">Baytech ERP</h1>
                <p className="text-sm text-gray-500 truncate">Mortgage System</p>
              </div>
            )}
          </div>
          {sidebarOpen && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(false)}
              className="ml-auto flex-shrink-0 hover:bg-gray-100"
              aria-label="Close sidebar"
            >
              <X className="h-5 w-5" />
            </Button>
          )}
        </div>
        
        <nav className="flex-1 p-4 overflow-y-auto">
          <div className="space-y-1">
            <Button
              variant={activeTab === 'overview' ? 'secondary' : 'ghost'}
              className={`w-full gap-2 transition-all duration-200 ${!sidebarOpen ? 'justify-center px-2 lg:px-2' : 'justify-start'} hover:scale-105`}
              onClick={() => handleNavigation('overview')}
            >
              <BarChart3 className="h-4 w-4 flex-shrink-0" />
              {sidebarOpen && <span className="truncate">Dashboard</span>}
            </Button>

            {canViewEmployees && (
              <Button
                variant={activeTab === 'employees' ? 'secondary' : 'ghost'}
                className={`w-full gap-2 transition-all duration-200 ${!sidebarOpen ? 'justify-center px-2 lg:px-2' : 'justify-start'} hover:scale-105`}
                onClick={() => handleNavigation('employees')}
              >
                <Users className="h-4 w-4 flex-shrink-0" />
                {sidebarOpen && <span className="truncate">Employees</span>}
              </Button>
            )}

            {canViewLeads && (
              <Button
                variant={activeTab === 'leads' ? 'secondary' : 'ghost'}
                className={`w-full gap-2 transition-all duration-200 ${!sidebarOpen ? 'justify-center px-2 lg:px-2' : 'justify-start'} hover:scale-105`}
                onClick={() => handleNavigation('leads')}
              >
                <Phone className="h-4 w-4 flex-shrink-0" />
                {sidebarOpen && <span className="truncate">Leads</span>}
              </Button>
            )}

            {canViewLeads && (
              <Button
                variant={activeTab === 'leads-pool' ? 'secondary' : 'ghost'}
                className={`w-full gap-2 transition-all duration-200 ${!sidebarOpen ? 'justify-center px-2 lg:px-2' : 'justify-start'} hover:scale-105`}
                onClick={() => handleNavigation('leads-pool')}
              >
                <Users className="h-4 w-4 flex-shrink-0" />
                {sidebarOpen && <span className="truncate">Leads Pool</span>}
              </Button>
            )}

            {canViewAttendance && (
              <Button
                variant={activeTab === 'attendance' ? 'secondary' : 'ghost'}
                className={`w-full gap-2 transition-all duration-200 ${!sidebarOpen ? 'justify-center px-2 lg:px-2' : 'justify-start'} hover:scale-105`}
                onClick={() => handleNavigation('attendance')}
              >
                <Calendar className="h-4 w-4 flex-shrink-0" />
                {sidebarOpen && <span className="truncate">Attendance</span>}
              </Button>
            )}

            <Button
              variant={activeTab === 'tasks' ? 'secondary' : 'ghost'}
              className={`w-full gap-2 transition-all duration-200 ${!sidebarOpen ? 'justify-center px-2 lg:px-2' : 'justify-start'} hover:scale-105`}
              onClick={() => handleNavigation('tasks')}
            >
              <CheckSquare className="h-4 w-4 flex-shrink-0" />
              {sidebarOpen && <span className="truncate">Tasks</span>}
            </Button>



            {isAdmin() && (
              <Button
                variant={activeTab === 'analytics' ? 'secondary' : 'ghost'}
                className={`w-full gap-2 transition-all duration-200 ${!sidebarOpen ? 'justify-center px-2 lg:px-2' : 'justify-start'} hover:scale-105`}
                onClick={() => handleNavigation('analytics')}
              >
                <BarChart3 className="h-4 w-4 flex-shrink-0" />
                {sidebarOpen && <span className="truncate">Analytics</span>}
              </Button>
            )}
          </div>
        </nav>
        
        <div className="p-4 border-t border-gray-200 mt-auto">
          {sidebarOpen ? (
            <>
              <div className="flex items-center gap-3 mb-3 overflow-hidden">
                <Avatar className="flex-shrink-0">
                  <AvatarFallback>{user?.name?.charAt(0) || 'A'}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{user?.name || 'Administrator'}</p>
                  <p className="text-xs text-gray-500 truncate">{user?.role || 'Admin'}</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-center gap-2 bg-gradient-to-r from-red-50 to-rose-50 border-red-200 text-red-600 hover:from-red-100 hover:to-rose-100 hover:text-red-700 hover:border-red-300 transition-all duration-200 transform hover:scale-[1.02] shadow-sm hover:shadow-md"
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4 flex-shrink-0" />
                <span className="font-medium">Logout</span>
              </Button>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Avatar className="w-8 h-8">
                <AvatarFallback className="text-xs">{user?.name?.charAt(0) || 'A'}</AvatarFallback>
              </Avatar>
              <Button
                variant="outline"
                size="sm"
                className="w-10 h-10 p-0 rounded-full bg-gradient-to-r from-red-50 to-rose-50 border-red-200 text-red-600 hover:from-red-100 hover:to-rose-100 hover:text-red-700 hover:border-red-300 transition-all duration-200 shadow-sm hover:shadow-md"
                onClick={handleLogout}
                aria-label="Logout"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex h-screen h-dvh min-w-0 flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4 flex-shrink-0 z-30">
          <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
            {/* Left Section - Mobile Menu + Title */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {/* Mobile Menu Toggle */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden flex-shrink-0"
                aria-label="Toggle menu"
              >
                <Menu className="h-5 w-5" />
              </Button>

              <div className="min-w-0 flex-1">
                <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 truncate">
                  {activeTab === 'overview' && 'Dashboard'}
                  {activeTab === 'employees' && 'Employee Management'}
                  {activeTab === 'leads' && 'Lead Management'}
                  {activeTab === 'leads-pool' && 'Leads Pool'}
                  {activeTab === 'attendance' && 'Attendance Tracking'}
                  {activeTab === 'tasks' && 'Task Management'}
                  {activeTab === 'documents' && 'Document Management'}
                  {activeTab === 'analytics' && 'Analytics & Reports'}
                </h1>
                <p className="text-xs sm:text-sm text-gray-500 truncate hidden sm:block">
                  Welcome back, {user?.name || 'Admin'}
                </p>
              </div>
            </div>

            {/* Right Section - Actions & Profile */}
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0 flex-wrap justify-end">
              {/* Refresh Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={refreshData}
                disabled={isRefreshing}
                className="hidden sm:flex"
              >
                {isRefreshing ? (
                  <Clock className="h-4 w-4 sm:mr-2 animate-spin" />
                ) : (
                  <Clock className="h-4 w-4 sm:mr-2" />
                )}
                <span className="hidden md:inline">{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
              </Button>

              {/* Notifications Dropdown */}
              <div className="relative">
                <Popover open={notificationPopoverOpen} onOpenChange={setNotificationPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="relative"
                      aria-label="Notifications"
                    >
                      <Bell className="h-4 w-4 sm:mr-2" />
                      {unreadNotifications > 0 && (
                        <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center animate-pulse">
                          {unreadNotifications > 9 ? '9+' : unreadNotifications}
                        </span>
                      )}
                      <span className="hidden lg:inline">Notifications</span>
                      <ChevronDown className="h-4 w-4 ml-1 hidden lg:inline" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-0" align="end">
                    <div className="p-4 border-b">
                      <div className="flex justify-between items-center">
                        <h3 className="font-semibold text-lg">Notifications</h3>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={markAllNotificationsAsRead}
                          disabled={notifications.length === 0}
                        >
                          Mark all as read
                        </Button>
                      </div>
                    </div>
                    <ScrollArea className="h-80">
                      <div className="divide-y">
                        {notifications.length === 0 ? (
                          <div className="p-6 text-center text-gray-500">
                            No notifications
                          </div>
                        ) : (
                          notifications.map((notification) => (
                            <div 
                              key={notification.id} 
                              role="button"
                              tabIndex={0}
                              aria-label={`${notification.title}. ${notification.isRead ? '' : 'Unread.'}`}
                              className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors focus:outline-none focus:bg-gray-100 ${!notification.isRead ? 'bg-blue-50' : ''}`}
                              onClick={async () => {
                                await handleNotificationClick(notification);
                                setNotificationPopoverOpen(false);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  handleNotificationClick(notification);
                                  setNotificationPopoverOpen(false);
                                }
                              }}
                            >
                              <div className="flex justify-between">
                                <h4 className={`font-medium ${!notification.isRead ? 'text-blue-700' : 'text-gray-900'}`}>
                                  {notification.title}
                                </h4>
                                {!notification.isRead && (
                                  <>
                                    <span className="h-2 w-2 bg-blue-500 rounded-full flex-shrink-0 mt-1.5" aria-hidden="true"></span>
                                    <span className="sr-only">Unread</span>
                                  </>
                                )}
                              </div>
                              <p className="text-sm text-gray-600 mt-1">
                                {notification.message}
                              </p>
                              <p className="text-xs text-gray-400 mt-2">
                                {new Date(notification.createdAt || notification.time || notification.timestamp).toLocaleString()}
                              </p>
                            </div>
                          ))
                        )}
                      </div>
                    </ScrollArea>
                  </PopoverContent>
                </Popover>
              </div>

              {/* User Profile */}
              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8 sm:h-9 sm:w-9">
                  <AvatarFallback className="text-xs">{user?.name?.charAt(0) || 'A'}</AvatarFallback>
                </Avatar>
                <div className="hidden xl:block">
                  <p className="text-sm font-medium text-gray-900 truncate max-w-[120px]">
                    {user?.name || 'Admin'}
                  </p>
                  <p className="text-xs text-gray-500 truncate max-w-[120px]">
                    {user?.role || 'System Admin'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <main className="min-w-0 flex-1 overflow-y-auto px-3 py-4 pb-24 sm:p-6" data-lenis-prevent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5 sm:space-y-6">
            <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              {(user?.role?.toLowerCase().includes('admin') || user?.role?.toLowerCase().includes('manager') || canViewEmployees) && (
                <TabsTrigger value="employees">Employees</TabsTrigger>
              )}
              {canViewLeads && (
                <TabsTrigger value="leads">Leads</TabsTrigger>
              )}
              {canViewLeads && (
                <TabsTrigger value="leads-pool">Leads Pool</TabsTrigger>
              )}
              {canViewAttendance && (
                <TabsTrigger value="attendance">Attendance</TabsTrigger>
              )}
              <TabsTrigger value="tasks">Tasks</TabsTrigger>
              {(user?.role?.toLowerCase().includes('admin') || user?.role?.toLowerCase().includes('manager') || canViewReports) && (
                <TabsTrigger value="analytics">Analytics</TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              {/* Mobile-first quick actions for field teams - only show if user has the appropriate permissions */}
              <div className="grid grid-cols-2 gap-3 sm:hidden">
                {canViewAttendance && (
                  <Button
                    variant="secondary"
                    className="w-full"
                    onClick={handleCheckIn}
                  >
                    <MapPin className="h-4 w-4 mr-2" />
                    Check In
                  </Button>
                )}
                {canViewAttendance && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleCheckOut}
                  >
                    <Clock className="h-4 w-4 mr-2" />
                    Check Out
                  </Button>
                )}
                {canViewLeads && (
                  <Button
                    className="w-full"
                    onClick={() => handleNavigation('leads')}
                  >
                    <Phone className="h-4 w-4 mr-2" />
                    New Lead
                  </Button>
                )}
                {canViewAttendance && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => handleNavigation('attendance')}
                  >
                    <Calendar className="h-4 w-4 mr-2" />
                    Attendance
                  </Button>
                )}
              </div>

              {/* KPI Cards - show only if user has permission for the relevant resource */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {canViewLeads && (
                  <Card className={loading.stats ? "opacity-70 animate-pulse" : ""}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">My Leads</CardTitle>
                      <Phone className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{dashboardLeads.length}</div>
                      <p className="text-xs text-muted-foreground">
                        {dashboardLeads.filter(l => new Date(l.createdAt) >= new Date(new Date().setDate(new Date().getDate() - 30))).length} this month
                      </p>
                    </CardContent>
                  </Card>
                )}

                {canViewLeads && (
                  <Card className={loading.stats ? "opacity-70 animate-pulse" : ""}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Active Leads</CardTitle>
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{dashboardLeads.filter(lead => !['APPLICATION', 'REJECTED', 'CLOSED', 'JUNK'].includes(lead.status)).length}</div>
                      <p className="text-xs text-muted-foreground">
                        of {dashboardLeads.length} total
                      </p>
                    </CardContent>
                  </Card>
                )}

                {canViewLeads && (
                  <Card className={loading.stats ? "opacity-70 animate-pulse" : ""}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Converted Leads</CardTitle>
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{dashboardLeads.filter(lead => ['APPLICATION', 'APPROVED', 'REAL'].includes(lead.status)).length}</div>
                      <p className="text-xs text-muted-foreground">
                        {dashboardLeads.length ? Math.round((dashboardLeads.filter(lead => ['APPLICATION', 'APPROVED', 'REAL'].includes(lead.status)).length / dashboardLeads.length) * 100) : 0}% conversion
                      </p>
                    </CardContent>
                  </Card>
                )}

                {canViewAttendance && (
                  <Card className={loading.stats ? "opacity-70 animate-pulse" : ""}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">My Attendance</CardTitle>
                      <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{filteredAttendance.length}</div>
                      <p className="text-xs text-muted-foreground">
                        {filteredAttendance.filter(a => a.status === 'PRESENT').length} present
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>

              {isAdminOnly && canViewLeads && (
                <Card>
                  <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                      <CardTitle>Agent Lead Overview</CardTitle>
                      <CardDescription>Assigned vs contacted leads per agent</CardDescription>
                    </div>
                    <div className="w-full sm:w-64">
                      <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Filter by agent" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Agents</SelectItem>
                          {agentLeadSummary.map(agent => (
                            <SelectItem key={agent.id} value={agent.id}>
                              {agent.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {agentLeadSummary.length === 0 ? (
                      <p className="text-sm text-gray-500">No agents available.</p>
                    ) : (
                      <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                        {agentLeadSummary.map(agent => (
                          <div
                            key={agent.id}
                            className={`flex items-center justify-between p-2 rounded-lg border ${selectedAgentId === agent.id ? 'bg-blue-50 border-blue-200' : 'border-gray-100'}`}
                          >
                            <div>
                              <p className="font-medium text-gray-900">{agent.name}</p>
                              <p className="text-xs text-gray-500">
                                {agent.assignedCount} assigned · {agent.contactedCount} contacted
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {agent.assignedCount} assigned
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {agent.contactedCount} contacted
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Recent Activity - show only if user has permission for the resource */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {canViewLeads && (
                  <Card className={loading.leads ? "opacity-70 animate-pulse" : ""}>
                    <CardHeader>
                      <CardTitle>My Recent Leads</CardTitle>
                      <CardDescription>Your assigned leads and updates</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-64">
                        <div className="space-y-4">
                          {loading.leads ? (
                            <div className="space-y-3">
                              {[...Array(4)].map((_, i) => (
                                <div key={`loading-lead-${i}`} className="flex items-center justify-between p-3 border rounded-lg animate-pulse">
                                  <div className="flex items-center gap-3">
                                    <div className="bg-gray-200 rounded-full h-10 w-10" />
                                    <div className="space-y-2">
                                      <div className="h-4 bg-gray-200 rounded w-24" />
                                      <div className="h-4 bg-gray-200 rounded w-16" />
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <div className="h-6 bg-gray-200 rounded w-16" />
                                    <div className="h-6 bg-gray-200 rounded w-12" />
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : dashboardLeads.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                              No assigned leads
                            </div>
                          ) : (
                            dashboardLeads.slice(0, 4).map((lead) => (
                              <div
                                key={lead.id}
                                role="button"
                                tabIndex={0}
                                className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors focus:outline-none focus:bg-gray-100"
                                onClick={() => handleLeadClick()}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    handleLeadClick();
                                  }
                                }}
                              >
                                <div className="flex items-center gap-3">
                                  <Avatar>
                                    <AvatarFallback>{(lead.name || 'U').split(' ').map(n => n[0]).join('')}</AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <p className="font-medium">{lead.name}</p>
                                    <p className="text-sm text-gray-500 truncate max-w-[200px]">
                                      {lead.propertyAddress || 'Property location unavailable'}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge className={getStatusColor(lead.status)}>
                                    {lead.status}
                                  </Badge>
                                  <Badge className={getPriorityColor(lead.priority)}>
                                    {lead.priority}
                                  </Badge>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                )}

                {canViewAttendance && (
                  <Card className={loading.attendance ? "opacity-70 animate-pulse" : ""}>
                    <CardHeader>
                      <CardTitle>My Attendance</CardTitle>
                      <CardDescription>Your check-in and check-out status</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-64">
                        <div className="space-y-4">
                          {loading.attendance ? (
                            <div className="space-y-3">
                              {[...Array(4)].map((_, i) => (
                                <div key={`loading-attendance-${i}`} className="flex items-center justify-between p-3 border rounded-lg animate-pulse">
                                  <div className="flex items-center gap-3">
                                    <div className="bg-gray-200 rounded-full h-10 w-10" />
                                    <div className="space-y-2">
                                      <div className="h-4 bg-gray-200 rounded w-24" />
                                      <div className="h-4 bg-gray-200 rounded w-16" />
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <div className="h-6 bg-gray-200 rounded w-16" />
                                    <div className="h-6 bg-gray-200 rounded w-20" />
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : filteredAttendance.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                              No attendance records for today
                            </div>
                          ) : (
                            filteredAttendance.slice(0, 5).map((record) => (
                              <div key={record.id} className="flex items-center justify-between p-3 border rounded-lg">
                                <div className="flex items-center gap-3">
                                  <Avatar>
                                    <AvatarFallback>{user?.name?.split(' ').map(n => n[0]).join('') || 'U'}</AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <p className="font-medium">Check In</p>
                                    <p className="text-sm text-gray-500">
                                      {record.checkInTime ? new Date(record.checkInTime).toLocaleTimeString() : 'Pending'}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge className={getStatusColor(record.status)}>
                                    {record.status}
                                  </Badge>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Notifications */}
              <Card id="notifications-section" className={loading.notifications ? "opacity-70 animate-pulse" : ""}>
                <CardHeader>
                  <CardTitle>Recent Notifications</CardTitle>
                  <CardDescription>System alerts and updates</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-48">
                    <div className="space-y-3">
                      {loading.notifications ? (
                        <div className="space-y-3">
                          {[...Array(3)].map((_, i) => (
                            <div key={`loading-notification-${i}`} className="flex items-start gap-3 p-3 border rounded-lg animate-pulse">
                              <div className="flex-shrink-0 mt-1">
                                <div className="h-4 w-4 bg-gray-200 rounded" />
                              </div>
                              <div className="flex-1 space-y-2">
                                <div className="h-4 bg-gray-200 rounded w-3/4" />
                                <div className="h-3 bg-gray-200 rounded w-full" />
                                <div className="h-3 bg-gray-200 rounded w-1/2" />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : notifications.length === 0 ? (
                        <div className="text-center py-4 text-gray-500">
                          No notifications
                        </div>
                      ) : (
                        notifications.map((notification) => (
                          <div 
                            key={notification.id}
                            role="button"
                            tabIndex={0}
                            className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors focus:outline-none focus:bg-gray-100"
                            onClick={() => handleNotificationClick(notification)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                handleNotificationClick(notification);
                              }
                            }}
                          >
                            <div className="flex-shrink-0 mt-1">
                              {notification.type === 'info' && <Info className="h-4 w-4 text-blue-500" />}
                              {notification.type === 'warning' && <AlertCircle className="h-4 w-4 text-yellow-500" />}
                              {notification.type === 'success' && <CheckCircle className="h-4 w-4 text-green-500" />}
                            </div>
                            <div className="flex-1">
                              <p className="font-medium">{notification.title}</p>
                              <p className="text-sm text-gray-500">{notification.message}</p>
                              <p className="text-xs text-gray-400 mt-1">{notification.time}</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="employees">
              <EmployeeManagement
                user={user}
                employees={employees}
                departments={departments}
                roles={roles}
                canViewEmployees={canViewEmployees}
                canCreateEmployees={canCreateEmployees}
                loading={loading.employees}
                onRefresh={refreshData}
                refreshData={refreshData}
              />
            </TabsContent>

            <TabsContent value="leads">
              <LeadManagement
                user={user}
                leads={leads}
                canViewLeads={canViewLeads}
                canCreateLeads={canCreateLeads}
                loading={loading.leads}
                onRefresh={refreshLeads}
                setShowBulkImportModal={setShowBulkImportModal}
              />
            </TabsContent>

            <TabsContent value="attendance">
              <Suspense fallback={
                <div className="flex items-center justify-center p-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                </div>
              }>
                <AttendanceManagement
                  user={user}
                  attendanceRecords={attendanceRecords}
                  loading={loading.attendance}
                  onRefresh={fetchData}
                  onCheckIn={handleCheckIn}
                  onCheckOut={handleCheckOut}
                  checkInStatus={checkInStatus}
                />
              </Suspense>
            </TabsContent>

            <TabsContent value="tasks">
              <div className="space-y-6">
                <TaskManagement
                  companyId={user?.companyId}
                  userId={user?.id}
                  userRole={user?.role}
                />
              </div>
            </TabsContent>

            <TabsContent value="leads-pool">
              <LeadsPool user={user} onLeadClaimed={refreshLeads} />
            </TabsContent>

            <TabsContent value="analytics">
              <AnalyticsDashboard 
                safeUserId={safeUserId}
                safeCompanyId={safeCompanyId}
                canViewReports={canViewReports}
                reports={reports}
                leadsList={leadsList}
                employeesList={employeesList}
                attendanceList={attendanceList}
                setReports={setReports}
              />
            </TabsContent>
          </Tabs>
        </main>
      </div>

      {/* Bulk Lead Import Modal */}
      <LeadImportModal 
        open={showBulkImportModal}
        onOpenChange={setShowBulkImportModal}
        onImportComplete={handleBulkImportComplete}
      />
    </div>
    </ProtectedRoute>
  )
}
