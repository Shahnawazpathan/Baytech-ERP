"use client"

import React, { useState } from 'react'
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
import { ProtectedRoute } from '@/components/auth/protected-route'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
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
  LogOut
} from 'lucide-react'

export default function Home() {
  const { user, logout } = useAuth()
  const router = useRouter()
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState('overview')
  const [notifications, setNotifications] = useState([
    { id: 1, title: 'New lead assigned', message: 'John Smith - $450,000 mortgage', type: 'info', time: '2 min ago' },
    { id: 2, title: 'Attendance alert', message: '3 employees haven\'t checked in', type: 'warning', time: '15 min ago' },
    { id: 3, title: 'Lead converted', message: 'Sarah Johnson application approved', type: 'success', time: '1 hour ago' }
  ])

  // Employee Management State
  const [employees, setEmployees] = useState([
    {
      id: 1,
      name: "Alice Johnson",
      email: "alice@company.com",
      position: "Sales Manager",
      department: "Sales",
      status: "ACTIVE",
      hireDate: "2022-01-15",
      phone: "555-0101",
      address: "123 Main St, City, State"
    },
    {
      id: 2,
      name: "Bob Smith",
      email: "bob@company.com",
      position: "Software Developer",
      department: "IT",
      status: "ACTIVE",
      hireDate: "2022-03-20",
      phone: "555-0102",
      address: "456 Oak Ave, City, State"
    },
    {
      id: 3,
      name: "Carol Brown",
      email: "carol@company.com",
      position: "HR Specialist",
      department: "HR",
      status: "ON_LEAVE",
      hireDate: "2021-11-10",
      phone: "555-0103",
      address: "789 Pine Rd, City, State"
    },
    {
      id: 4,
      name: "David Lee",
      email: "david@company.com",
      position: "Support Agent",
      department: "Support",
      status: "ACTIVE",
      hireDate: "2023-02-01",
      phone: "555-0104",
      address: "321 Elm St, City, State"
    }
  ])

  const [showAddEmployeeModal, setShowAddEmployeeModal] = useState(false)
  const [employeeFilter, setEmployeeFilter] = useState({
    search: '',
    department: 'ALL',
    status: 'ALL'
  })

  // Lead Management State
  const [leads, setLeads] = useState([
    {
      id: 1,
      name: "John Smith",
      email: "john@email.com",
      phone: "555-1234",
      loanAmount: 450000,
      status: "NEW",
      priority: "HIGH",
      assignedTo: "Alice Johnson",
      propertyAddress: "123 Main St, City, State",
      creditScore: 750
    },
    {
      id: 2,
      name: "Sarah Johnson",
      email: "sarah@email.com",
      phone: "555-5678",
      loanAmount: 320000,
      status: "QUALIFIED",
      priority: "MEDIUM",
      assignedTo: "Bob Smith",
      propertyAddress: "456 Oak Ave, City, State",
      creditScore: 680
    },
    {
      id: 3,
      name: "Mike Davis",
      email: "mike@email.com",
      phone: "555-9012",
      loanAmount: 680000,
      status: "APPLICATION",
      priority: "HIGH",
      assignedTo: "Carol Brown",
      propertyAddress: "789 Pine Rd, City, State",
      creditScore: 720
    },
    {
      id: 4,
      name: "Emily Wilson",
      email: "emily@email.com",
      phone: "555-3456",
      loanAmount: 290000,
      status: "CONTACTED",
      priority: "LOW",
      assignedTo: "David Lee",
      propertyAddress: "321 Elm St, City, State",
      creditScore: 710
    }
  ])

  const [leadFilter, setLeadFilter] = useState({
    search: '',
    status: 'ALL',
    priority: 'ALL'
  })

  // Lead Form State
  const [showAddLeadModal, setShowAddLeadModal] = useState(false)
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

  // Attendance Management State
  const [attendanceRecords, setAttendanceRecords] = useState([
    {
      id: 1,
      name: "Alice Johnson",
      department: "Sales",
      checkIn: "09:00 AM",
      checkOut: "05:30 PM",
      status: "PRESENT",
      location: "Office",
      coordinates: { lat: 40.7128, lng: -74.0060 }
    },
    {
      id: 2,
      name: "Bob Smith",
      department: "IT",
      checkIn: "08:45 AM",
      checkOut: "-",
      status: "PRESENT",
      location: "Remote",
      coordinates: { lat: 40.7589, lng: -73.9851 }
    },
    {
      id: 3,
      name: "Carol Brown",
      department: "HR",
      checkIn: "09:15 AM",
      checkOut: "-",
      status: "LATE",
      location: "Office",
      coordinates: { lat: 40.7128, lng: -74.0060 }
    },
    {
      id: 4,
      name: "David Lee",
      department: "Support",
      checkIn: "-",
      checkOut: "-",
      status: "ABSENT",
      location: "-",
      coordinates: null
    }
  ])

  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [checkInStatus, setCheckInStatus] = useState<'idle' | 'checking' | 'success' | 'error'>('idle')
  
  // Attendance Filter State
  const [attendanceFilter, setAttendanceFilter] = useState({
    search: '',
    department: 'ALL',
    status: 'ALL'
  })

  // Analytics State
  const [reports, setReports] = useState([
    {
      id: 1,
      name: "Monthly Sales Report",
      type: "Sales",
      generatedDate: "2024-01-15",
      status: "COMPLETED"
    },
    {
      id: 2,
      name: "Employee Performance Report",
      type: "HR",
      generatedDate: "2024-01-10",
      status: "COMPLETED"
    },
    {
      id: 3,
      name: "Lead Conversion Analysis",
      type: "Analytics",
      generatedDate: "2024-01-08",
      status: "COMPLETED"
    }
  ])

  // New Employee Form State
  const [newEmployee, setNewEmployee] = useState({
    name: '',
    email: '',
    phone: '',
    position: '',
    department: '',
    address: ''
  })

  const mockStats = {
    totalLeads: 1247,
    activeLeads: 342,
    convertedLeads: 89,
    totalEmployees: 45,
    presentToday: 38,
    conversionRate: 7.1
  }

  const recentLeads = [
    { id: 1, name: 'John Smith', amount: 450000, status: 'NEW', priority: 'HIGH', assignedTo: 'Alice Johnson' },
    { id: 2, name: 'Sarah Johnson', amount: 320000, status: 'QUALIFIED', priority: 'MEDIUM', assignedTo: 'Bob Smith' },
    { id: 3, name: 'Mike Davis', amount: 680000, status: 'APPLICATION', priority: 'HIGH', assignedTo: 'Carol Brown' },
    { id: 4, name: 'Emily Wilson', amount: 290000, status: 'CONTACTED', priority: 'LOW', assignedTo: 'David Lee' }
  ]

  const recentAttendance = [
    { id: 1, name: 'Alice Johnson', checkIn: '09:00 AM', status: 'PRESENT', location: 'Office' },
    { id: 2, name: 'Bob Smith', checkIn: '08:45 AM', status: 'PRESENT', location: 'Remote' },
    { id: 3, name: 'Carol Brown', checkIn: '09:15 AM', status: 'LATE', location: 'Office' },
    { id: 4, name: 'David Lee', checkIn: '-', status: 'ABSENT', location: '-' }
  ]

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

  // Employee Management Functions
  const filteredEmployees = employees.filter(employee => {
    const matchesSearch = employee.name.toLowerCase().includes(employeeFilter.search.toLowerCase()) ||
                         employee.email.toLowerCase().includes(employeeFilter.search.toLowerCase()) ||
                         employee.position.toLowerCase().includes(employeeFilter.search.toLowerCase())
    const matchesDepartment = employeeFilter.department === 'ALL' || employee.department === employeeFilter.department
    const matchesStatus = employeeFilter.status === 'ALL' || employee.status === employeeFilter.status
    return matchesSearch && matchesDepartment && matchesStatus
  })

  const handleAddEmployee = () => {
    if (newEmployee.name && newEmployee.email && newEmployee.position && newEmployee.department) {
      const employee = {
        id: employees.length + 1,
        ...newEmployee,
        status: "ACTIVE",
        hireDate: new Date().toISOString().split('T')[0]
      }
      setEmployees([...employees, employee])
      setNewEmployee({ name: '', email: '', phone: '', position: '', department: '', address: '' })
      setShowAddEmployeeModal(false)
      console.log('✅ Employee added:', employee)
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
    console.log('✅ Employees exported')
  }

  const handleImportEmployees = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
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
        setEmployees([...employees, ...importedEmployees])
        console.log('✅ Employees imported:', importedEmployees.length)
      }
      reader.readAsText(file)
    }
  }

  // Lead Management Functions
  const filteredLeads = leads.filter(lead => {
    const matchesSearch = lead.name.toLowerCase().includes(leadFilter.search.toLowerCase()) ||
                         lead.email.toLowerCase().includes(leadFilter.search.toLowerCase())
    const matchesStatus = leadFilter.status === 'ALL' || lead.status === leadFilter.status
    const matchesPriority = leadFilter.priority === 'ALL' || lead.priority === leadFilter.priority
    return matchesSearch && matchesStatus && matchesPriority
  })

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
    console.log('✅ Leads exported')
  }

  const handleImportLeads = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
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
        setLeads([...leads, ...importedLeads])
        console.log('✅ Leads imported:', importedLeads.length)
      }
      reader.readAsText(file)
    }
  }

  // Lead Form Functions
  const handleAddLead = () => {
    if (newLead.firstName && newLead.lastName && newLead.email && newLead.phone) {
      const lead = {
        id: leads.length + 1,
        name: `${newLead.firstName} ${newLead.lastName}`,
        email: newLead.email,
        phone: newLead.phone,
        loanAmount: parseInt(newLead.loanAmount) || 0,
        status: "NEW",
        priority: newLead.priority,
        assignedTo: "Unassigned",
        propertyAddress: newLead.propertyAddress,
        creditScore: parseInt(newLead.creditScore) || 0
      }
      setLeads([...leads, lead])
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
      toast({
        title: "Lead Added Successfully",
        description: `${lead.name} has been added to the system`,
        duration: 4000,
      })
      console.log('✅ Lead added:', lead)
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
  const filteredAttendance = attendanceRecords.filter(record => {
    const matchesSearch = record.name.toLowerCase().includes(attendanceFilter.search.toLowerCase()) ||
                         record.department.toLowerCase().includes(attendanceFilter.search.toLowerCase()) ||
                         record.location.toLowerCase().includes(attendanceFilter.search.toLowerCase())
    const matchesDepartment = attendanceFilter.department === 'ALL' || record.department === attendanceFilter.department
    const matchesStatus = attendanceFilter.status === 'ALL' || record.status === attendanceFilter.status
    return matchesSearch && matchesDepartment && matchesStatus
  })

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
      
      // Try API call first, fallback to local state if API fails
      let apiSuccess = false
      let result = null
      
      try {
        const response = await fetch('/api/attendance/check-in', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            employeeId: user?.id || '1',
            companyId: 'default-company',
            latitude: location?.lat,
            longitude: location?.lng,
            address: 'Office Location',
            notes: ''
          })
        })

        result = await response.json()
        if (result.success) {
          apiSuccess = true
        }
      } catch (apiError) {
        console.log('API call failed, using local state fallback:', apiError)
      }
      
      const now = new Date()
      const timeString = now.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      })
      
      // Update local state (works with both API success and fallback)
      const userName = user?.name || "Admin User"
      const userRecord = attendanceRecords.find(record => record.name === userName)
      
      if (userRecord) {
        const updatedRecords = attendanceRecords.map(record => 
          record.name === userName 
            ? { ...record, checkIn: timeString, status: result?.data?.status || "PRESENT", location: "Office", coordinates: location }
            : record
        )
        setAttendanceRecords(updatedRecords)
      } else {
        const newRecord = {
          id: attendanceRecords.length + 1,
          name: userName,
          department: "Administration",
          checkIn: timeString,
          checkOut: "-",
          status: result?.data?.status || "PRESENT",
          location: "Office",
          coordinates: location
        }
        setAttendanceRecords([...attendanceRecords, newRecord])
      }
      
      setCheckInStatus('success')
      toast({
        title: "Check-in Successful",
        description: `Checked in at ${timeString}${!apiSuccess ? ' (offline mode)' : ''}`,
        duration: 4000,
      })
      console.log('✅ Check-in successful:', { time: timeString, location, apiSuccess })
      setTimeout(() => setCheckInStatus('idle'), 2000)
    } catch (error) {
      setCheckInStatus('error')
      toast({
        title: "Check-in Failed",
        description: error instanceof Error ? error.message : "Failed to check in",
        variant: "destructive",
        duration: 4000,
      })
      console.error('❌ Check-in failed:', error)
      setTimeout(() => setCheckInStatus('idle'), 2000)
    }
  }

  const handleCheckOut = async () => {
    setCheckInStatus('checking')
    try {
      const location = await getCurrentLocation()
      setCurrentLocation(location)
      
      // Try API call first, fallback to local state if API fails
      let apiSuccess = false
      let result = null
      
      try {
        const response = await fetch('/api/attendance/check-out', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            employeeId: user?.id || '1',
            companyId: 'default-company',
            latitude: location?.lat,
            longitude: location?.lng,
            address: 'Office Location',
            notes: ''
          })
        })

        result = await response.json()
        if (result.success) {
          apiSuccess = true
        }
      } catch (apiError) {
        console.log('API call failed, using local state fallback:', apiError)
      }
      
      const now = new Date()
      const timeString = now.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      })
      
      // Update local state (works with both API success and fallback)
      const userName = user?.name || "Admin User"
      const userRecord = attendanceRecords.find(record => record.name === userName)
      
      if (userRecord) {
        const updatedRecords = attendanceRecords.map(record => 
          record.name === userName 
            ? { ...record, checkOut: timeString, location: "Office", coordinates: location }
            : record
        )
        setAttendanceRecords(updatedRecords)
        
        setCheckInStatus('success')
        toast({
          title: "Check-out Successful",
          description: `Checked out at ${timeString}${!apiSuccess ? ' (offline mode)' : ''}`,
          duration: 4000,
        })
        console.log('✅ Check-out successful:', { time: timeString, location, apiSuccess })
      } else {
        setCheckInStatus('error')
        toast({
          title: "Check-out Failed",
          description: "No check-in record found for today",
          variant: "destructive",
          duration: 4000,
        })
        console.error('❌ Check-out failed: No check-in record found')
      }
      
      setTimeout(() => setCheckInStatus('idle'), 2000)
    } catch (error) {
      setCheckInStatus('error')
      toast({
        title: "Check-out Failed",
        description: error instanceof Error ? error.message : "Failed to check out",
        variant: "destructive",
        duration: 4000,
      })
      console.error('❌ Check-out failed:', error)
      setTimeout(() => setCheckInStatus('idle'), 2000)
    }
  }

  const handleExportAttendance = () => {
    const csvContent = [
      ['Name', 'Department', 'Check In', 'Check Out', 'Status', 'Location'],
      ...attendanceRecords.map(record => [
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
    console.log('✅ Attendance exported')
  }

  // Analytics Functions
  const generateReport = (type: string) => {
    const reportData = {
      id: reports.length + 1,
      name: `${type} Report - ${new Date().toLocaleDateString()}`,
      type: type,
      generatedDate: new Date().toISOString().split('T')[0],
      status: "COMPLETED"
    }
    setReports([...reports, reportData])
    console.log('✅ Report generated:', reportData)
    return reportData
  }

  const handleGenerateReport = (type: string) => {
    const report = generateReport(type)
    
    // Generate report content based on type
    let reportContent = ''
    switch (type) {
      case 'Sales':
        reportContent = generateSalesReport()
        break
      case 'Employee Performance':
        reportContent = generateEmployeePerformanceReport()
        break
      case 'Lead Conversion':
        reportContent = generateLeadConversionReport()
        break
      default:
        reportContent = 'General Report Content'
    }

    // Download the report
    const blob = new Blob([reportContent], { type: 'text/plain' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${report.name.replace(/\s+/g, '_')}.txt`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const generateSalesReport = () => {
    const totalLeads = leads.length
    const convertedLeads = leads.filter(lead => lead.status === 'APPLICATION').length
    const conversionRate = ((convertedLeads / totalLeads) * 100).toFixed(2)
    const totalLoanAmount = leads.reduce((sum, lead) => sum + lead.loanAmount, 0)
    
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
    const activeEmployees = employees.filter(emp => emp.status === 'ACTIVE')
    const onLeaveEmployees = employees.filter(emp => emp.status === 'ON_LEAVE')
    
    return `Employee Performance Report
Generated: ${new Date().toLocaleDateString()}

Total Employees: ${employees.length}
Active Employees: ${activeEmployees.length}
Employees on Leave: ${onLeaveEmployees.length}

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

Average Credit Score: ${Math.round(leads.reduce((sum, lead) => sum + lead.creditScore, 0) / leads.length)}
`
  }

  const handleNavigation = (section: string) => {
    setActiveTab(section)
    console.log(`✅ Navigation: Switched to ${section} tab`)
    // Visual feedback could be added here
  }

  const handleNotificationsClick = () => {
    setActiveTab('overview')
    console.log('✅ Notifications: Opening notifications panel')
    // Scroll to notifications section
    setTimeout(() => {
      const notificationsSection = document.getElementById('notifications-section')
      if (notificationsSection) {
        notificationsSection.scrollIntoView({ behavior: 'smooth' })
      }
    }, 100)
  }

  const handleImportClick = () => {
    console.log('✅ Import: Function depends on current tab')
    // Import functionality is now tab-specific
  }

  const handleExportClick = () => {
    console.log('✅ Export: Function depends on current tab')
    // Export functionality is now tab-specific
  }

  const handleAddEmployeeClick = () => {
    setShowAddEmployeeModal(true)
    console.log('✅ Add Employee: Opening add employee modal')
  }

  const handleNotificationClick = (notification: any) => {
    console.log('✅ Notification clicked:', notification)
    toast({
      title: notification.title,
      description: notification.message,
      duration: 5000,
    })
  }

  const handleLeadClick = (lead: any) => {
    console.log('✅ Lead clicked:', lead)
    setActiveTab('leads')
  }

  const handleAttendanceClick = (attendance: any) => {
    console.log('✅ Attendance clicked:', attendance)
    setActiveTab('attendance')
  }

  const handleAddLeadClick = () => {
    setShowAddLeadModal(true)
  }

  const handleCheckInClick = () => {
    handleCheckIn()
  }

  const handleGenerateReportClick = () => {
    console.log('✅ Generate Report: Opening report type selection')
    toast({
      title: "Generate Report",
      description: "Select report type: Sales, Employee Performance, or Lead Conversion",
      duration: 4000,
    })
  }

  const handleEditEmployeeClick = (employee: any) => {
    console.log('✅ Edit Employee:', employee)
    toast({
      title: "Edit Employee",
      description: `${employee.name} - Position: ${employee.position}, Department: ${employee.department}`,
      duration: 4000,
    })
  }

  const handleViewEmployeeClick = (employee: any) => {
    console.log('✅ View Employee:', employee)
    toast({
      title: "Employee Details",
      description: `Name: ${employee.name}, Email: ${employee.email}, Position: ${employee.position}, Department: ${employee.department}, Status: ${employee.status}`,
      duration: 6000,
    })
  }

  const handleEditLeadClick = (lead: any) => {
    console.log('✅ Edit Lead:', lead)
    toast({
      title: "Edit Lead",
      description: `${lead.name} - Amount: $${lead.loanAmount.toLocaleString()}, Status: ${lead.status}`,
      duration: 4000,
    })
  }

  const handleViewLeadClick = (lead: any) => {
    console.log('✅ View Lead:', lead)
    toast({
      title: "Lead Details",
      description: `Name: ${lead.name}, Amount: $${lead.loanAmount.toLocaleString()}, Status: ${lead.status}, Priority: ${lead.priority}, Assigned to: ${lead.assignedTo}`,
      duration: 6000,
    })
  }

  const handleViewAttendanceClick = (attendance: any) => {
    console.log('✅ View Attendance:', attendance)
    toast({
      title: "Attendance Record",
      description: `Name: ${attendance.name}, Check-in: ${attendance.checkIn}, Check-out: ${attendance.checkOut}, Status: ${attendance.status}, Location: ${attendance.location}`,
      duration: 6000,
    })
  }

  const handleEditAttendanceClick = (attendance: any) => {
    console.log('✅ Edit Attendance:', attendance)
    toast({
      title: "Edit Attendance",
      description: `${attendance.name} - Check-in: ${attendance.checkIn}, Status: ${attendance.status}`,
      duration: 4000,
    })
  }

  const handleLogout = () => {
    logout()
    router.push('/login')
  }

  return (
    <ProtectedRoute>
      <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Building2 className="h-8 w-8 text-blue-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Baytech Mortgage ERP</h1>
              <p className="text-sm text-gray-500">Enterprise System</p>
            </div>
          </div>
        </div>
        
        <nav className="flex-1 p-4">
          <div className="space-y-2">
            <Button 
              variant="ghost" 
              className="w-full justify-start gap-2"
              onClick={() => handleNavigation('overview')}
            >
              <BarChart3 className="h-4 w-4" />
              Dashboard
            </Button>
            <Button 
              variant="ghost" 
              className="w-full justify-start gap-2"
              onClick={() => handleNavigation('employees')}
            >
              <Users className="h-4 w-4" />
              Employees
            </Button>
            <Button 
              variant="ghost" 
              className="w-full justify-start gap-2"
              onClick={() => handleNavigation('leads')}
            >
              <Phone className="h-4 w-4" />
              Leads
            </Button>
            <Button 
              variant="ghost" 
              className="w-full justify-start gap-2"
              onClick={() => handleNavigation('attendance')}
            >
              <Calendar className="h-4 w-4" />
              Attendance
            </Button>
            <Button 
              variant="ghost" 
              className="w-full justify-start gap-2"
              onClick={() => handleNavigation('analytics')}
            >
              <BarChart3 className="h-4 w-4" />
              Analytics
            </Button>
          </div>
        </nav>
        
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center gap-3 mb-3">
            <Avatar>
              <AvatarImage src="/placeholder-avatar.jpg" />
              <AvatarFallback>AD</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">{user?.name || 'Administrator'}</p>
              <p className="text-xs text-gray-500">{user?.role || 'Admin'}</p>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full justify-start gap-2"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
              <p className="text-sm text-gray-500">Welcome back, John</p>
            </div>
            <div className="flex items-center gap-4">
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleNotificationsClick}
              >
                <Bell className="h-4 w-4 mr-2" />
                Notifications
              </Button>
              <Avatar>
                <AvatarImage src="/placeholder-avatar.jpg" />
                <AvatarFallback>JD</AvatarFallback>
              </Avatar>
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="employees">Employees</TabsTrigger>
              <TabsTrigger value="leads">Leads</TabsTrigger>
              <TabsTrigger value="attendance">Attendance</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              {/* KPI Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
                    <Phone className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{mockStats.totalLeads.toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground">
                      +12% from last month
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Active Leads</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{mockStats.activeLeads}</div>
                    <p className="text-xs text-muted-foreground">
                      +8% from last week
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{mockStats.conversionRate}%</div>
                    <p className="text-xs text-muted-foreground">
                      +2.1% from last month
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Employees Present</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{mockStats.presentToday}/{mockStats.totalEmployees}</div>
                    <p className="text-xs text-muted-foreground">
                      84% attendance rate
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Recent Activity */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Recent Leads</CardTitle>
                    <CardDescription>Latest lead assignments and updates</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-64">
                      <div className="space-y-4">
                        {recentLeads.map((lead) => (
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
                                <p className="text-sm text-gray-500">${lead.amount.toLocaleString()}</p>
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
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Today's Attendance</CardTitle>
                    <CardDescription>Employee check-in status</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-64">
                      <div className="space-y-4">
                        {recentAttendance.map((employee) => (
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
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>

              {/* Notifications */}
              <Card id="notifications-section">
                <CardHeader>
                  <CardTitle>Recent Notifications</CardTitle>
                  <CardDescription>System alerts and updates</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-48">
                    <div className="space-y-3">
                      {notifications.map((notification) => (
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
                      ))}
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
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleImportEmployees}
                      style={{ display: 'none' }}
                      id="employee-import"
                    />
                    <Button 
                      variant="outline"
                      onClick={() => document.getElementById('employee-import')?.click()}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Import
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={handleExportEmployees}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Export
                    </Button>
                    <Button 
                      onClick={handleAddEmployeeClick}
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
                      <div className="text-2xl font-bold">45</div>
                      <p className="text-xs text-muted-foreground">+3 this month</p>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Active Employees</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">42</div>
                      <p className="text-xs text-muted-foreground">93.3% active rate</p>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Departments</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">6</div>
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
                            <SelectItem value="Sales">Sales</SelectItem>
                            <SelectItem value="IT">IT</SelectItem>
                            <SelectItem value="HR">HR</SelectItem>
                            <SelectItem value="Support">Support</SelectItem>
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
                            <tr key={employee.id} className="border-b hover:bg-gray-50">
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
                              <td className="p-3">{employee.hireDate}</td>
                              <td className="p-3">
                                <div className="flex gap-2">
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
                        </tbody>
                      </table>
                    </div>
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
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleImportLeads}
                      style={{ display: 'none' }}
                      id="leads-import"
                    />
                    <Button 
                      variant="outline"
                      onClick={() => document.getElementById('leads-import')?.click()}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Import
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={handleExportLeads}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Export
                    </Button>
                    <Button 
                      onClick={handleAddLeadClick}
                      className="bg-blue-600 hover:bg-blue-700"
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
                      <div className="text-2xl font-bold text-gray-900">1,247</div>
                      <p className="text-xs text-green-600">+12% this month</p>
                    </CardContent>
                  </Card>
                  
                  <Card className="border-l-4 border-l-green-500">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-gray-600">Active Leads</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-gray-900">342</div>
                      <p className="text-xs text-gray-500">In pipeline</p>
                    </CardContent>
                  </Card>
                  
                  <Card className="border-l-4 border-l-purple-500">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-gray-600">Converted</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-gray-900">89</div>
                      <p className="text-xs text-green-600">7.1% conversion</p>
                    </CardContent>
                  </Card>
                  
                  <Card className="border-l-4 border-l-orange-500">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-gray-600">High Priority</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-gray-900">45</div>
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
                            <th className="text-left p-3">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredLeads.map((lead) => (
                            <tr key={lead.id} className="border-b hover:bg-gray-50">
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
                              <td className="p-3">${lead.loanAmount.toLocaleString()}</td>
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
                              <td className="p-3">{lead.assignedTo}</td>
                              <td className="p-3">
                                <div className="flex gap-2">
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
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="attendance">
              <div className="space-y-6">
                {/* Attendance Header */}
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Attendance Tracking</h2>
                    <p className="text-sm text-gray-500">Employee attendance and time tracking</p>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="file"
                      accept=".csv"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          console.log('Attendance import would process:', file.name)
                          toast({
                            title: "Import Attendance",
                            description: `Attendance import functionality would process the CSV file: ${file.name}`,
                            duration: 4000,
                          })
                        }
                      }}
                      style={{ display: 'none' }}
                      id="attendance-import"
                    />
                    <Button 
                      variant="outline"
                      onClick={() => document.getElementById('attendance-import')?.click()}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Import
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={handleExportAttendance}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Export
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
                      Check In
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={handleCheckOut}
                      disabled={checkInStatus === 'checking'}
                      className="border-red-200 text-red-700 hover:bg-red-50"
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
                      <div className="text-2xl font-bold text-gray-900">38</div>
                      <p className="text-xs text-green-600">84.4% attendance</p>
                    </CardContent>
                  </Card>
                  
                  <Card className="border-l-4 border-l-yellow-500">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-gray-600">Late Arrivals</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-gray-900">3</div>
                      <p className="text-xs text-yellow-600">7.9% late rate</p>
                    </CardContent>
                  </Card>
                  
                  <Card className="border-l-4 border-l-blue-500">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-gray-600">On Leave</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-gray-900">2</div>
                      <p className="text-xs text-blue-600">Approved leave</p>
                    </CardContent>
                  </Card>
                  
                  <Card className="border-l-4 border-l-red-500">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-gray-600">Absent</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-gray-900">2</div>
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
                            <tr key={record.id} className="border-b hover:bg-gray-50">
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
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => handleViewAttendanceClick(record)}
                                  >
                                    View
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => handleEditAttendanceClick(record)}
                                  >
                                    Edit
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
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
                      onClick={() => {
                        const csvContent = [
                          ['Report Name', 'Type', 'Generated Date', 'Status'],
                          ...reports.map(report => [
                            report.name, report.type, report.generatedDate, report.status
                          ])
                        ].map(row => row.join(',')).join('\n')

                        const blob = new Blob([csvContent], { type: 'text/csv' })
                        const url = window.URL.createObjectURL(blob)
                        const a = document.createElement('a')
                        a.href = url
                        a.download = `reports_${new Date().toISOString().split('T')[0]}.csv`
                        a.click()
                        window.URL.revokeObjectURL(url)
                        console.log('✅ Reports exported')
                      }}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Export Reports
                    </Button>
                  </div>
                </div>

                {/* Analytics Overview */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Lead Conversion Rate</CardTitle>
                      <CardDescription>Monthly conversion trends</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-green-600">7.1%</div>
                      <p className="text-sm text-gray-500">+2.1% from last month</p>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader>
                      <CardTitle>Average Response Time</CardTitle>
                      <CardDescription>Time to first contact</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-blue-600">2.3h</div>
                      <p className="text-sm text-gray-500">-30m improvement</p>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader>
                      <CardTitle>Employee Productivity</CardTitle>
                      <CardDescription>Leads per employee</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-purple-600">24.2</div>
                      <p className="text-sm text-gray-500">+3.2 from average</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Charts Placeholder */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Lead Sources</CardTitle>
                      <CardDescription>Where your leads come from</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {[
                          { source: "Website", count: 456, percentage: 37 },
                          { source: "Referral", count: 298, percentage: 24 },
                          { source: "Social Media", count: 189, percentage: 15 },
                          { source: "Email Campaign", count: 156, percentage: 13 },
                          { source: "Other", count: 148, percentage: 11 }
                        ].map((item) => (
                          <div key={item.source} className="space-y-2">
                            <div className="flex justify-between">
                              <span className="text-sm font-medium">{item.source}</span>
                              <span className="text-sm text-gray-500">{item.count} ({item.percentage}%)</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${item.percentage}%` }}></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Department Performance</CardTitle>
                      <CardDescription>Leads handled by department</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {[
                          { department: "Sales", leads: 489, converted: 45, rate: 9.2 },
                          { department: "Support", leads: 312, converted: 22, rate: 7.1 },
                          { department: "Marketing", leads: 245, converted: 15, rate: 6.1 },
                          { department: "IT", leads: 201, converted: 7, rate: 3.5 }
                        ].map((dept) => (
                          <div key={dept.department} className="flex items-center justify-between p-3 border rounded-lg">
                            <div>
                              <p className="font-medium">{dept.department}</p>
                              <p className="text-sm text-gray-500">{dept.leads} leads</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-medium">{dept.converted} converted</p>
                              <p className="text-xs text-gray-500">{dept.rate}% rate</p>
                            </div>
                          </div>
                        ))}
                      </div>
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
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add New Employee</DialogTitle>
            <DialogDescription>
              Create a new employee record in the system.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Name
              </Label>
              <Input
                id="name"
                value={newEmployee.name}
                onChange={(e) => setNewEmployee({...newEmployee, name: e.target.value})}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="email" className="text-right">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={newEmployee.email}
                onChange={(e) => setNewEmployee({...newEmployee, email: e.target.value})}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="phone" className="text-right">
                Phone
              </Label>
              <Input
                id="phone"
                value={newEmployee.phone}
                onChange={(e) => setNewEmployee({...newEmployee, phone: e.target.value})}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="position" className="text-right">
                Position
              </Label>
              <Input
                id="position"
                value={newEmployee.position}
                onChange={(e) => setNewEmployee({...newEmployee, position: e.target.value})}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="department" className="text-right">
                Department
              </Label>
              <Select value={newEmployee.department} onValueChange={(value) => setNewEmployee({...newEmployee, department: value})}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Sales">Sales</SelectItem>
                  <SelectItem value="IT">IT</SelectItem>
                  <SelectItem value="HR">HR</SelectItem>
                  <SelectItem value="Support">Support</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="address" className="text-right">
                Address
              </Label>
              <Input
                id="address"
                value={newEmployee.address}
                onChange={(e) => setNewEmployee({...newEmployee, address: e.target.value})}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddEmployeeModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddEmployee}>
              Add Employee
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Lead Modal */}
      <Dialog open={showAddLeadModal} onOpenChange={setShowAddLeadModal}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Lead</DialogTitle>
            <DialogDescription>
              Enter the lead information below. All fields marked with * are required.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 items-center gap-4">
              <Label htmlFor="firstName" className="text-right">
                First Name *
              </Label>
              <Input
                id="firstName"
                value={newLead.firstName}
                onChange={(e) => handleLeadInputChange('firstName', e.target.value)}
                className="col-span-1"
              />
            </div>
            <div className="grid grid-cols-2 items-center gap-4">
              <Label htmlFor="lastName" className="text-right">
                Last Name *
              </Label>
              <Input
                id="lastName"
                value={newLead.lastName}
                onChange={(e) => handleLeadInputChange('lastName', e.target.value)}
                className="col-span-1"
              />
            </div>
            <div className="grid grid-cols-2 items-center gap-4">
              <Label htmlFor="email" className="text-right">
                Email *
              </Label>
              <Input
                id="email"
                type="email"
                value={newLead.email}
                onChange={(e) => handleLeadInputChange('email', e.target.value)}
                className="col-span-1"
              />
            </div>
            <div className="grid grid-cols-2 items-center gap-4">
              <Label htmlFor="phone" className="text-right">
                Phone *
              </Label>
              <Input
                id="phone"
                value={newLead.phone}
                onChange={(e) => handleLeadInputChange('phone', e.target.value)}
                className="col-span-1"
              />
            </div>
            <div className="grid grid-cols-2 items-center gap-4">
              <Label htmlFor="loanAmount" className="text-right">
                Loan Amount ($)
              </Label>
              <Input
                id="loanAmount"
                type="number"
                value={newLead.loanAmount}
                onChange={(e) => handleLeadInputChange('loanAmount', e.target.value)}
                className="col-span-1"
              />
            </div>
            <div className="grid grid-cols-2 items-center gap-4">
              <Label htmlFor="propertyAddress" className="text-right">
                Property Address
              </Label>
              <Input
                id="propertyAddress"
                value={newLead.propertyAddress}
                onChange={(e) => handleLeadInputChange('propertyAddress', e.target.value)}
                className="col-span-1"
              />
            </div>
            <div className="grid grid-cols-2 items-center gap-4">
              <Label htmlFor="propertyType" className="text-right">
                Property Type
              </Label>
              <Select value={newLead.propertyType} onValueChange={(value) => handleLeadInputChange('propertyType', value)}>
                <SelectTrigger className="col-span-1">
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
            <div className="grid grid-cols-2 items-center gap-4">
              <Label htmlFor="creditScore" className="text-right">
                Credit Score
              </Label>
              <Input
                id="creditScore"
                type="number"
                value={newLead.creditScore}
                onChange={(e) => handleLeadInputChange('creditScore', e.target.value)}
                className="col-span-1"
                min="300"
                max="850"
              />
            </div>
            <div className="grid grid-cols-2 items-center gap-4">
              <Label htmlFor="source" className="text-right">
                Lead Source
              </Label>
              <Select value={newLead.source} onValueChange={(value) => handleLeadInputChange('source', value)}>
                <SelectTrigger className="col-span-1">
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
            <div className="grid grid-cols-2 items-center gap-4">
              <Label htmlFor="priority" className="text-right">
                Priority
              </Label>
              <Select value={newLead.priority} onValueChange={(value) => handleLeadInputChange('priority', value)}>
                <SelectTrigger className="col-span-1">
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
            <div className="grid grid-cols-1 items-center gap-4">
              <Label htmlFor="notes" className="text-right">
                Notes
              </Label>
              <textarea
                id="notes"
                value={newLead.notes}
                onChange={(e) => handleLeadInputChange('notes', e.target.value)}
                className="col-span-3 w-full p-2 border border-gray-300 rounded-md resize-none"
                rows={3}
                placeholder="Additional notes about this lead..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddLeadModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddLead} className="bg-blue-600 hover:bg-blue-700">
              <UserPlus className="h-4 w-4 mr-2" />
              Add Lead
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </ProtectedRoute>
  )
}