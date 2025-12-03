"use client"

import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts'
import { ProtectedRoute } from '@/components/auth/protected-route'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import { useLenis } from '@/hooks/use-lenis'
import { useDebounce } from '@/hooks/use-debounce'

// Lazy load heavy components for better performance
const LeadImportModal = lazy(() => import('@/components/LeadImportModal').then(mod => ({ default: mod.LeadImportModal })))
const LeadAssignment = lazy(() => import('@/components/LeadAssignment').then(mod => ({ default: mod.LeadAssignment })))
const LeadsPool = lazy(() => import('@/components/LeadsPool').then(mod => ({ default: mod.LeadsPool })))
const GeofenceAttendance = lazy(() => import('@/components/GeofenceAttendance').then(mod => ({ default: mod.GeofenceAttendance })))
const GeofenceLocationManager = lazy(() => import('@/components/GeofenceLocationManager').then(mod => ({ default: mod.GeofenceLocationManager })))
const TaskManagement = lazy(() => import('@/components/TaskManagement').then(mod => ({ default: mod.TaskManagement })))
const AttendanceManagement = lazy(() => import('@/components/AttendanceManagement').then(mod => ({ default: mod.AttendanceManagement })))
import {
  Users,
  Building2,
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
  Upload,
  Download,
  FileText,
  UserPlus,
  Map,
  Settings,
  Info,
  Search,
  Filter,
  X,
  Check,
  Navigation,
  LogOut,
  CheckSquare,
  FolderOpen,
  Menu,
  MoreVertical,
  ChevronDown
} from 'lucide-react'
import { EmployeeManagement } from '@/components/EmployeeManagement'
import { LeadManagement } from '@/components/LeadManagement'
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
  
  // Global state for all data
  const [notifications, setNotifications] = useState<any[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [leads, setLeads] = useState<any[]>([])
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([])
  const [reports, setReports] = useState<any[]>([])
  
  // Loading states
  const [loading, setLoading] = useState({
    employees: false,
    leads: false,
    attendance: false,
    notifications: false,
    stats: false
  })
  const [isRefreshing, setIsRefreshing] = useState(false)
  const normalizeList = useCallback((value: any) => {
    if (Array.isArray(value)) return value
    if (value && Array.isArray(value.data)) return value.data
    return []
  }, [])

  // Helper function to check if user is admin or manager (can set passwords)
  const isAdmin = useCallback(() => {
    if (!user) return false
    // Check by email
    if (user.email === 'admin@baytech.com') return true
    // Check by role (case-insensitive) - Admin or Manager can set passwords
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

  // Fetch departments and roles when component mounts
  useEffect(() => {
    const fetchDepartmentsAndRoles = async () => {
      try {
        const [departmentsRes, rolesRes] = await Promise.all([
          fetch('/api/departments', {
            headers: {
              'x-user-id': safeUserId,
              'x-company-id': safeCompanyId
            }
          }),
          fetch('/api/roles', {
            headers: {
              'x-user-id': safeUserId,
              'x-company-id': safeCompanyId
            }
          })
        ]);

        if (departmentsRes.ok) {
          const departmentsData = await departmentsRes.json();
          setDepartments(departmentsData);
        }

        if (rolesRes.ok) {
          const rolesData = await rolesRes.json();
          setRoles(rolesData);
        }
      } catch (error) {
        // Error is handled by toast notification elsewhere
      }
    };

    fetchDepartmentsAndRoles();
  }, [user]);
  
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

  // Form states
  const [showAddEmployeeModal, setShowAddEmployeeModal] = useState(false)
  const [showAddLeadModal, setShowAddLeadModal] = useState(false)
  const [showGeofenceAttendance, setShowGeofenceAttendance] = useState(false)
  const [newEmployee, setNewEmployee] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    position: 'Employee', // Default position
    countryCode: '+1', // Default to US
    roleId: '',
    status: 'ACTIVE',
    hireDate: new Date().toISOString().split('T')[0]
  })
  const [editingEmployee, setEditingEmployee] = useState<any>(null)
  const [editingLead, setEditingLead] = useState<any>(null)
  const [editingAttendance, setEditingAttendance] = useState<any>(null)
  const [departments, setDepartments] = useState<any[]>([])
  const [roles, setRoles] = useState<any[]>([])
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
  })
  
  // Local states
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [checkInStatus, setCheckInStatus] = useState<'idle' | 'checking' | 'success' | 'error'>('idle')
  const [stats, setStats] = useState({
    totalLeads: 0,
    activeLeads: 0,
    convertedLeads: 0,
    totalEmployees: 0,
    presentToday: 0,
    conversionRate: 0
  })

  // Analytics state
  const [analyticsData, setAnalyticsData] = useState<any>(null)
  const [analyticsDateRange, setAnalyticsDateRange] = useState('30') // days
  const [loadingAnalytics, setLoadingAnalytics] = useState(false)
  const [initialized, setInitialized] = useState(false)

  // Fetch data from API using parallel requests
  const fetchData = useCallback(async () => {
    if (permissionsLoading) return
    try {
      const promises: Array<Promise<Response | null>> = [];

      if (canViewEmployees) {
        promises.push(
          fetch('/api/employees', {
            headers: {
              'x-user-id': safeUserId,
              'x-company-id': safeCompanyId
            }
          })
        );
      } else {
        promises.push(Promise.resolve(null)); // Placeholder
      }

      if (canViewLeads) {
        promises.push(
          fetch('/api/leads', {
            headers: {
              'x-user-id': safeUserId,
              'x-company-id': safeCompanyId
            }
          })
        );
      } else {
        promises.push(Promise.resolve(null)); // Placeholder
      }

      if (canViewAttendance) {
        promises.push(
          fetch('/api/attendance', {
            headers: {
              'x-user-id': safeUserId,
              'x-company-id': safeCompanyId
            }
          })
        );
      } else {
        promises.push(Promise.resolve(null)); // Placeholder
      }

      promises.push(
        fetch('/api/notifications', {
          headers: {
            'x-user-id': safeUserId,
            'x-company-id': safeCompanyId
          }
        })
      );

      if (canViewReports) {
        promises.push(
          fetch('/api/reports/overview-stats', {
            headers: {
              'x-user-id': safeUserId,
              'x-company-id': safeCompanyId
            }
          })
        );
      } else {
        promises.push(Promise.resolve(null)); // Placeholder
      }

      setLoading(prev => ({
        ...prev,
        employees: canViewEmployees ? true : false,
        leads: canViewLeads ? true : false,
        attendance: canViewAttendance ? true : false,
        notifications: true,
        stats: canViewReports ? true : false
      }));

      const responses = await Promise.all(promises);

      // Process responses in parallel
      if (responses[0]?.ok) { // employees
        const employeesData = await responses[0].json();
        setEmployees(normalizeList(employeesData));
      }

      if (responses[1]?.ok) { // leads
        const leadsData = await responses[1].json();
        setLeads(normalizeList(leadsData));
      }

      if (responses[2]?.ok) { // attendance
        const attendanceData = await responses[2].json();
        setAttendanceRecords(normalizeList(attendanceData));
      }

      if (responses[3]?.ok) { // notifications
        const notificationsData = await responses[3].json();
        setNotifications(notificationsData);
        // Update unread count
        const unreadCount = notificationsData.filter(n => !n.isRead).length
        setUnreadNotifications(unreadCount);
      }

      if (responses[4]?.ok) { // stats
        const statsData = await responses[4].json();
        setStats(statsData);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load data. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(prev => ({
        employees: false,
        leads: false,
        attendance: false,
        notifications: false,
        stats: false
      }));
    }
  }, [safeUserId, safeCompanyId, canViewEmployees, canViewLeads, canViewAttendance, canViewReports, toast, normalizeList, permissionsLoading])

  const refreshData = useCallback(async () => {
    setIsRefreshing(true)
    await fetchData()
    setIsRefreshing(false)
    toast({
      title: "Data Refreshed",
      description: "All data has been updated successfully.",
    })
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
        setUnreadNotifications(prev => prev - 1)
      }
    } catch (error) {
      // Error handling would go here if needed
    }
  }, [])

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
      // Error handling would go here if needed
    }
  }, [])

  // Function to specifically fetch reports data
  const fetchReportsData = useCallback(async () => {
    if (permissionsLoading) return
    try {
      const reportsRes = await fetch('/api/reports', {
        headers: {
          'x-user-id': safeUserId,
          'x-company-id': safeCompanyId
        }
      });
      if (reportsRes.ok) {
        const reportsData = await reportsRes.json();
        if (reportsData.success) {
          setReports(reportsData.data || []);
        }
      }
    } catch (error) {
      // Error is handled elsewhere
    }
  }, [permissionsLoading, user?.id, user?.companyId])

  // Analytics Functions
  const fetchAnalytics = useCallback(async (range: string = '30') => {
    if (permissionsLoading) return
    try {
      setLoadingAnalytics(true)
      const response = await fetch(`/api/reports/analytics?range=${range}`, {
        headers: {
          'x-user-id': safeUserId || '',
          'x-company-id': safeCompanyId || 'default-company'
        }
      })

      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setAnalyticsData(result.data)
        }
      }
    } catch (error) {
      console.error('Error fetching analytics:', error)
      toast({
        title: "Error",
        description: "Failed to fetch analytics data",
        variant: "destructive",
      })
    } finally {
      setLoadingAnalytics(false)
    }
  }, [permissionsLoading, toast, user?.companyId, user?.id])


  // Initial data fetch (run once when permissions are ready)
  useEffect(() => {
    if (permissionsLoading) return
    const loadInitial = async () => {
      try {
        await Promise.all([fetchData(), fetchReportsData()])
      } finally {
        setInitialized(true)
      }
    }
    loadInitial()
  }, [fetchData, fetchReportsData, permissionsLoading])

  // Refresh data when tab changes (skip first render to avoid duplicate calls)
  useEffect(() => {
    if (!initialized || permissionsLoading) return

    if (activeTab === 'overview') {
      fetchData()
      fetchReportsData()
      return
    }

    if (activeTab === 'analytics') {
      fetchReportsData()
      fetchAnalytics(analyticsDateRange)
      return
    }

    const refreshTabData = async () => {
      setIsRefreshing(true)
      try {
        switch (activeTab) {
          case 'employees': {
            if (canViewEmployees) {
              const employeesRes = await fetch('/api/employees', {
                headers: {
                  'x-user-id': safeUserId,
                  'x-company-id': safeCompanyId
                }
              })
              if (employeesRes.ok) {
                const data = await employeesRes.json()
                setEmployees(data)
              }
            }
            break
          }
          case 'leads': {
            if (canViewLeads) {
              const leadsRes = await fetch('/api/leads', {
                headers: {
                  'x-user-id': safeUserId,
                  'x-company-id': safeCompanyId
                }
              })
              if (leadsRes.ok) {
                const data = await leadsRes.json()
                setLeads(data)
              }
            }
            break
          }
          case 'attendance': {
            if (canViewAttendance) {
              const attendanceRes = await fetch('/api/attendance', {
                headers: {
                  'x-user-id': safeUserId,
                  'x-company-id': safeCompanyId
                }
              })
              if (attendanceRes.ok) {
                const data = await attendanceRes.json()
                setAttendanceRecords(data)
              }
            }
            break
          }
        }
      } catch (error) {
        // Error handled by existing toasts
      } finally {
        setIsRefreshing(false)
      }
    }
    
    refreshTabData()
  }, [
    activeTab,
    analyticsDateRange,
    canViewAttendance,
    canViewEmployees,
    canViewLeads,
    fetchData,
    fetchReportsData,
    fetchAnalytics,
    initialized,
    user?.companyId,
    user?.id
  ])

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

  // Paginated data for better performance with large lists
  const paginatedEmployees = useMemo(() => {
    const startIndex = (employeePage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return filteredEmployees.slice(startIndex, endIndex)
  }, [filteredEmployees, employeePage, itemsPerPage])

  const paginatedLeads = useMemo(() => {
    const startIndex = (leadPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return filteredLeads.slice(startIndex, endIndex)
  }, [filteredLeads, leadPage, itemsPerPage])

  const paginatedAttendance = useMemo(() => {
    const startIndex = (attendancePage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return filteredAttendance.slice(startIndex, endIndex)
  }, [filteredAttendance, attendancePage, itemsPerPage])

  // Total pages for pagination
  const totalEmployeePages = Math.ceil(filteredEmployees.length / itemsPerPage)
  const totalLeadPages = Math.ceil(filteredLeads.length / itemsPerPage)
  const totalAttendancePages = Math.ceil(filteredAttendance.length / itemsPerPage)

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

  // Employee Management Functions
  const handleAddEmployee = useCallback(async () => {
    if (newEmployee.firstName && newEmployee.email && newEmployee.roleId) {
      // If current user is admin, validate password fields
      if (isAdmin() && newEmployee.password && newEmployee.password !== newEmployee.confirmPassword) {
        toast({
          title: "Error",
          description: "Passwords do not match",
          variant: "destructive",
        })
        return;
      }

      if (isAdmin() && !newEmployee.password) {
        toast({
          title: "Error",
          description: "Please set a password for the new employee",
          variant: "destructive",
        })
        return;
      }

      try {
        const fullPhoneNumber = `${newEmployee.countryCode}${newEmployee.phone}`;
        const response = await fetch('/api/employees', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': safeUserId,
            'x-company-id': safeCompanyId
          },
          body: JSON.stringify({
            firstName: newEmployee.firstName,
            lastName: newEmployee.lastName,
            email: newEmployee.email,
            phone: fullPhoneNumber,
            password: newEmployee.password,
            position: newEmployee.position,
            departmentId: departments.length > 0 ? departments[0].id : "", // Default to first department
            roleId: newEmployee.roleId,
            companyId: user?.companyId,
            status: newEmployee.status,
            hireDate: new Date(newEmployee.hireDate).toISOString()
          })
        })

        if (response.ok) {
          const createdEmployee = await response.json()

          setNewEmployee({
            firstName: '',
            lastName: '',
            email: '',
            phone: '',
            password: '',
            confirmPassword: '',
            position: 'Employee',
            countryCode: '+1',
            roleId: '',
            status: 'ACTIVE',
            hireDate: new Date().toISOString().split('T')[0]
          })
          setShowAddEmployeeModal(false)

          // Refresh data to get the latest list with proper permissions
          await fetchData()

          // Emit real-time event for employee update
          if (socket) {
            socket.emit('employee_update', {
              employeeId: createdEmployee.id,
              companyId: user?.companyId,
              action: 'added',
              updatedBy: user?.name || 'System'
            });
          }

          toast({
            title: "Success",
            description: "Employee added successfully",
          })
        } else {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to add employee');
        }
      } catch (error: any) {
        toast({
          title: "Error",
          description: error.message || "Failed to add employee",
          variant: "destructive",
        })
      }
    } else {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields (First Name, Email, Role)",
        variant: "destructive",
      })
    }
  }, [newEmployee, isAdmin, user?.id, user?.companyId, user?.name, departments, socket, fetchData, toast])

  const handleExportEmployees = useCallback(() => {
    const csvContent = [
      ['Name', 'Email', 'Phone', 'Position', 'Department', 'Status', 'Hire Date'],
      ...filteredEmployees.map(emp => [
        emp.name, emp.email, emp.phone, emp.position, emp.department, emp.status, emp.hireDate
      ])
    ].map(row => row.join(',')).join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `employees_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }, [filteredEmployees])

  // Function to handle editing an employee
  const handleEditEmployeeClick = useCallback(async (employee: any) => {
    setEditingEmployee(employee);
    // Parse phone number to extract country code and number
    let countryCode = '+1'; // Default
    let phone = employee.phone || '';
    
    if (employee.phone) {
      // Simple parsing: look for common country codes at the beginning
      const phoneStr = employee.phone.toString();
      if (phoneStr.startsWith('+')) {
        // Find the country code part (e.g., +1, +44, etc.)
        const codeMatch = phoneStr.match(/^(\+\d{1,4})/);
        if (codeMatch) {
          countryCode = codeMatch[1];
          phone = phoneStr.substring(codeMatch[1].length);
        } else {
          phone = phoneStr;
        }
      } else {
        // If no explicit country code, default to +1
        phone = phoneStr;
      }
    }
    
    setNewEmployee({
      firstName: employee.firstName || employee.name.split(' ')[0],
      lastName: employee.lastName || employee.name.split(' ').slice(1).join(' ') || '',
      email: employee.email,
      phone: phone,
      password: '', // Initialize as empty for editing
      confirmPassword: '', // Initialize as empty for editing
      position: employee.position || 'Employee',
      countryCode: countryCode,
      roleId: employee.roleId || '',
      status: employee.status,
      hireDate: employee.hireDate ? new Date(employee.hireDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
    });
    setShowAddEmployeeModal(true);
  }, [])

  // Function to update an employee
  const handleUpdateEmployee = useCallback(async () => {
    if (editingEmployee && newEmployee.firstName && newEmployee.email && newEmployee.roleId) {
      // If current user is admin and password is being updated, validate password fields
      if (isAdmin() && newEmployee.password && newEmployee.password !== newEmployee.confirmPassword) {
        toast({
          title: "Error",
          description: "Passwords do not match",
          variant: "destructive",
        })
        return;
      }

      try {
        const fullPhoneNumber = `${newEmployee.countryCode}${newEmployee.phone}`;
        const response = await fetch(`/api/employees/${editingEmployee.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': safeUserId,
            'x-company-id': safeCompanyId
          },
          body: JSON.stringify({
            firstName: newEmployee.firstName,
            lastName: newEmployee.lastName,
            email: newEmployee.email,
            phone: fullPhoneNumber,
            password: newEmployee.password || undefined, // Only update password if provided
            position: newEmployee.position,
            departmentId: editingEmployee.departmentId || editingEmployee.department,
            roleId: newEmployee.roleId,
            companyId: user?.companyId,
            status: newEmployee.status,
            hireDate: new Date(newEmployee.hireDate).toISOString()
          })
        })

        if (response.ok) {
          setEditingEmployee(null);
          setNewEmployee({
            firstName: '',
            lastName: '',
            email: '',
            phone: '',
            password: '',
            confirmPassword: '',
            position: 'Employee',
            countryCode: '+1',
            roleId: '',
            status: 'ACTIVE',
            hireDate: new Date().toISOString().split('T')[0]
          });
          setShowAddEmployeeModal(false);

          // Refresh data to get the latest list with proper permissions
          await fetchData();

          // Emit real-time event for employee update
          if (socket) {
            socket.emit('employee_update', {
              employeeId: editingEmployee.id,
              companyId: user?.companyId,
              action: 'updated',
              updatedBy: user?.name || 'System'
            });
          }

          toast({
            title: "Success",
            description: "Employee updated successfully",
          });
        } else {
          throw new Error('Failed to update employee');
        }
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to update employee",
          variant: "destructive",
        });
      }
    }
  }, [editingEmployee, newEmployee, isAdmin, user?.id, user?.companyId, user?.name, socket, fetchData, toast]);

  // Function to toggle employee status (activate/deactivate)
  const toggleEmployeeStatus = async (employeeId: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      const response = await fetch(`/api/employees/${employeeId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': safeUserId,
          'x-company-id': safeCompanyId
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (response.ok) {
        // Refresh data to get the latest list with proper permissions
        await fetchData();

        // Emit real-time event for employee status update
        if (socket) {
          socket.emit('employee_update', {
            employeeId,
            companyId: user?.companyId,
            action: `marked as ${newStatus.toLowerCase()}`,
            updatedBy: user?.name || 'System'
          });
        }

        toast({
          title: "Success",
          description: `Employee ${newStatus.toLowerCase()} successfully`,
        });
      } else {
        throw new Error('Failed to update employee status');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update employee status",
        variant: "destructive",
      });
    }
  };

  const handleImportEmployees = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = async (e) => {
        try {
          const text = e.target?.result as string
          const lines = text.split('\n')
          const importedEmployees = lines.slice(1).filter(line => line.trim()).map((line, index) => {
            const [name, email, phone, position, department] = line.split(',').map(item => item.trim())
            return {
              id: employees.length + index + 1,
              name, email, phone, position, department,
              status: "ACTIVE",
              hireDate: new Date().toISOString().split('T')[0],
              address: ""
            }
          })

          // Here you would send the data to the API
          for (const emp of importedEmployees) {
            await fetch('/api/employees', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                firstName: emp.name.split(' ')[0] || emp.name,
                lastName: emp.name.split(' ').slice(1).join(' ') || '',
                email: emp.email,
                phone: emp.phone,
                position: emp.position,
                departmentId: emp.department, // This would need to be the actual department ID
                roleId: 'default-role', // Default role ID
                companyId: user?.companyId,
                hireDate: new Date().toISOString()
              })
            })
          }

          fetchData() // Refresh data after import
          toast({
            title: "Import Success",
            description: `Successfully imported ${importedEmployees.length} employees`,
          })
        } catch (error) {
          toast({
            title: "Import Error",
            description: "Failed to import employees",
            variant: "destructive",
          })
        }
      }
      reader.readAsText(file)
    }
  }

  // Lead Management Functions
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

  const handleBulkImportComplete = async (importedLeads: any[]) => {
    try {
      // Use the bulk import endpoint with auto-assignment
      const response = await fetch('/api/leads', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': safeUserId,
          'x-company-id': safeCompanyId
        },
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

      // Refresh data from backend to get all leads
      await fetchData();

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
    }
  }

  // Function to handle editing a lead
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

  // Function to update a lead
  const handleUpdateLead = async () => {
    if (editingLead && newLead.firstName && newLead.lastName && newLead.email && newLead.phone) {
      try {
        const response = await fetch(`/api/leads/${editingLead.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': safeUserId,
            'x-company-id': safeCompanyId
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
          setLeads(leads.map(lead => 
            lead.id === updatedLead.id ? updatedLead : lead
          ))
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
          
          // Emit real-time event for lead update
          if (socket) {
            socket.emit('lead_update', {
              leadId: updatedLead.id,
              companyId: user?.companyId,
              action: 'updated',
              updatedBy: user?.name || 'System'
            });
          }
          
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

  // Function to toggle lead status
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
          'x-user-id': safeUserId,
          'x-company-id': safeCompanyId
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (response.ok) {
        const updatedLead = await response.json();
        setLeads(leads.map(lead => 
          lead.id === leadId ? updatedLead : lead
        ));
        
        // Emit real-time event for lead status update
        if (socket) {
          socket.emit('lead_update', {
            leadId,
            companyId: user?.companyId,
            action: `status changed to ${newStatus}`,
            updatedBy: user?.name || 'System'
          });
        }
        
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

  // Function to assign lead to an employee
  const assignLeadToEmployee = async (leadId: string, employeeId: string, notes?: string) => {
    try {
      const response = await fetch('/api/leads/assign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': safeUserId,
          'x-company-id': safeCompanyId
        },
        body: JSON.stringify({
          leadId,
          employeeId,
          notes: notes || `Lead assigned to ${employees.find(e => e.id === employeeId)?.firstName} ${employees.find(e => e.id === employeeId)?.lastName}`
        })
      });

      if (response.ok) {
        const result = await response.json();
        // Update the local state
        setLeads(leads.map(lead => 
          lead.id === leadId ? result.data : lead
        ));
        
        // Emit real-time event for lead assignment
        if (socket) {
          socket.emit('lead_update', {
            leadId,
            companyId: user?.companyId,
            action: `assigned to ${employeeId}`,
            updatedBy: user?.name || 'System'
          });
        }
        
        return true;
      } else {
        throw new Error('Failed to assign lead');
      }
    } catch (error) {
      console.error('Error assigning lead:', error);
      return false;
    }
  };

  // Function to mark a lead as contacted
  const markLeadAsContacted = async (leadId: string) => {
    try {
      const response = await fetch('/api/leads/mark-contacted', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': safeUserId,
          'x-company-id': safeCompanyId
        },
        body: JSON.stringify({
          leadId
        })
      });

      if (response.ok) {
        const result = await response.json();
        // Update the local state
        setLeads(leads.map(lead => 
          lead.id === leadId ? result.data : lead
        ));
        
        // Emit real-time event for lead contact
        if (socket) {
          socket.emit('lead_update', {
            leadId,
            companyId: user?.companyId,
            action: 'marked as contacted',
            updatedBy: user?.name || 'System'
          });
        }
        
        toast({
          title: "Success",
          description: "Lead marked as contacted successfully",
        });
        
        return true;
      } else {
        throw new Error('Failed to mark lead as contacted');
      }
    } catch (error) {
      console.error('Error marking lead as contacted:', error);
      toast({
        title: "Error",
        description: "Failed to mark lead as contacted",
        variant: "destructive",
      });
      return false;
    }
  };

  const handleImportLeads = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = async (e) => {
        try {
          const text = e.target?.result as string
          const lines = text.split('\n')
          const importedLeads = lines.slice(1).filter(line => line.trim()).map((line, index) => {
            const [name, email, phone, loanAmount, status, priority] = line.split(',').map(item => item.trim())
            return {
              id: leads.length + index + 1,
              name, email, phone,
              loanAmount: parseInt(loanAmount) || 0,
              status: status || "NEW",
              priority: priority || "MEDIUM",
              assignedTo: "Unassigned",
              propertyAddress: "",
              creditScore: 0
            }
          })

          // Send data to API
          for (const lead of importedLeads) {
            await fetch('/api/leads', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-user-id': safeUserId,
                'x-company-id': safeCompanyId
              },
              body: JSON.stringify({
                ...lead,
                firstName: lead.name?.split(' ')[0] || '',
                lastName: lead.name?.split(' ').slice(1).join(' ') || '',
                companyId: user?.companyId
              })
            })
          }

          fetchData() // Refresh data after import
          toast({
            title: "Import Success",
            description: `Successfully imported ${importedLeads.length} leads`,
          })
        } catch (error) {
          toast({
            title: "Import Error",
            description: "Failed to import leads",
            variant: "destructive",
          })
        }
      }
      reader.readAsText(file)
    }
  }

  // Lead Form Functions
  const handleAddLead = async () => {
    if (newLead.firstName && newLead.lastName && newLead.email && newLead.phone) {
      try {
        const response = await fetch('/api/leads', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': safeUserId,
            'x-company-id': safeCompanyId
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
          setLeads([...leads, createdLead])
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
          fetchData() // Refresh data
          
          // Emit real-time event for lead update
          if (socket) {
            socket.emit('lead_update', {
              leadId: createdLead.id,
              companyId: user?.companyId,
              action: 'created',
              updatedBy: user?.name || 'System'
            });
          }
          
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
        duration: 4000,
      })
    }
  }

  const handleLeadInputChange = (field: string, value: string) => {
    setNewLead(prev => ({
      ...prev,
      [field]: value
    }))
  }

  // Attendance Management Functions
  const getCurrentLocation = () => {
    return new Promise<{ lat: number; lng: number }>((resolve, reject) => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve({
              lat: position.coords.latitude,
              lng: position.coords.longitude
            })
          },
          (error) => {
            reject(error)
          }
        )
      } else {
        reject(new Error('Geolocation is not supported by this browser.'))
      }
    })
  }

  const handleCheckIn = async () => {
    setCheckInStatus('checking')
    try {
      const location = await getCurrentLocation()
      setCurrentLocation(location)
      
      const response = await fetch('/api/attendance/check-in', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          employeeId: user?.id,
          companyId: user?.companyId,
          latitude: location?.lat,
          longitude: location?.lng,
          address: 'Office Location',
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
    setCheckInStatus('checking')
    try {
      const location = await getCurrentLocation()
      setCurrentLocation(location)
      
      const response = await fetch('/api/attendance/check-out', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          employeeId: user?.id,
          companyId: user?.companyId,
          latitude: location?.lat,
          longitude: location?.lng,
          address: 'Office Location',
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

  // Function to handle editing an attendance record
  const handleEditAttendanceClick = async (attendance: any) => {
    setEditingAttendance(attendance);
  };

  // Function to update an attendance record
  const handleUpdateAttendance = async (attendanceId: string, updatedData: any) => {
    try {
      const response = await fetch(`/api/attendance/${attendanceId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': safeUserId,
          'x-company-id': safeCompanyId
        },
        body: JSON.stringify(updatedData)
      });

      if (response.ok) {
        const updatedAttendance = await response.json();
        
        // Update the local state
        setAttendanceRecords(attendanceRecords.map(record => 
          record.id === attendanceId ? updatedAttendance : record
        ));
        
        // Emit real-time event for attendance update
        if (socket) {
          socket.emit('attendance_update', {
            employeeId: updatedAttendance.employeeId,
            companyId: user?.companyId,
            action: 'attendance updated',
            updatedBy: user?.name || 'System'
          });
        }
        
        toast({
          title: "Success",
          description: "Attendance record updated successfully",
        });
      } else {
        throw new Error('Failed to update attendance');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update attendance record",
        variant: "destructive",
      });
    }
  };

  // Function to delete an attendance record
  const handleDeleteAttendance = async (attendanceId: string) => {
    if (!window.confirm('Are you sure you want to delete this attendance record?')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/attendance/${attendanceId}`, {
        method: 'DELETE',
        headers: {
          'x-user-id': safeUserId,
          'x-company-id': safeCompanyId
        }
      });

      if (response.ok) {
        // Update the local state
        setAttendanceRecords(attendanceRecords.filter(record => record.id !== attendanceId));
        
        toast({
          title: "Success",
          description: "Attendance record deleted successfully",
        });
      } else {
        throw new Error('Failed to delete attendance');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete attendance record",
        variant: "destructive",
      });
    }
  };

  const handleExportAttendance = () => {
    const csvContent = [
      ['Name', 'Department', 'Check In', 'Check Out', 'Status', 'Location'],
      ...filteredAttendance.map(record => [
        record.name, record.department, record.checkIn, record.checkOut, record.status, record.location
      ])
    ].map(row => row.join(',')).join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `attendance_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const generateReport = async (type: string) => {
    try {
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type })
      });

      if (!response.ok) {
        throw new Error('Failed to generate report via API');
      }

      const result = await response.json();
      return result.data.report;
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate report. Using fallback method.",
        variant: "destructive",
      });
      
      // Fallback to local generation
      return {
        id: reports.length + 1,
        name: `${type} Report - ${new Date().toLocaleDateString()}`,
        type: type,
        generatedDate: new Date().toISOString().split('T')[0],
        status: "COMPLETED"
      };
    }
  }

  const handleGenerateReport = async (type: string) => {
    try {
      const report = await generateReport(type);
      
      // Add the new report to the local state
      setReports(prevReports => [...prevReports, report]);
      
      // Generate report content based on type
      let reportContent = '';
      switch (type) {
        case 'Sales':
          reportContent = generateSalesReport();
          break;
        case 'Employee Performance':
          reportContent = generateEmployeePerformanceReport();
          break;
        case 'Lead Conversion':
          reportContent = generateLeadConversionReport();
          break;
        default:
          reportContent = 'General Report Content';
      }

      // Download the report
      const blob = new Blob([reportContent], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${report.name.replace(/\s+/g, '_')}.txt`;
      a.click();
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Report Generated",
        description: `${type} report downloaded successfully`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate report",
        variant: "destructive",
      });
    }
  }

  const generateSalesReport = () => {
    const totalLeads = leadsList.length
    const convertedLeads = leadsList.filter(lead => lead.status === 'APPLICATION' || lead.status === 'REAL').length
    const conversionRate = totalLeads ? ((convertedLeads / totalLeads) * 100).toFixed(2) : '0'
    const totalLoanAmount = leadsList.reduce((sum, lead) => sum + (lead.loanAmount || 0), 0)
    
    return `Sales Report
Generated: ${new Date().toLocaleDateString()}

Total Leads: ${totalLeads}
Converted Leads: ${convertedLeads}
Conversion Rate: ${conversionRate}%
Total Loan Amount: $${totalLoanAmount.toLocaleString()}
Average Loan Amount: $${Math.round(totalLoanAmount / totalLeads).toLocaleString()}

Lead Status Breakdown:
${Object.entries(
  leadsList.reduce((acc, lead) => {
    acc[lead.status] = (acc[lead.status] || 0) + 1
    return acc
  }, {} as Record<string, number>)
).map(([status, count]) => `${status}: ${count}`).join('\n')}
`
  }

  const generateEmployeePerformanceReport = () => {
    const activeEmployees = employeesList.filter(emp => emp.status === 'ACTIVE').length
    const onLeaveEmployees = employeesList.filter(emp => emp.status === 'ON_LEAVE').length
    
    return `Employee Performance Report
Generated: ${new Date().toLocaleDateString()}

Total Employees: ${employeesList.length}
Active Employees: ${activeEmployees}
Employees on Leave: ${onLeaveEmployees}

Department Breakdown:
${Object.entries(
  employeesList.reduce((acc, emp) => {
    acc[emp.department] = (acc[emp.department] || 0) + 1
    return acc
  }, {} as Record<string, number>)
).map(([dept, count]) => `${dept}: ${count}`).join('\n')}

Attendance Overview:
Present: ${attendanceList.filter(r => r.status === 'PRESENT').length}
Late: ${attendanceList.filter(r => r.status === 'LATE').length}
Absent: ${attendanceList.filter(r => r.status === 'ABSENT').length}
`
  }

  const generateLeadConversionReport = () => {
    const statusBreakdown = leadsList.reduce((acc, lead) => {
      acc[lead.status] = (acc[lead.status] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return `Lead Conversion Analysis
Generated: ${new Date().toLocaleDateString()}

Total Leads: ${leadsList.length}

Status Breakdown:
${Object.entries(statusBreakdown as Record<string, number>).map(([status, count]) => `${status}: ${count} (${(leadsList.length ? ((count / leadsList.length) * 100) : 0).toFixed(1)}%)`).join('\n')}

Priority Distribution:
High: ${leadsList.filter(l => l.priority === 'HIGH').length}
Medium: ${leadsList.filter(l => l.priority === 'MEDIUM').length}
Low: ${leadsList.filter(l => l.priority === 'LOW').length}

Average Credit Score: ${leadsList.length ? Math.round(leadsList.reduce((sum, lead) => sum + (lead.creditScore || 0), 0) / leadsList.length) : 0}
`
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

  const handleNotificationsClick = (e?: React.MouseEvent) => {
    e?.preventDefault();
    // Don't navigate anymore, we'll show notifications in a popover
  }

  const handleAddEmployeeClick = () => {
    setShowAddEmployeeModal(true)
  }

  const handleNotificationClick = (notification: any) => {
    markNotificationAsRead(notification.id)
    toast({
      title: notification.title,
      description: notification.message,
      duration: 5000,
    })
  }

  const handleLeadClick = (lead: any) => {
    setActiveTab('leads')
  }

  const handleAttendanceClick = (attendance: any) => {
    setActiveTab('attendance')
  }

  const handleAddLeadClick = () => {
    setShowAddLeadModal(true)
  }

  const handleBulkImportClick = () => {
    setShowBulkImportModal(true)
  }

  const handleGeofenceAttendanceClick = () => {
    setShowGeofenceAttendance(!showGeofenceAttendance)
  }

  const handleAttendanceCheckIn = async (data: any) => {
    try {
      const response = await fetch('/api/attendance/check-in', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          employeeId: user?.id,
          companyId: user?.companyId,
          latitude: data.latitude,
          longitude: data.longitude,
          address: data.locationName,
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
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          employeeId: user?.id,
          companyId: user?.companyId,
          latitude: data.latitude,
          longitude: data.longitude,
          address: data.locationName,
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

  const handleCheckInClick = () => {
    handleCheckIn()
  }

  const handleViewEmployeeDetails = (employee: any) => {
    toast({
      title: "Edit Employee",
      description: `${employee.name} - Position: ${employee.position}, Department: ${employee.department}`,
      duration: 4000,
    })
  }

  const handleViewEmployeeClick = (employee: any) => {
    toast({
      title: "Employee Details",
      description: `Name: ${employee.name}, Email: ${employee.email}, Position: ${employee.position}, Department: ${employee.department}, Status: ${employee.status}`,
      duration: 6000,
    })
  }

  const handleViewLeadDetails = (lead: any) => {
    toast({
      title: "Edit Lead",
      description: `${lead.name} - Amount: $${lead.loanAmount?.toLocaleString() || 0}, Status: ${lead.status}`,
      duration: 4000,
    })
  }

  const handleViewLeadClick = (lead: any) => {
    toast({
      title: "Lead Details",
      description: `Name: ${lead.name}, Amount: $${lead.loanAmount?.toLocaleString() || 0}, Status: ${lead.status}, Priority: ${lead.priority}, Assigned to: ${lead.assignedTo}`,
      duration: 6000,
    })
  }

  const handleViewAttendanceClick = (attendance: any) => {
    toast({
      title: "Attendance Record",
      description: `Name: ${attendance.name}, Check-in: ${attendance.checkIn}, Check-out: ${attendance.checkOut}, Status: ${attendance.status}, Location: ${attendance.location}`,
      duration: 6000,
    })
  }

  const handleViewAttendanceDetails = (attendance: any) => {
    toast({
      title: "Edit Attendance",
      description: `${attendance.name} - Check-in: ${attendance.checkIn}, Status: ${attendance.status}`,
      duration: 4000,
    })
  }

  const handleLogout = () => {
    logout()
    window.location.href = '/login'
  }

  // Loading indicators
  if (loading.stats && activeTab === 'overview' && stats.totalLeads === 0) {
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
      <div className="flex min-h-screen bg-gray-50 transition-colors duration-200">

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
        fixed lg:relative
        inset-y-0 left-0
        z-50 lg:z-auto
        w-64
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



            <Button
              variant={activeTab === 'analytics' ? 'secondary' : 'ghost'}
              className={`w-full gap-2 transition-all duration-200 ${!sidebarOpen ? 'justify-center px-2 lg:px-2' : 'justify-start'} hover:scale-105`}
              onClick={() => handleNavigation('analytics')}
            >
              <BarChart3 className="h-4 w-4 flex-shrink-0" />
              {sidebarOpen && <span className="truncate">Analytics</span>}
            </Button>
          </div>
        </nav>
        
        <div className="p-4 border-t border-gray-200 mt-auto">
          {sidebarOpen ? (
            <>
              <div className="flex items-center gap-3 mb-3 overflow-hidden">
                <Avatar className="flex-shrink-0">
                  <AvatarImage src="/placeholder-avatar.jpg" />
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
                <AvatarImage src="/placeholder-avatar.jpg" />
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
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4 sticky top-0 z-30">
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
                              className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${!notification.isRead ? 'bg-blue-50' : ''}`}
                              onClick={async () => {
                                await handleNotificationClick(notification);
                                setNotificationPopoverOpen(false); // Close the popover after clicking
                              }}
                            >
                              <div className="flex justify-between">
                                <h4 className={`font-medium ${!notification.isRead ? 'text-blue-700' : 'text-gray-900'}`}>
                                  {notification.title}
                                </h4>
                                {!notification.isRead && (
                                  <span className="h-2 w-2 bg-blue-500 rounded-full flex-shrink-0 mt-1.5"></span>
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
                  <AvatarImage src="/placeholder-avatar.jpg" />
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
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 pb-24" data-lenis-prevent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5 sm:space-y-6">
            <TabsList className="w-full sm:w-auto">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="employees">Employees</TabsTrigger>
              <TabsTrigger value="leads">Leads</TabsTrigger>
              <TabsTrigger value="leads-pool">Leads Pool</TabsTrigger>
              <TabsTrigger value="attendance">Attendance</TabsTrigger>
              <TabsTrigger value="tasks">Tasks</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              {/* Mobile-first quick actions for field teams */}
              <div className="grid grid-cols-2 gap-3 sm:hidden">
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={handleCheckIn}
                >
                  <MapPin className="h-4 w-4 mr-2" />
                  Check In
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleCheckOut}
                >
                  <Clock className="h-4 w-4 mr-2" />
                  Check Out
                </Button>
                <Button
                  className="w-full"
                  onClick={() => setShowAddLeadModal(true)}
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  New Lead
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => handleNavigation('attendance')}
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  Attendance
                </Button>
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className={loading.stats ? "opacity-70 animate-pulse" : ""}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
                    <Phone className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.totalLeads}</div>
                    <p className="text-xs text-muted-foreground">
                      +12% from last month
                    </p>
                  </CardContent>
                </Card>

                <Card className={loading.stats ? "opacity-70 animate-pulse" : ""}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Active Leads</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.activeLeads}</div>
                    <p className="text-xs text-muted-foreground">
                      +8% from last week
                    </p>
                  </CardContent>
                </Card>

                <Card className={loading.stats ? "opacity-70 animate-pulse" : ""}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.conversionRate}%</div>
                    <p className="text-xs text-muted-foreground">
                      +2.1% from last month
                    </p>
                  </CardContent>
                </Card>

                <Card className={loading.stats ? "opacity-70 animate-pulse" : ""}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Employees Present</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.presentToday}/{stats.totalEmployees}</div>
                    <p className="text-xs text-muted-foreground">
                      {stats.totalEmployees ? Math.round((stats.presentToday / stats.totalEmployees) * 100) : 0}% attendance rate
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Recent Activity */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className={loading.leads ? "opacity-70 animate-pulse" : ""}>
                  <CardHeader>
                    <CardTitle>Recent Leads</CardTitle>
                    <CardDescription>Latest lead assignments and updates</CardDescription>
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
                                    <div className="h-3 bg-gray-200 rounded w-16" />
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="h-6 bg-gray-200 rounded w-16" />
                                  <div className="h-6 bg-gray-200 rounded w-12" />
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : recentLeads.length === 0 ? (
                          <div className="text-center py-8 text-gray-500">
                            No recent leads
                          </div>
                        ) : (
                          recentLeads.map((lead) => (
                            <div 
                              key={lead.id} 
                              className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                              onClick={() => handleLeadClick(lead)}
                            >
                              <div className="flex items-center gap-3">
                                <Avatar>
                                  <AvatarFallback>{(lead.name || 'U').split(' ').map(n => n[0]).join('')}</AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-medium">{lead.name}</p>
                                  <p className="text-sm text-gray-500">${lead.amount?.toLocaleString() || 0}</p>
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

                <Card className={loading.attendance ? "opacity-70 animate-pulse" : ""}>
                  <CardHeader>
                    <CardTitle>Today's Attendance</CardTitle>
                    <CardDescription>Employee check-in status</CardDescription>
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
                                    <div className="h-3 bg-gray-200 rounded w-16" />
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="h-6 bg-gray-200 rounded w-16" />
                                  <div className="h-6 bg-gray-200 rounded w-20" />
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : recentAttendance.length === 0 ? (
                          <div className="text-center py-8 text-gray-500">
                            No attendance records for today
                          </div>
                        ) : (
                          recentAttendance.map((employee) => (
                            <div 
                              key={employee.id} 
                              className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                              onClick={() => handleAttendanceClick(employee)}
                            >
                              <div className="flex items-center gap-3">
                                <Avatar>
                                  <AvatarFallback>{employee.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-medium">{employee.name}</p>
                                  <p className="text-sm text-gray-500">{employee.checkIn}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge className={getStatusColor(employee.status)}>
                                  {employee.status}
                                </Badge>
                                <Badge variant="outline">
                                  <MapPin className="h-3 w-3 mr-1" />
                                  {employee.location}
                                </Badge>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
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
                            className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                            onClick={() => handleNotificationClick(notification)}
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
                employees={employees}
                canViewLeads={canViewLeads}
                canCreateLeads={canCreateLeads}
                loading={loading.leads}
                onRefresh={refreshData}
                refreshData={refreshData}
                showBulkImportModal={showBulkImportModal}
                setShowBulkImportModal={setShowBulkImportModal}
                handleBulkImportComplete={handleBulkImportComplete}
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
              <LeadsPool user={user} onLeadClaimed={fetchData} />
            </TabsContent>

            <TabsContent value="analytics">
              <div className="space-y-6">
                {/* Analytics Header with Date Range Filter */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Analytics & Reports</h2>
                    <p className="text-sm text-gray-500">Comprehensive business intelligence and insights</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Select
                      value={analyticsDateRange}
                      onValueChange={(value) => {
                        setAnalyticsDateRange(value)
                        fetchAnalytics(value)
                      }}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Select range" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="7">Last 7 days</SelectItem>
                        <SelectItem value="30">Last 30 days</SelectItem>
                        <SelectItem value="90">Last 90 days</SelectItem>
                        <SelectItem value="365">Last year</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleGenerateReport('Sales')}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Generate Report
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        try {
                          const reportsRes = await fetch('/api/reports', {
                            headers: {
                              'x-user-id': safeUserId,
                              'x-company-id': safeCompanyId
                            }
                          });

                          if (reportsRes.ok) {
                            const reportsData = await reportsRes.json();
                            const reportsToExport = reportsData.success ? reportsData.data || [] : reports;

                            const csvContent = [
                              ['Report Name', 'Type', 'Generated Date', 'Status'],
                              ...reportsToExport.map(report => [
                                report.name, report.type, report.generatedDate, report.status
                              ])
                            ].map(row => row.join(',')).join('\n');

                            const blob = new Blob([csvContent], { type: 'text/csv' });
                            const url = window.URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `reports_${new Date().toISOString().split('T')[0]}.csv`;
                            a.click();
                            window.URL.revokeObjectURL(url);

                            toast({
                              title: "Export Success",
                              description: `Exported ${reportsToExport.length} reports successfully`,
                            });
                          }
                        } catch (error) {
                          toast({
                            title: "Export Error",
                            description: "Failed to export reports",
                            variant: "destructive",
                          });
                        }
                      }}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Export
                    </Button>
                  </div>
                </div>

                {loadingAnalytics ? (
                  <div className="text-center py-20">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                    <p className="mt-2 text-gray-500">Loading analytics...</p>
                  </div>
                ) : analyticsData ? (
                  <>
                    {/* Key Performance Indicators */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                        <CardHeader className="pb-2">
                          <CardDescription className="text-blue-700 font-medium">Total Leads</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center justify-between">
                            <div className="text-3xl font-bold text-blue-900">{analyticsData.overview.totalLeads}</div>
                            <Users className="h-8 w-8 text-blue-600 opacity-50" />
                          </div>
                          <p className="text-xs text-blue-600 mt-2">
                            {analyticsData.overview.activeLeads} active
                          </p>
                        </CardContent>
                      </Card>

                      <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                        <CardHeader className="pb-2">
                          <CardDescription className="text-green-700 font-medium">Conversion Rate</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center justify-between">
                            <div className="text-3xl font-bold text-green-900">
                              {analyticsData.overview.conversionRate.toFixed(1)}%
                            </div>
                            <TrendingUp className="h-8 w-8 text-green-600 opacity-50" />
                          </div>
                          <p className="text-xs text-green-600 mt-2">
                            {analyticsData.overview.convertedLeads} converted
                          </p>
                        </CardContent>
                      </Card>

                      <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                        <CardHeader className="pb-2">
                          <CardDescription className="text-purple-700 font-medium">Revenue Pipeline</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center justify-between">
                            <div className="text-3xl font-bold text-purple-900">
                              ${(analyticsData.overview.pipelineRevenue / 1000000).toFixed(1)}M
                            </div>
                            <DollarSign className="h-8 w-8 text-purple-600 opacity-50" />
                          </div>
                          <p className="text-xs text-purple-600 mt-2">
                            ${(analyticsData.overview.convertedRevenue / 1000000).toFixed(1)}M converted
                          </p>
                        </CardContent>
                      </Card>

                      <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
                        <CardHeader className="pb-2">
                          <CardDescription className="text-orange-700 font-medium">Avg Response Time</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center justify-between">
                            <div className="text-3xl font-bold text-orange-900">
                              {analyticsData.overview.avgResponseTime}h
                            </div>
                            <Clock className="h-8 w-8 text-orange-600 opacity-50" />
                          </div>
                          <p className="text-xs text-orange-600 mt-2">
                            {analyticsData.overview.responseRate.toFixed(0)}% within 2hrs
                          </p>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Lead Trends Chart */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Lead Trends Over Time</CardTitle>
                        <CardDescription>Daily lead activity and conversions</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="h-80">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={analyticsData.trends}>
                              <defs>
                                <linearGradient id="colorNew" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                </linearGradient>
                                <linearGradient id="colorConverted" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                              <YAxis />
                              <Tooltip />
                              <Legend />
                              <Area
                                type="monotone"
                                dataKey="total"
                                stroke="#3b82f6"
                                fillOpacity={1}
                                fill="url(#colorNew)"
                                name="Total Leads"
                              />
                              <Area
                                type="monotone"
                                dataKey="converted"
                                stroke="#10b981"
                                fillOpacity={1}
                                fill="url(#colorConverted)"
                                name="Converted"
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Charts Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Status Distribution */}
                      <Card>
                        <CardHeader>
                          <CardTitle>Lead Status Distribution</CardTitle>
                          <CardDescription>Current pipeline status</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="h-80">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={Object.entries(analyticsData.statusDistribution).map(([name, value]) => ({
                                    name,
                                    value
                                  }))}
                                  cx="50%"
                                  cy="50%"
                                  labelLine={false}
                                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                  outerRadius={80}
                                  fill="#8884d8"
                                  dataKey="value"
                                >
                                  {Object.keys(analyticsData.statusDistribution).map((_, index) => (
                                    <Cell key={`cell-${index}`} fill={['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#6b7280', '#000000'][index]} />
                                  ))}
                                </Pie>
                                <Tooltip />
                                <Legend />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Lead Sources */}
                      <Card>
                        <CardHeader>
                          <CardTitle>Lead Sources</CardTitle>
                          <CardDescription>Where your leads come from</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="h-80">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart
                                data={Object.entries(analyticsData.sources).map(([name, value]) => ({
                                  name,
                                  leads: value
                                }))}
                              >
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Bar dataKey="leads" fill="#8b5cf6" />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Department Performance */}
                      <Card>
                        <CardHeader>
                          <CardTitle>Department Performance</CardTitle>
                          <CardDescription>Conversion rates by department</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="h-80">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={analyticsData.departmentStats}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Bar dataKey="totalLeads" name="Total Leads" fill="#3b82f6" />
                                <Bar dataKey="converted" name="Converted" fill="#10b981" />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Priority Distribution */}
                      <Card>
                        <CardHeader>
                          <CardTitle>Lead Priority Distribution</CardTitle>
                          <CardDescription>Priority levels of current leads</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="h-80">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={Object.entries(analyticsData.priorityDistribution).map(([name, value]) => ({
                                    name,
                                    value
                                  }))}
                                  cx="50%"
                                  cy="50%"
                                  labelLine={false}
                                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                  outerRadius={80}
                                  fill="#8884d8"
                                  dataKey="value"
                                >
                                  {Object.keys(analyticsData.priorityDistribution).map((_, index) => (
                                    <Cell key={`cell-${index}`} fill={['#10b981', '#3b82f6', '#f59e0b', '#ef4444'][index]} />
                                  ))}
                                </Pie>
                                <Tooltip />
                                <Legend />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Conversion Funnel */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Lead Conversion Funnel</CardTitle>
                        <CardDescription>Track lead progression through stages</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {analyticsData.funnel.map((stage: any, index: number) => (
                            <div key={index} className="relative">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-gray-700">{stage.stage}</span>
                                <span className="text-sm text-gray-500">{stage.count} leads ({stage.percentage.toFixed(1)}%)</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-8 overflow-hidden">
                                <div
                                  className={`h-8 rounded-full flex items-center justify-center text-white text-sm font-medium transition-all duration-500 ${
                                    index === 0 ? 'bg-blue-500' :
                                    index === 1 ? 'bg-purple-500' :
                                    index === 2 ? 'bg-green-500' :
                                    index === 3 ? 'bg-yellow-500' :
                                    'bg-red-500'
                                  }`}
                                  style={{ width: `${Math.max(stage.percentage, 5)}%` }}
                                >
                                  {stage.count > 0 && stage.count}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Top Performers */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Top Performers</CardTitle>
                        <CardDescription>Employees with highest conversion rates</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {analyticsData.topPerformers.slice(0, 5).map((performer: any, index: number) => (
                            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                              <div className="flex items-center space-x-3">
                                <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                                  index === 0 ? 'bg-yellow-100 text-yellow-700' :
                                  index === 1 ? 'bg-gray-100 text-gray-700' :
                                  index === 2 ? 'bg-orange-100 text-orange-700' :
                                  'bg-blue-100 text-blue-700'
                                }`}>
                                  {index + 1}
                                </div>
                                <div>
                                  <p className="font-medium text-gray-900">{performer.name}</p>
                                  <p className="text-sm text-gray-500">{performer.totalLeads} leads</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-semibold text-green-600">{performer.converted} converted</p>
                                <p className="text-sm text-gray-500">{performer.conversionRate.toFixed(1)}% rate</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </>
                ) : (
                  <Card>
                    <CardContent className="text-center py-20">
                      <BarChart3 className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                      <p className="text-gray-500">No analytics data available</p>
                      <Button
                        onClick={() => fetchAnalytics(analyticsDateRange)}
                        className="mt-4"
                        variant="outline"
                      >
                        Load Analytics
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </main>
      </div>

      {/* Add Employee Modal */}
      <Dialog open={showAddEmployeeModal} onOpenChange={setShowAddEmployeeModal}>
        <DialogContent className="sm:max-w-[600px] max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">
              {editingEmployee ? 'Edit Employee' : 'Add New Employee'}
            </DialogTitle>
            <DialogDescription>
              {editingEmployee 
                ? 'Update employee details below.' 
                : 'Fill in the employee information to create a new record.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4 max-h-[70vh] overflow-y-auto">
            <div className="space-y-2">
              <Label htmlFor="firstName" className="text-sm font-medium">
                First Name *
              </Label>
              <Input
                id="firstName"
                value={newEmployee.firstName}
                onChange={(e) => setNewEmployee({...newEmployee, firstName: e.target.value})}
                placeholder="Enter first name"
                className="h-10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName" className="text-sm font-medium">
                Last Name
              </Label>
              <Input
                id="lastName"
                value={newEmployee.lastName}
                onChange={(e) => setNewEmployee({...newEmployee, lastName: e.target.value})}
                placeholder="Enter last name"
                className="h-10"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="email" className="text-sm font-medium">
                Email *
              </Label>
              <Input
                id="email"
                type="email"
                value={newEmployee.email}
                onChange={(e) => setNewEmployee({...newEmployee, email: e.target.value})}
                placeholder="Enter email address"
                className="h-10"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="phone" className="text-sm font-medium">
                Phone Number
              </Label>
              <div className="flex gap-2">
                <Select value={newEmployee.countryCode} onValueChange={(value) => setNewEmployee({...newEmployee, countryCode: value})}>
                  <SelectTrigger className="w-[100px] h-10">
                    <SelectValue placeholder="Code" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="+1">🇺🇸 +1</SelectItem>
                    <SelectItem value="+44">🇬🇧 +44</SelectItem>
                    <SelectItem value="+91">🇮🇳 +91</SelectItem>
                    <SelectItem value="+86">🇨🇳 +86</SelectItem>
                    <SelectItem value="+49">🇩🇪 +49</SelectItem>
                    <SelectItem value="+33">🇫🇷 +33</SelectItem>
                    <SelectItem value="+81">🇯🇵 +81</SelectItem>
                    <SelectItem value="+55">🇧🇷 +55</SelectItem>
                    <SelectItem value="+7">🇷🇺 +7</SelectItem>
                    <SelectItem value="+234">🇳🇬 +234</SelectItem>
                    <SelectItem value="+971">🇦🇪 +971</SelectItem>
                    <SelectItem value="+966">🇸🇦 +966</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  id="phone"
                  value={newEmployee.phone}
                  onChange={(e) => setNewEmployee({...newEmployee, phone: e.target.value})}
                  placeholder="Enter phone number"
                  className="flex-1 h-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="roleId" className="text-sm font-medium">
                Role
              </Label>
              <Select value={newEmployee.roleId} onValueChange={(value) => setNewEmployee({...newEmployee, roleId: value})}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status" className="text-sm font-medium">
                Status
              </Label>
              <Select value={newEmployee.status} onValueChange={(value) => setNewEmployee({...newEmployee, status: value})}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                  <SelectItem value="ON_LEAVE">On Leave</SelectItem>
                  <SelectItem value="TERMINATED">Terminated</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="position" className="text-sm font-medium">
                Position
              </Label>
              <Select value={newEmployee.position} onValueChange={(value) => setNewEmployee({...newEmployee, position: value})}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Select position" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Employee">Employee</SelectItem>
                  <SelectItem value="Manager">Manager</SelectItem>
                  <SelectItem value="Admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="hireDate" className="text-sm font-medium">
                Hire Date *
              </Label>
              <Input
                id="hireDate"
                type="date"
                value={newEmployee.hireDate}
                onChange={(e) => setNewEmployee({...newEmployee, hireDate: e.target.value})}
                className="h-10"
              />
            </div>
            {isAdmin() && (
              <>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="password" className="text-sm font-medium">
                    Password *
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    value={newEmployee.password}
                    onChange={(e) => setNewEmployee({...newEmployee, password: e.target.value})}
                    placeholder="Enter password for new employee"
                    className="h-10"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="confirmPassword" className="text-sm font-medium">
                    Confirm Password *
                  </Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={newEmployee.confirmPassword}
                    onChange={(e) => setNewEmployee({...newEmployee, confirmPassword: e.target.value})}
                    placeholder="Confirm password"
                    className="h-10"
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter className="flex sm:justify-between">
            <Button 
              type="button"
              variant="outline"
              onClick={() => {
                setShowAddEmployeeModal(false);
                setEditingEmployee(null);
                setNewEmployee({
                  firstName: '',
                  lastName: '',
                  email: '',
                  phone: '',
                  password: '',
                  confirmPassword: '',
                  position: 'Employee',
                  countryCode: '+1',
                  roleId: '',
                  status: 'ACTIVE',
                  hireDate: new Date().toISOString().split('T')[0]
                });
              }}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button 
              type="button"
              onClick={editingEmployee ? handleUpdateEmployee : handleAddEmployee}
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white"
            >
              {editingEmployee ? 'Update Employee' : 'Create Employee'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Lead Modal */}
      <Dialog open={showAddLeadModal} onOpenChange={setShowAddLeadModal}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingLead ? 'Edit Lead' : 'Add New Lead'}</DialogTitle>
            <DialogDescription>
              {editingLead ? 'Update the lead information below.' : 'Enter the lead information below. All fields marked with * are required.'}
            </DialogDescription>
          </DialogHeader>
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
          <DialogFooter>
            <Button variant="outline" onClick={() => {
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
            }}>
              Cancel
            </Button>
            <Button onClick={editingLead ? handleUpdateLead : handleAddLead} className={editingLead ? "" : "bg-blue-600 hover:bg-blue-700"}>
              {editingLead ? (
                <>
                  Update Lead
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add Lead
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
