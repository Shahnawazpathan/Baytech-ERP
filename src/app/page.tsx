"use client"

import React, { useState, useEffect } from 'react'
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
  Cell
} from 'recharts'
import { ProtectedRoute } from '@/components/auth/protected-route'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import { useLenis } from '@/hooks/use-lenis'
import { LeadImportModal } from '@/components/LeadImportModal'
import { LeadAssignment } from '@/components/LeadAssignment'
import { GeofenceAttendance } from '@/components/GeofenceAttendance'
import { GeofenceLocationManager } from '@/components/GeofenceLocationManager'
import { TaskManagement } from '@/components/TaskManagement'
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
import { usePermissions } from '@/hooks/use-permissions'
import { io, Socket } from 'socket.io-client'

export default function Home() {
  const { user, logout } = useAuth()
  const { canViewEmployees, canCreateEmployees, canViewLeads, canCreateLeads, canViewAttendance, canCreateAttendance, canViewReports, loading: permissionsLoading } = usePermissions();
  const router = useRouter()
  const { toast } = useToast()
  const { scrollToElement, scrollToTop } = useLenis()
  const [activeTab, setActiveTab] = useState('overview')
  const [showBulkImportModal, setShowBulkImportModal] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
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

  // Helper function to check if user is admin
  const isAdmin = () => {
    if (!user) return false
    // Check by email
    if (user.email === 'admin@baytech.com') return true
    // Check by role (case-insensitive)
    if (user.role && user.role.toLowerCase().includes('admin')) return true
    return false
  }

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
          companyId: 'default-company' // This should be dynamic in a real app
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
              'x-user-id': user?.id || '',
              'x-company-id': 'default-company'
            }
          }),
          fetch('/api/roles', {
            headers: {
              'x-user-id': user?.id || '',
              'x-company-id': 'default-company'
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
  
  // Form states
  const [showAddEmployeeModal, setShowAddEmployeeModal] = useState(false)
  const [showAddLeadModal, setShowAddLeadModal] = useState(false)
  const [showGeofenceAttendance, setShowGeofenceAttendance] = useState(false)
  const [newEmployee, setNewEmployee] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    countryCode: '+1', // Default to US
    position: '',
    departmentId: '',
    roleId: 'default-role',
    address: '',
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

  // Fetch data from API
  const fetchData = async () => {
    try {
      setLoading(prev => ({ ...prev, employees: true }))
      if (canViewEmployees) {
        const employeesRes = await fetch('/api/employees', {
          headers: {
            'x-user-id': user?.id || '',
            'x-company-id': 'default-company'
          }
        })
        if (employeesRes.ok) {
          const employeesData = await employeesRes.json()
          setEmployees(employeesData)
        }
      }
      
      setLoading(prev => ({ ...prev, leads: true }))
      if (canViewLeads) {
        const leadsRes = await fetch('/api/leads', {
          headers: {
            'x-user-id': user?.id || '',
            'x-company-id': 'default-company'
          }
        })
        if (leadsRes.ok) {
          const leadsData = await leadsRes.json()
          setLeads(leadsData)
        }
      }
      
      setLoading(prev => ({ ...prev, attendance: true }))
      if (canViewAttendance) {
        const attendanceRes = await fetch('/api/attendance', {
          headers: {
            'x-user-id': user?.id || '',
            'x-company-id': 'default-company'
          }
        })
        if (attendanceRes.ok) {
          const attendanceData = await attendanceRes.json()
          setAttendanceRecords(attendanceData)
        }
      }
      
      setLoading(prev => ({ ...prev, notifications: true }))
      const notificationsRes = await fetch('/api/notifications', {
        headers: {
          'x-user-id': user?.id || '',
          'x-company-id': 'default-company'
        }
      })
      if (notificationsRes.ok) {
        const notificationsData = await notificationsRes.json()
        setNotifications(notificationsData)
        // Update unread count
        const unreadCount = notificationsData.filter(n => !n.isRead).length
        setUnreadNotifications(unreadCount)
      }
      
      setLoading(prev => ({ ...prev, stats: true }))
      if (canViewReports) {
        const statsRes = await fetch('/api/reports/overview-stats', {
          headers: {
            'x-user-id': user?.id || '',
            'x-company-id': 'default-company'
          }
        })
        if (statsRes.ok) {
          const statsData = await statsRes.json()
          setStats(statsData)
        }
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
      }))
    }
  }

  const refreshData = async () => {
    setIsRefreshing(true)
    await fetchData()
    setIsRefreshing(false)
    toast({
      title: "Data Refreshed",
      description: "All data has been updated successfully.",
    })
  }

  // Mark notification as read
  const markNotificationAsRead = async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' }
      })
      
      if (response.ok) {
        // Update local state to reflect the change
        const updatedNotifications = notifications.map(n => 
          n.id === notificationId ? { ...n, isRead: true } : n
        )
        setNotifications(updatedNotifications)
        setUnreadNotifications(prev => prev - 1)
      }
    } catch (error) {
      // Error handling would go here if needed
    }
  }

  // Mark all notifications as read
  const markAllNotificationsAsRead = async () => {
    try {
      const response = await fetch('/api/notifications/mark-all-read', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' }
      })
      
      if (response.ok) {
        // Update local state to reflect the change
        const updatedNotifications = notifications.map(n => ({ ...n, isRead: true }))
        setNotifications(updatedNotifications)
        setUnreadNotifications(0)
      }
    } catch (error) {
      // Error handling would go here if needed
    }
  }

  // Initial data fetch
  useEffect(() => {
    fetchData()
    // Also fetch reports data
    fetchReportsData()
  }, [])

  // Function to specifically fetch reports data
  const fetchReportsData = async () => {
    try {
      const reportsRes = await fetch('/api/reports', {
        headers: {
          'x-user-id': user?.id || '',
          'x-company-id': 'default-company'
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
  }

  // Refresh data when tab changes
  useEffect(() => {
    if (activeTab === 'overview') {
      fetchData() // Refresh all data for overview
    } else if (activeTab === 'analytics') {
      // Fetch reports data when on analytics tab
      fetchReportsData()
    } else {
      // Refresh specific tab data
      const refreshTabData = async () => {
        setIsRefreshing(true)
        try {
          switch (activeTab) {
            case 'employees':
              if (canViewEmployees) {
                const employeesRes = await fetch('/api/employees', {
                  headers: {
                    'x-user-id': user?.id || '',
                    'x-company-id': 'default-company'
                  }
                })
                if (employeesRes.ok) {
                  const data = await employeesRes.json()
                  setEmployees(data)
                }
              }
              break
            case 'leads':
              if (canViewLeads) {
                const leadsRes = await fetch('/api/leads', {
                  headers: {
                    'x-user-id': user?.id || '',
                    'x-company-id': 'default-company'
                  }
                })
                if (leadsRes.ok) {
                  const data = await leadsRes.json()
                  setLeads(data)
                }
              }
              break
            case 'attendance':
              if (canViewAttendance) {
                const attendanceRes = await fetch('/api/attendance', {
                  headers: {
                    'x-user-id': user?.id || '',
                    'x-company-id': 'default-company'
                  }
                })
                if (attendanceRes.ok) {
                  const data = await attendanceRes.json()
                  setAttendanceRecords(data)
                }
              }
              break
          }
        } catch (error) {
          // Error is handled by toast notification elsewhere
        } finally {
          setIsRefreshing(false)
        }
      }
      
      refreshTabData()
    }
  }, [activeTab, canViewEmployees, canViewLeads, canViewAttendance])

  // Refresh data when tab changes
  useEffect(() => {
    if (activeTab === 'overview') {
      fetchData() // Refresh all data for overview
    } else {
      // Refresh specific tab data
      const refreshTabData = async () => {
        setIsRefreshing(true)
        try {
          switch (activeTab) {
            case 'employees':
              if (canViewEmployees) {
                const employeesRes = await fetch('/api/employees', {
                  headers: {
                    'x-user-id': user?.id || '',
                    'x-company-id': 'default-company'
                  }
                })
                if (employeesRes.ok) {
                  const data = await employeesRes.json()
                  setEmployees(data)
                }
              }
              break
            case 'leads':
              if (canViewLeads) {
                const leadsRes = await fetch('/api/leads', {
                  headers: {
                    'x-user-id': user?.id || '',
                    'x-company-id': 'default-company'
                  }
                })
                if (leadsRes.ok) {
                  const data = await leadsRes.json()
                  setLeads(data)
                }
              }
              break
            case 'attendance':
              if (canViewAttendance) {
                const attendanceRes = await fetch('/api/attendance', {
                  headers: {
                    'x-user-id': user?.id || '',
                    'x-company-id': 'default-company'
                  }
                })
                if (attendanceRes.ok) {
                  const data = await attendanceRes.json()
                  setAttendanceRecords(data)
                }
              }
              break
          }
        } catch (error) {
          // Error is handled by toast notification elsewhere
        } finally {
          setIsRefreshing(false)
        }
      }
      
      refreshTabData()
    }
  }, [activeTab, canViewEmployees, canViewLeads, canViewAttendance])

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

  // Filtered data
  const filteredEmployees = employees.filter(employee => {
    const matchesSearch = (employee.name && employee.name.toLowerCase().includes(employeeFilter.search.toLowerCase())) ||
                         (employee.email && employee.email.toLowerCase().includes(employeeFilter.search.toLowerCase())) ||
                         (employee.position && employee.position.toLowerCase().includes(employeeFilter.search.toLowerCase()))
    const matchesDepartment = employeeFilter.department === 'ALL' || employee.departmentId === employeeFilter.department
    const matchesStatus = employeeFilter.status === 'ALL' || employee.status === employeeFilter.status
    
    // Role-based filtering
    let roleMatches = true;
    if (user?.role !== 'Administrator' && user?.role !== 'Manager') {
      // Employee can only see their own record
      roleMatches = employee.id === user?.id;
    }
    
    return (employeeFilter.search === '' || matchesSearch) && matchesDepartment && matchesStatus && roleMatches
  })

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = (lead.name && lead.name.toLowerCase().includes(leadFilter.search.toLowerCase())) ||
                         (lead.email && lead.email.toLowerCase().includes(leadFilter.search.toLowerCase()))
    const matchesStatus = leadFilter.status === 'ALL' || lead.status === leadFilter.status
    const matchesPriority = leadFilter.priority === 'ALL' || lead.priority === leadFilter.priority
    
    // Role-based filtering
    let roleMatches = true;
    if (user?.role !== 'Administrator' && user?.role !== 'Manager') {
      // Employee can only see leads assigned to them
      roleMatches = lead.assignedToId === user?.id || !lead.assignedToId; // Can see unassigned leads too
    }
    
    return (leadFilter.search === '' || matchesSearch) && matchesStatus && matchesPriority && roleMatches
  })

  const filteredAttendance = attendanceRecords.filter(record => {
    const matchesSearch = (record.name && record.name.toLowerCase().includes(attendanceFilter.search.toLowerCase())) ||
                         (record.department && record.department.toLowerCase().includes(attendanceFilter.search.toLowerCase())) ||
                         (record.location && record.location.toLowerCase().includes(attendanceFilter.search.toLowerCase()))
    const matchesDepartment = attendanceFilter.department === 'ALL' || record.department === attendanceFilter.department
    const matchesStatus = attendanceFilter.status === 'ALL' || record.status === attendanceFilter.status
    
    // Role-based filtering
    let roleMatches = true;
    if (user?.role !== 'Administrator' && user?.role !== 'Manager') {
      // Employee can only see their own attendance records
      roleMatches = record.employeeId === user?.id;
    }
    
    return (attendanceFilter.search === '' || matchesSearch) && matchesDepartment && matchesStatus && roleMatches
  })

  // Recent data for overview
  const recentLeads = leads.slice(0, 4).map(lead => ({
    id: lead.id,
    name: lead.name,
    amount: lead.loanAmount,
    status: lead.status,
    priority: lead.priority,
    assignedTo: lead.assignedTo
  }))

  const recentAttendance = attendanceRecords.slice(0, 4).map(record => ({
    id: record.id,
    name: record.name,
    checkIn: record.checkIn,
    status: record.status,
    location: record.location
  }))

  // Employee Management Functions
  const handleAddEmployee = async () => {
    if (newEmployee.firstName && newEmployee.email && newEmployee.position && newEmployee.departmentId) {
      try {
        const fullPhoneNumber = `${newEmployee.countryCode}${newEmployee.phone}`;
        const response = await fetch('/api/employees', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            firstName: newEmployee.firstName,
            lastName: newEmployee.lastName,
            email: newEmployee.email,
            phone: fullPhoneNumber,
            position: newEmployee.position,
            departmentId: newEmployee.departmentId,
            roleId: newEmployee.roleId,
            companyId: 'default-company', // Default company ID
            address: newEmployee.address,
            status: newEmployee.status,
            hireDate: new Date(newEmployee.hireDate).toISOString()
          })
        })

        if (response.ok) {
          const createdEmployee = await response.json()
          setEmployees([...employees, createdEmployee])
          setNewEmployee({
            firstName: '',
            lastName: '',
            email: '',
            phone: '',
            position: '',
            departmentId: '',
            roleId: 'default-role',
            address: '',
            status: 'ACTIVE',
            hireDate: new Date().toISOString().split('T')[0]
          })
          setShowAddEmployeeModal(false)
          fetchData() // Refresh data
          
          // Emit real-time event for employee update
          if (socket) {
            socket.emit('employee_update', {
              employeeId: createdEmployee.id,
              companyId: 'default-company',
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
        description: "Please fill in all required fields (First Name, Email, Position, Department)",
        variant: "destructive",
      })
    }
  }

  const handleExportEmployees = () => {
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
  }

  // Function to handle editing an employee
  const handleEditEmployeeClick = async (employee: any) => {
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
      countryCode: countryCode,
      position: employee.position,
      departmentId: employee.departmentId || employee.department,
      roleId: employee.roleId || 'default-role',
      address: employee.address || '',
      status: employee.status,
      hireDate: employee.hireDate ? new Date(employee.hireDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
    });
    setShowAddEmployeeModal(true);
  };

  // Function to update an employee
  const handleUpdateEmployee = async () => {
    if (editingEmployee && newEmployee.firstName && newEmployee.email && newEmployee.position && newEmployee.departmentId) {
      try {
        const fullPhoneNumber = `${newEmployee.countryCode}${newEmployee.phone}`;
        const response = await fetch(`/api/employees/${editingEmployee.id}`, {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json',
            'x-user-id': user?.id || '',
            'x-company-id': 'default-company'
          },
          body: JSON.stringify({
            firstName: newEmployee.firstName,
            lastName: newEmployee.lastName,
            email: newEmployee.email,
            phone: fullPhoneNumber,
            position: newEmployee.position,
            departmentId: newEmployee.departmentId,
            roleId: newEmployee.roleId,
            companyId: 'default-company',
            address: newEmployee.address,
            status: newEmployee.status,
            hireDate: new Date(newEmployee.hireDate).toISOString()
          })
        })

        if (response.ok) {
          const updatedEmployee = await response.json()
          setEmployees(employees.map(emp => 
            emp.id === updatedEmployee.id ? updatedEmployee : emp
          ))
          setEditingEmployee(null);
          setNewEmployee({
            firstName: '',
            lastName: '',
            email: '',
            phone: '',
            position: '',
            departmentId: '',
            roleId: 'default-role',
            address: '',
            status: 'ACTIVE',
            hireDate: new Date().toISOString().split('T')[0]
          });
          setShowAddEmployeeModal(false);
          
          // Emit real-time event for employee update
          if (socket) {
            socket.emit('employee_update', {
              employeeId: updatedEmployee.id,
              companyId: 'default-company',
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
  };

  // Function to toggle employee status (activate/deactivate)
  const toggleEmployeeStatus = async (employeeId: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      const response = await fetch(`/api/employees/${employeeId}/status`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': user?.id || '',
          'x-company-id': 'default-company'
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (response.ok) {
        const updatedEmployee = await response.json();
        setEmployees(employees.map(emp => 
          emp.id === employeeId ? updatedEmployee : emp
        ));
        
        // Emit real-time event for employee status update
        if (socket) {
          socket.emit('employee_update', {
            employeeId,
            companyId: 'default-company',
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
                companyId: 'default-company', // Default company ID
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
      // Send all imported leads to the backend
      for (const lead of importedLeads) {
        const response = await fetch('/api/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...lead,
            firstName: lead.firstName,
            lastName: lead.lastName,
            email: lead.email || '',
            phone: lead.phone,
            loanAmount: parseFloat(lead.loanAmount) || 0,
            status: lead.status || "NEW",
            priority: lead.priority || "MEDIUM",
            assignedToId: lead.assignedToId || null,
            propertyAddress: lead.propertyAddress || '',
            creditScore: parseInt(lead.creditScore) || 0,
            source: lead.source || 'Import',
            companyId: 'default-company',
            notes: lead.notes || ''
          })
        });
        
        if (!response.ok) {
          throw new Error(`Failed to import lead: ${response.statusText}`);
        }
      }
      
      // Refresh data from backend to get all leads
      await fetchData();
      
      toast({
        title: "Bulk Import Successful",
        description: `Successfully imported ${importedLeads.length} leads`,
        duration: 4000,
      });
    } catch (error) {
      toast({
        title: "Import Failed",
        description: "Failed to import some leads. Please try again.",
        variant: "destructive",
        duration: 4000,
      });
    }
  }

  // Function to handle editing a lead
  const handleEditLeadClick = async (lead: any) => {
    setEditingLead(lead);
    setNewLead({
      firstName: lead.firstName || lead.name.split(' ')[0],
      lastName: lead.lastName || lead.name.split(' ').slice(1).join(' ') || '',
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
            'x-user-id': user?.id || '',
            'x-company-id': 'default-company'
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
            companyId: 'default-company',
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
              companyId: 'default-company',
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
      const statusOrder = ['NEW', 'CONTACTED', 'QUALIFIED', 'APPLICATION', 'APPROVED', 'REJECTED', 'CLOSED'];
      const currentIndex = statusOrder.indexOf(currentStatus);
      const nextIndex = (currentIndex + 1) % statusOrder.length;
      const newStatus = statusOrder[nextIndex];
      
      const response = await fetch(`/api/leads/${leadId}/status`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': user?.id || '',
          'x-company-id': 'default-company'
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
            companyId: 'default-company',
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
          'x-user-id': user?.id || '',
          'x-company-id': 'default-company'
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
            companyId: 'default-company',
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
          'x-user-id': user?.id || '',
          'x-company-id': 'default-company'
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
            companyId: 'default-company',
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
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                ...lead,
                firstName: lead.name.split(' ')[0],
                lastName: lead.name.split(' ').slice(1).join(' ') || '',
                companyId: 'default-company'
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
          headers: { 'Content-Type': 'application/json' },
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
            companyId: 'default-company'
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
              companyId: 'default-company',
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
          employeeId: user?.id || 'default-employee',
          companyId: 'default-company',
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
            employeeId: user?.id || 'default-employee',
            companyId: 'default-company',
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
          employeeId: user?.id || 'default-employee',
          companyId: 'default-company',
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
            employeeId: user?.id || 'default-employee',
            companyId: 'default-company',
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
          'x-user-id': user?.id || '',
          'x-company-id': 'default-company'
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
            companyId: 'default-company',
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
          'x-user-id': user?.id || '',
          'x-company-id': 'default-company'
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

  // Analytics Functions
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
    const totalLeads = leads.length
    const convertedLeads = leads.filter(lead => lead.status === 'APPLICATION').length
    const conversionRate = ((convertedLeads / totalLeads) * 100).toFixed(2)
    const totalLoanAmount = leads.reduce((sum, lead) => sum + (lead.loanAmount || 0), 0)
    
    return `Sales Report
Generated: ${new Date().toLocaleDateString()}

Total Leads: ${totalLeads}
Converted Leads: ${convertedLeads}
Conversion Rate: ${conversionRate}%
Total Loan Amount: $${totalLoanAmount.toLocaleString()}
Average Loan Amount: $${Math.round(totalLoanAmount / totalLeads).toLocaleString()}

Lead Status Breakdown:
${leads.reduce((acc, lead) => {
  acc[lead.status] = (acc[lead.status] || 0) + 1
  return acc
}, {} as Record<string, number>).map((count, status) => `${status}: ${count}`).join('\n')}
`
  }

  const generateEmployeePerformanceReport = () => {
    const activeEmployees = employees.filter(emp => emp.status === 'ACTIVE').length
    const onLeaveEmployees = employees.filter(emp => emp.status === 'ON_LEAVE').length
    
    return `Employee Performance Report
Generated: ${new Date().toLocaleDateString()}

Total Employees: ${employees.length}
Active Employees: ${activeEmployees}
Employees on Leave: ${onLeaveEmployees}

Department Breakdown:
${employees.reduce((acc, emp) => {
  acc[emp.department] = (acc[emp.department] || 0) + 1
  return acc
}, {} as Record<string, number>).map((count, dept) => `${dept}: ${count}`).join('\n')}

Attendance Overview:
Present: ${attendanceRecords.filter(r => r.status === 'PRESENT').length}
Late: ${attendanceRecords.filter(r => r.status === 'LATE').length}
Absent: ${attendanceRecords.filter(r => r.status === 'ABSENT').length}
`
  }

  const generateLeadConversionReport = () => {
    const statusBreakdown = leads.reduce((acc, lead) => {
      acc[lead.status] = (acc[lead.status] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return `Lead Conversion Analysis
Generated: ${new Date().toLocaleDateString()}

Total Leads: ${leads.length}

Status Breakdown:
${Object.entries(statusBreakdown).map(([status, count]) => `${status}: ${count} (${((count / leads.length) * 100).toFixed(1)}%)`).join('\n')}

Priority Distribution:
High: ${leads.filter(l => l.priority === 'HIGH').length}
Medium: ${leads.filter(l => l.priority === 'MEDIUM').length}
Low: ${leads.filter(l => l.priority === 'LOW').length}

Average Credit Score: ${Math.round(leads.reduce((sum, lead) => sum + (lead.creditScore || 0), 0) / leads.length)}
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
          employeeId: user?.id || 'default-employee',
          companyId: 'default-company',
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
          employeeId: user?.id || 'default-employee',
          companyId: 'default-company',
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
      <div className="flex h-screen bg-gray-50 transition-colors duration-200">

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
        bg-white border-r border-gray-200
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
            <Building2 className="h-8 w-8 text-blue-600 flex-shrink-0" />
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
                className="w-full justify-start gap-2 bg-gradient-to-r from-red-50 to-rose-50 border-red-200 text-red-600 hover:from-red-100 hover:to-rose-100 hover:text-red-700 hover:border-red-300 transition-all duration-200 transform hover:scale-[1.02] shadow-sm hover:shadow-md"
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
          <div className="flex items-center justify-between gap-3">
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
            <div className="flex items-center gap-2 flex-shrink-0">
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
        <main className="flex-1 overflow-y-auto p-6" data-lenis-prevent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-7">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="employees">Employees</TabsTrigger>
              <TabsTrigger value="leads">Leads</TabsTrigger>
              <TabsTrigger value="attendance">Attendance</TabsTrigger>
              <TabsTrigger value="tasks">Tasks</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
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
                                  <AvatarFallback>{lead.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
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
              <div className="space-y-6">
                {/* Employee Management Header */}
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Employee Management</h2>
                    <p className="text-sm text-gray-500">Manage your workforce and organizational structure</p>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline"
                      onClick={handleExportEmployees}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Export
                    </Button>
                    <Button 
                      onClick={handleAddEmployeeClick}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      Add Employee
                    </Button>
                  </div>
                </div>

                {/* Employee Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{employees.length}</div>
                      <p className="text-xs text-muted-foreground">+{employees.filter(e => e.hireDate && new Date(e.hireDate) >= new Date(new Date().setDate(new Date().getDate() - 30))).length} this month</p>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Active Employees</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{employees.filter(e => e.status === 'ACTIVE').length}</div>
                      <p className="text-xs text-muted-foreground">{employees.length ? Math.round((employees.filter(e => e.status === 'ACTIVE').length / employees.length) * 100) : 0}% active rate</p>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Departments</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{departments.length}</div>
                      <p className="text-xs text-muted-foreground">Sales, Support, IT, etc.</p>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Open Positions</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">8</div>
                      <p className="text-xs text-muted-foreground">Actively recruiting</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Employee List */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Employee Directory</CardTitle>
                        <CardDescription>View and manage all employees</CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <Input
                            type="text"
                            placeholder="Search employees..."
                            value={employeeFilter.search}
                            onChange={(e) => setEmployeeFilter({...employeeFilter, search: e.target.value})}
                            className="pl-10 pr-4 py-2 border border-gray-300 rounded-md text-sm w-64"
                          />
                        </div>
                        <Select value={employeeFilter.department} onValueChange={(value) => setEmployeeFilter({...employeeFilter, department: value})}>
                          <SelectTrigger className="w-40">
                            <SelectValue placeholder="Department" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ALL">All Departments</SelectItem>
                            {departments.map((dept) => (
                              <SelectItem key={dept.id} value={dept.id}>
                                {dept.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select value={employeeFilter.status} onValueChange={(value) => setEmployeeFilter({...employeeFilter, status: value})}>
                          <SelectTrigger className="w-32">
                            <SelectValue placeholder="Status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ALL">All Status</SelectItem>
                            <SelectItem value="ACTIVE">Active</SelectItem>
                            <SelectItem value="ON_LEAVE">On Leave</SelectItem>
                          </SelectContent>
                        </Select>
                        {employeeFilter.search || employeeFilter.department !== 'ALL' || employeeFilter.status !== 'ALL' ? (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setEmployeeFilter({ search: '', department: 'ALL', status: 'ALL' })}
                          >
                            <X className="h-4 w-4 mr-2" />
                            Clear
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {loading.employees ? (
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
                            <div className="h-6 bg-gray-200 rounded w-16" />
                            <div className="h-6 bg-gray-200 rounded w-16 ml-2" />
                            <div className="h-6 bg-gray-200 rounded w-20 ml-2" />
                            <div className="h-8 bg-gray-200 rounded w-32 ml-2 flex gap-2" />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left p-3">Employee</th>
                              <th className="text-left p-3">Position</th>
                              <th className="text-left p-3">Department</th>
                              <th className="text-left p-3">Status</th>
                              <th className="text-left p-3">Hire Date</th>
                              <th className="text-left p-3">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredEmployees.map((employee) => (
                              <tr key={employee.id} className="border-b hover:bg-gray-50 transition-colors">
                                <td className="p-3">
                                  <div className="flex items-center gap-3">
                                    <Avatar>
                                      <AvatarFallback>{employee.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                      <p className="font-medium">{employee.name}</p>
                                      <p className="text-sm text-gray-500">{employee.email}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="p-3">{employee.position}</td>
                                <td className="p-3">{employee.department}</td>
                                <td className="p-3">
                                  <Badge className={getStatusColor(employee.status)}>
                                    {employee.status}
                                  </Badge>
                                </td>
                                <td className="p-3">{employee.hireDate ? new Date(employee.hireDate).toLocaleDateString() : 'N/A'}</td>
                                <td className="p-3">
                                  <div className="flex gap-2">
                                    <Button 
                                      variant="outline" 
                                      size="sm"
                                      onClick={() => toggleEmployeeStatus(employee.id, employee.status)}
                                    >
                                      {employee.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                                    </Button>
                                    <Button 
                                      variant="ghost" 
                                      size="sm"
                                      onClick={() => handleEditEmployeeClick(employee)}
                                    >
                                      Edit
                                    </Button>
                                    <Button 
                                      variant="ghost" 
                                      size="sm"
                                      onClick={() => handleViewEmployeeClick(employee)}
                                    >
                                      View
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                            {filteredEmployees.length === 0 && (
                              <tr>
                                <td colSpan={6} className="p-3 text-center text-gray-500">
                                  No employees found
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="leads">
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
                        onClick={() => setShowBulkImportModal(true)}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Import
                      </Button>
                    )}
                    <Button 
                      onClick={handleAddLeadClick}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      Add Lead
                    </Button>
                  </div>
                </div>

                {/* Lead Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card className="border-l-4 border-l-blue-500">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-gray-600">Total Leads</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-gray-900">{leads.length}</div>
                      <p className="text-xs text-green-600">+{leads.filter(l => l.createdAt && new Date(l.createdAt) >= new Date(new Date().setDate(new Date().getDate() - 30))).length} this month</p>
                    </CardContent>
                  </Card>
                  
                  <Card className="border-l-4 border-l-green-500">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-gray-600">Active Leads</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-gray-900">{leads.filter(l => !['APPLICATION', 'REJECTED', 'CLOSED'].includes(l.status)).length}</div>
                      <p className="text-xs text-gray-500">In pipeline</p>
                    </CardContent>
                  </Card>
                  
                  <Card className="border-l-4 border-l-purple-500">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-gray-600">Converted</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-gray-900">{leads.filter(l => l.status === 'APPLICATION' || l.status === 'APPROVED').length}</div>
                      <p className="text-xs text-green-600">{leads.length ? Math.round((leads.filter(l => l.status === 'APPLICATION' || l.status === 'APPROVED').length / leads.length) * 100) : 0}% conversion</p>
                    </CardContent>
                  </Card>
                  
                  <Card className="border-l-4 border-l-orange-500">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-gray-600">High Priority</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-gray-900">{leads.filter(l => l.priority === 'HIGH' || l.priority === 'URGENT').length}</div>
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
                    {loading.leads ? (
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
                            {filteredLeads.map((lead) => {
                              // Calculate the 2-hour contact deadline if assigned
                              const contactDeadline = lead.assignedAt ? new Date(new Date(lead.assignedAt).getTime() + 2 * 60 * 60 * 1000) : null;
                              const isOverdue = contactDeadline && new Date() > contactDeadline && !lead.contactedAt;

                              return (
                                <tr key={lead.id} className={`border-b hover:bg-gray-50 transition-colors ${isOverdue ? 'bg-red-50' : ''}`}>
                                  <td className="p-3">
                                    <div className="flex items-center gap-3">
                                      <Avatar>
                                        <AvatarFallback>{lead.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
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
                                    {((user?.role === 'Administrator' || user?.role === 'Manager') && canViewEmployees) ? (
                                      <LeadAssignment 
                                        lead={lead}
                                        employees={employees}
                                        onAssign={assignLeadToEmployee}
                                        disabled={loading.leads}
                                      />
                                    ) : (
                                      <span>{lead.assignedTo || 'Unassigned'}</span>
                                    )}
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
                                      {lead.assignedToId && (user?.id === lead.assignedToId || user?.role === 'Administrator' || user?.role === 'Manager') && (
                                        <Button 
                                          variant="outline"
                                          size="sm"
                                          onClick={() => markLeadAsContacted(lead.id)}
                                        >
                                          Mark as Contacted
                                        </Button>
                                      )}
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
                                      <Button 
                                        variant="ghost" 
                                        size="sm"
                                        onClick={() => handleViewLeadClick(lead)}
                                      >
                                        View
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
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="attendance">
              <div className="space-y-6">
                {/* Admin: Geofence Location Management */}
                {isAdmin() && (
                  <GeofenceLocationManager companyId="default-company" />
                )}

                {/* Geofence Attendance Section */}
                {showGeofenceAttendance && (
                  <GeofenceAttendance
                    companyId="default-company"
                    employeeId={user?.id || 'current-user'}
                    onCheckIn={handleAttendanceCheckIn}
                    onCheckOut={handleAttendanceCheckOut}
                  />
                )}
                {/* Attendance Header */}
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Attendance Tracking</h2>
                    <p className="text-sm text-gray-500">Employee attendance and time tracking</p>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline"
                      onClick={handleExportAttendance}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Export
                    </Button>
                    <Button 
                      onClick={handleGeofenceAttendanceClick}
                      className={`${showGeofenceAttendance ? 'bg-gray-600 hover:bg-gray-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                    >
                      <Map className="h-4 w-4 mr-2" />
                      {showGeofenceAttendance ? 'Hide' : 'Show'} Geofence
                    </Button>
                    <Button 
                      onClick={handleCheckIn}
                      disabled={checkInStatus === 'checking'}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {checkInStatus === 'checking' ? (
                        <Clock className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Map className="h-4 w-4 mr-2" />
                      )}
                      Quick Check In
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={handleCheckOut}
                      disabled={checkInStatus === 'checking'}
                      className="border-red-500 text-red-600 hover:bg-red-50"
                    >
                      {checkInStatus === 'checking' ? (
                        <Clock className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Navigation className="h-4 w-4 mr-2" />
                      )}
                      Check Out
                    </Button>
                  </div>
                </div>

                {/* Attendance Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card className="border-l-4 border-l-green-500">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-gray-600">Present Today</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-gray-900">{attendanceRecords.filter(a => a.status === 'PRESENT').length}</div>
                      <p className="text-xs text-green-600">{attendanceRecords.length ? Math.round((attendanceRecords.filter(a => a.status === 'PRESENT').length / attendanceRecords.length) * 100) : 0}% attendance</p>
                    </CardContent>
                  </Card>
                  
                  <Card className="border-l-4 border-l-yellow-500">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-gray-600">Late Arrivals</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-gray-900">{attendanceRecords.filter(a => a.status === 'LATE').length}</div>
                      <p className="text-xs text-yellow-600">{attendanceRecords.length ? Math.round((attendanceRecords.filter(a => a.status === 'LATE').length / attendanceRecords.length) * 100) : 0}% late rate</p>
                    </CardContent>
                  </Card>
                  
                  <Card className="border-l-4 border-l-blue-500">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-gray-600">On Leave</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-gray-900">{attendanceRecords.filter(a => a.status === 'ON_LEAVE').length}</div>
                      <p className="text-xs text-blue-600">Approved leave</p>
                    </CardContent>
                  </Card>
                  
                  <Card className="border-l-4 border-l-red-500">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-gray-600">Absent</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-gray-900">{attendanceRecords.filter(a => a.status === 'ABSENT').length}</div>
                      <p className="text-xs text-red-600">Unexcused</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Attendance List */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Today's Attendance</CardTitle>
                        <CardDescription>Real-time attendance status</CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <div className="flex gap-2">
                          <div className="relative">
                            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                            <Input
                              placeholder="Search employees..."
                              value={attendanceFilter.search}
                              onChange={(e) => setAttendanceFilter({...attendanceFilter, search: e.target.value})}
                              className="pl-10 w-64"
                            />
                          </div>
                          <Select value={attendanceFilter.department} onValueChange={(value) => setAttendanceFilter({...attendanceFilter, department: value})}>
                            <SelectTrigger className="w-40">
                              <SelectValue placeholder="Department" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ALL">All Departments</SelectItem>
                              <SelectItem value="Sales">Sales</SelectItem>
                              <SelectItem value="IT">IT</SelectItem>
                              <SelectItem value="HR">HR</SelectItem>
                              <SelectItem value="Support">Support</SelectItem>
                              <SelectItem value="Administration">Administration</SelectItem>
                            </SelectContent>
                          </Select>
                          <Select value={attendanceFilter.status} onValueChange={(value) => setAttendanceFilter({...attendanceFilter, status: value})}>
                            <SelectTrigger className="w-32">
                              <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ALL">All Status</SelectItem>
                              <SelectItem value="PRESENT">Present</SelectItem>
                              <SelectItem value="LATE">Late</SelectItem>
                              <SelectItem value="ABSENT">Absent</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {loading.attendance ? (
                      <div className="space-y-4">
                        {[...Array(5)].map((_, index) => (
                          <div key={index} className="flex items-center p-3 border-b animate-pulse">
                            <div className="flex items-center gap-3 flex-1">
                              <div className="bg-gray-200 rounded-full h-10 w-10" />
                              <div className="space-y-2">
                                <div className="h-4 bg-gray-200 rounded w-32" />
                              </div>
                            </div>
                            <div className="h-4 bg-gray-200 rounded w-20" />
                            <div className="h-4 bg-gray-200 rounded w-16" />
                            <div className="h-4 bg-gray-200 rounded w-16" />
                            <div className="h-6 bg-gray-200 rounded w-16" />
                            <div className="h-6 bg-gray-200 rounded w-24" />
                            <div className="h-8 bg-gray-200 rounded w-32 ml-2 flex gap-2" />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left p-3">Employee</th>
                              <th className="text-left p-3">Department</th>
                              <th className="text-left p-3">Check In</th>
                              <th className="text-left p-3">Check Out</th>
                              <th className="text-left p-3">Status</th>
                              <th className="text-left p-3">Location</th>
                              <th className="text-left p-3">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredAttendance.map((record) => (
                              <tr key={record.id} className="border-b hover:bg-gray-50 transition-colors">
                                <td className="p-3">
                                  <div className="flex items-center gap-3">
                                    <Avatar>
                                      <AvatarFallback>{record.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                      <p className="font-medium">{record.name}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="p-3">{record.department}</td>
                                <td className="p-3">{record.checkIn}</td>
                                <td className="p-3">{record.checkOut}</td>
                                <td className="p-3">
                                  <Badge className={getStatusColor(record.status)}>
                                    {record.status}
                                  </Badge>
                                </td>
                                <td className="p-3">
                                  <Badge variant="outline">
                                    <MapPin className="h-3 w-3 mr-1" />
                                    {record.location}
                                  </Badge>
                                </td>
                                <td className="p-3">
                                  <div className="flex gap-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleViewAttendanceClick(record)}
                                    >
                                      View
                                    </Button>
                                    {/* Admin only buttons */}
                                    {isAdmin() && (
                                      <>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleEditAttendanceClick(record)}
                                        >
                                          Edit
                                        </Button>
                                        <Button
                                          variant="destructive"
                                          size="sm"
                                          onClick={() => handleDeleteAttendance(record.id)}
                                        >
                                          Delete
                                        </Button>
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                            {filteredAttendance.length === 0 && (
                              <tr>
                                <td colSpan={7} className="p-3 text-center text-gray-500">
                                  No attendance records found
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Edit Attendance Dialog */}
                {editingAttendance && (
                  <Dialog open={!!editingAttendance} onOpenChange={(open) => !open && setEditingAttendance(null)}>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>Edit Attendance Record</DialogTitle>
                        <DialogDescription>
                          Update attendance details for {editingAttendance.name}
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Employee Name</Label>
                            <Input value={editingAttendance.name} disabled />
                          </div>
                          <div>
                            <Label>Department</Label>
                            <Input value={editingAttendance.department} disabled />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="checkInTime">Check In Time</Label>
                            <Input
                              id="checkInTime"
                              type="datetime-local"
                              value={editingAttendance.checkInTime ? new Date(editingAttendance.checkInTime).toISOString().slice(0, 16) : ''}
                              onChange={(e) => setEditingAttendance({
                                ...editingAttendance,
                                checkInTime: e.target.value ? new Date(e.target.value).toISOString() : null
                              })}
                            />
                          </div>
                          <div>
                            <Label htmlFor="checkOutTime">Check Out Time</Label>
                            <Input
                              id="checkOutTime"
                              type="datetime-local"
                              value={editingAttendance.checkOutTime ? new Date(editingAttendance.checkOutTime).toISOString().slice(0, 16) : ''}
                              onChange={(e) => setEditingAttendance({
                                ...editingAttendance,
                                checkOutTime: e.target.value ? new Date(e.target.value).toISOString() : null
                              })}
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="status">Status</Label>
                            <Select
                              value={editingAttendance.status}
                              onValueChange={(value) => setEditingAttendance({
                                ...editingAttendance,
                                status: value
                              })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select status" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="PRESENT">Present</SelectItem>
                                <SelectItem value="LATE">Late</SelectItem>
                                <SelectItem value="ABSENT">Absent</SelectItem>
                                <SelectItem value="HALF_DAY">Half Day</SelectItem>
                                <SelectItem value="ON_LEAVE">On Leave</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label htmlFor="location">Location</Label>
                            <Input
                              id="location"
                              value={editingAttendance.location || ''}
                              onChange={(e) => setEditingAttendance({
                                ...editingAttendance,
                                location: e.target.value
                              })}
                              placeholder="Work location"
                            />
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="notes">Notes</Label>
                          <Input
                            id="notes"
                            value={editingAttendance.notes || ''}
                            onChange={(e) => setEditingAttendance({
                              ...editingAttendance,
                              notes: e.target.value
                            })}
                            placeholder="Additional notes"
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button
                          variant="outline"
                          onClick={() => setEditingAttendance(null)}
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={() => {
                            handleUpdateAttendance(editingAttendance.id, {
                              checkInTime: editingAttendance.checkInTime,
                              checkOutTime: editingAttendance.checkOutTime,
                              status: editingAttendance.status,
                              checkInAddress: editingAttendance.location,
                              notes: editingAttendance.notes
                            })
                            setEditingAttendance(null)
                          }}
                        >
                          Save Changes
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </TabsContent>

            <TabsContent value="tasks">
              <div className="space-y-6">
                <TaskManagement
                  companyId="default-company"
                  userId={user?.id}
                  userRole={user?.role}
                />
              </div>
            </TabsContent>



            <TabsContent value="analytics">
              <div className="space-y-6">
                {/* Analytics Header */}
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Analytics & Reports</h2>
                    <p className="text-sm text-gray-500">Business intelligence and reporting</p>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline"
                      onClick={() => handleGenerateReport('Sales')}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Sales Report
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => handleGenerateReport('Employee Performance')}
                    >
                      <Users className="h-4 w-4 mr-2" />
                      Employee Report
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => handleGenerateReport('Lead Conversion')}
                    >
                      <TrendingUp className="h-4 w-4 mr-2" />
                      Lead Analysis
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={async () => {
                        try {
                          const reportsRes = await fetch('/api/reports', {
                            headers: {
                              'x-user-id': user?.id || '',
                              'x-company-id': 'default-company'
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
                          } else {
                            // Fallback to local data
                            const csvContent = [
                              ['Report Name', 'Type', 'Generated Date', 'Status'],
                              ...reports.map(report => [
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
                              description: `Exported ${reports.length} reports successfully`,
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
                      Export Reports
                    </Button>
                  </div>
                </div>

                {/* Analytics Overview */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Card className={loading.stats ? "opacity-70 animate-pulse" : ""}>
                    <CardHeader>
                      <CardTitle>Lead Conversion Rate</CardTitle>
                      <CardDescription>Monthly conversion trends</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-green-600">{stats.conversionRate}%</div>
                      <p className="text-sm text-gray-500">+2.1% from last month</p>
                    </CardContent>
                  </Card>
                  
                  <Card className={loading.stats ? "opacity-70 animate-pulse" : ""}>
                    <CardHeader>
                      <CardTitle>Average Response Time</CardTitle>
                      <CardDescription>Time to first contact</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-blue-600">2.3h</div>
                      <p className="text-sm text-gray-500">-30m improvement</p>
                    </CardContent>
                  </Card>
                  
                  <Card className={loading.stats ? "opacity-70 animate-pulse" : ""}>
                    <CardHeader>
                      <CardTitle>Employee Productivity</CardTitle>
                      <CardDescription>Leads per employee</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-purple-600">{stats.totalLeads && stats.totalEmployees ? Math.round(stats.totalLeads / stats.totalEmployees * 100) / 100 : 0}</div>
                      <p className="text-sm text-gray-500">+3.2 from average</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Charts Section with Real Data */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Lead Sources Pie Chart */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Lead Sources</CardTitle>
                      <CardDescription>Where your leads come from</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {leads.length > 0 ? (
                        <div className="h-80">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={[
                                  { 
                                    name: "Website", 
                                    value: leads.filter(lead => lead.source === "Website").length,
                                    count: leads.filter(lead => lead.source === "Website").length
                                  },
                                  { 
                                    name: "Referral", 
                                    value: leads.filter(lead => lead.source === "Referral").length,
                                    count: leads.filter(lead => lead.source === "Referral").length
                                  },
                                  { 
                                    name: "Social Media", 
                                    value: leads.filter(lead => lead.source === "Social Media").length,
                                    count: leads.filter(lead => lead.source === "Social Media").length
                                  },
                                  { 
                                    name: "Email Campaign", 
                                    value: leads.filter(lead => lead.source === "Email Campaign").length,
                                    count: leads.filter(lead => lead.source === "Email Campaign").length
                                  },
                                  { 
                                    name: "Other", 
                                    value: leads.filter(lead => !["Website", "Referral", "Social Media", "Email Campaign"].includes(lead.source || "")).length,
                                    count: leads.filter(lead => !["Website", "Referral", "Social Media", "Email Campaign"].includes(lead.source || "")).length
                                  }
                                ]}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                outerRadius={80}
                                fill="#8884d8"
                                dataKey="value"
                                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                              >
                                {[
                                  "#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8"
                                ].map((color, index) => (
                                  <Cell key={`cell-${index}`} fill={color} />
                                ))}
                              </Pie>
                              <Tooltip formatter={(value) => [`${value} leads`, 'Count']} />
                              <Legend />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <div className="text-center py-10 text-gray-500">
                          No lead data available
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Department Performance Bar Chart */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Department Performance</CardTitle>
                      <CardDescription>Leads handled by department</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {employees.length > 0 ? (
                        <div className="h-80">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={Array.from(new Set(employees.map(emp => emp.department))).map(deptName => {
                                const deptEmployees = employees.filter(emp => emp.department === deptName);
                                const deptLeads = leads.filter(lead => 
                                  deptEmployees.some(emp => emp.id === lead.assignedToId)
                                );
                                const convertedLeads = deptLeads.filter(lead => lead.status === 'APPLICATION').length;
                                const conversionRate = deptLeads.length > 0 ? (convertedLeads / deptLeads.length) * 100 : 0;
                                
                                return {
                                  department: deptName,
                                  leads: deptLeads.length,
                                  converted: convertedLeads,
                                  rate: parseFloat(conversionRate.toFixed(1))
                                };
                              })}
                              margin={{
                                top: 20,
                                right: 30,
                                left: 20,
                                bottom: 60,
                              }}
                            >
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis 
                                dataKey="department" 
                                angle={-45} 
                                textAnchor="end"
                                height={60}
                                tick={{ fontSize: 12 }}
                              />
                              <YAxis />
                              <Tooltip 
                                formatter={(value, name) => {
                                  if (name === 'rate') return [`${value}%`, 'Conversion Rate'];
                                  return [value, name === 'leads' ? 'Leads' : 'Converted'];
                                }}
                              />
                              <Legend />
                              <Bar dataKey="leads" name="Assigned Leads" fill="#8884d8" />
                              <Bar dataKey="converted" name="Converted Leads" fill="#82ca9d" />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <div className="text-center py-10 text-gray-500">
                          No employee data available
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
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
              <Label htmlFor="position" className="text-sm font-medium">
                Position *
              </Label>
              <Input
                id="position"
                value={newEmployee.position}
                onChange={(e) => setNewEmployee({...newEmployee, position: e.target.value})}
                placeholder="Enter position"
                className="h-10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="departmentId" className="text-sm font-medium">
                Department *
              </Label>
              <Select value={newEmployee.departmentId} onValueChange={(value) => setNewEmployee({...newEmployee, departmentId: value})}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="address" className="text-sm font-medium">
                Address
              </Label>
              <Input
                id="address"
                value={newEmployee.address}
                onChange={(e) => setNewEmployee({...newEmployee, address: e.target.value})}
                placeholder="Enter address"
                className="h-10"
              />
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
                  countryCode: '+1',
                  position: '',
                  departmentId: '',
                  roleId: 'default-role',
                  address: '',
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