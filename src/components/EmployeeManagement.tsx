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
  X,
  TrendingUp,
  Users 
} from 'lucide-react';

interface EmployeeManagementProps {
  user: any;
  employees: any[];
  departments: any[];
  roles: any[];
  canViewEmployees: boolean;
  canCreateEmployees: boolean;
  loading: boolean;
  onRefresh: () => void;
  refreshData: () => void;
}

export function EmployeeManagement({
  user,
  employees,
  departments,
  roles,
  canViewEmployees,
  canCreateEmployees,
  loading,
  onRefresh,
  refreshData
}: EmployeeManagementProps) {
  const { toast } = useToast();
  const [showAddEmployeeModal, setShowAddEmployeeModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<any>(null);
  const [employeeToDelete, setEmployeeToDelete] = useState<any>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [newEmployee, setNewEmployee] = useState({
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

  // Filter states
  const [employeeFilter, setEmployeeFilter] = useState({
    search: '',
    department: 'ALL',
    status: 'ALL'
  });

  // Debounced search
  const debouncedEmployeeSearch = useDebounce(employeeFilter.search, 300);

  const itemsPerPage = 10;
  const [employeePage, setEmployeePage] = useState(1);

  const employeesList = React.useMemo(() => {
    if (Array.isArray(employees)) return employees;
    if (employees && Array.isArray((employees as any).data)) return (employees as any).data;
    return [];
  }, [employees]);

  // Filtered data with debounced search for better performance
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
  }, [employeesList, debouncedEmployeeSearch, employeeFilter.department, employeeFilter.status, user?.role, user?.id]);

  // Paginated data
  const paginatedEmployees = useMemo(() => {
    const startIndex = (employeePage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return filteredEmployees.slice(startIndex, endIndex)
  }, [filteredEmployees, employeePage, itemsPerPage]);

  // Total pages for pagination
  const totalEmployeePages = Math.ceil(filteredEmployees.length / itemsPerPage);

  // Reset pagination when filters change
  React.useEffect(() => {
    setEmployeePage(1)
  }, [debouncedEmployeeSearch, employeeFilter.department, employeeFilter.status]);

  // Helper function to check if user is admin or manager (can set passwords)
  const isAdmin = useCallback(() => {
    if (!user) return false
    // Check by email
    if (user.email === 'admin@baytech.com') return true
    // Check by role (case-insensitive) - Admin or Manager can set passwords
    if (user.role && (user.role.toLowerCase().includes('admin') || user.role.toLowerCase().includes('manager'))) return true
    return false
  }, [user]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'bg-green-100 text-green-800'
      case 'ON_LEAVE': return 'bg-yellow-100 text-yellow-800'
      case 'INACTIVE': return 'bg-red-100 text-red-800'
      case 'TERMINATED': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

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
            'x-user-id': user?.id,
            'x-company-id': user?.companyId
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
          await refreshData()

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
  }, [newEmployee, isAdmin, user?.id, user?.companyId, departments, refreshData, toast]);

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
  }, [filteredEmployees]);

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
  }, []);

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
            'x-user-id': user?.id,
            'x-company-id': user?.companyId
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
          await refreshData();

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
  }, [editingEmployee, newEmployee, isAdmin, user?.id, user?.companyId, refreshData, toast]);

  const toggleEmployeeStatus = async (employeeId: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      const response = await fetch(`/api/employees/${employeeId}/status`, {
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

  const handleAddEmployeeClick = () => {
    setShowAddEmployeeModal(true)
  }

  // Check if user has delete permissions (Admin only)
  const canDeleteEmployees = user?.role === 'Administrator' || user?.email === 'admin@baytech.com';

  // Handle delete employee
  const handleDeleteEmployee = async () => {
    if (!employeeToDelete) return;

    try {
      const response = await fetch(`/api/employees/${employeeToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user?.id,
          'x-company-id': user?.companyId
        }
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Employee deleted successfully",
        });
        setEmployeeToDelete(null);
        setShowDeleteConfirm(false);
        await refreshData(); // Refresh the employee list
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete employee');
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete employee",
        variant: "destructive",
      });
    }
  };

  return (
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
          {canCreateEmployees && (
            <Button
              onClick={handleAddEmployeeClick}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Add Employee
            </Button>
          )}
        </div>
      </div>

      {/* Employee Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{employeesList.length}</div>
            <p className="text-xs text-muted-foreground">+{employeesList.filter(e => e.hireDate && new Date(e.hireDate) >= new Date(new Date().setDate(new Date().getDate() - 30))).length} this month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Employees</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{employeesList.filter(e => e.status === 'ACTIVE').length}</div>
            <p className="text-xs text-muted-foreground">{employeesList.length ? Math.round((employeesList.filter(e => e.status === 'ACTIVE').length / employeesList.length) * 100) : 0}% active rate</p>
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
                  {paginatedEmployees.map((employee) => (
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
                          {canDeleteEmployees && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEmployeeToDelete(employee);
                                setShowDeleteConfirm(true);
                              }}
                              className="text-red-600 border-red-600 hover:bg-red-50"
                            >
                              Delete
                            </Button>
                          )}
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
          {/* Pagination Controls */}
          {filteredEmployees.length > itemsPerPage && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <div className="text-sm text-gray-500">
                Showing {((employeePage - 1) * itemsPerPage) + 1} to {Math.min(employeePage * itemsPerPage, filteredEmployees.length)} of {filteredEmployees.length} employees
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEmployeePage(prev => Math.max(1, prev - 1))}
                  disabled={employeePage === 1}
                >
                  Previous
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalEmployeePages }, (_, i) => i + 1).map(page => (
                    <Button
                      key={page}
                      variant={employeePage === page ? "default" : "outline"}
                      size="sm"
                      onClick={() => setEmployeePage(page)}
                      className="w-8 h-8 p-0"
                    >
                      {page}
                    </Button>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEmployeePage(prev => Math.min(totalEmployeePages, prev + 1))}
                  disabled={employeePage === totalEmployeePages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Employee Modal */}
      {showAddEmployeeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">
                  {editingEmployee ? 'Edit Employee' : 'Add New Employee'}
                </h3>
                <Button
                  variant="ghost"
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
                >
                  Close
                </Button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
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
              
              <div className="flex justify-end gap-2 mt-4">
                <Button
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
                >
                  Cancel
                </Button>
                <Button
                  onClick={editingEmployee ? handleUpdateEmployee : handleAddEmployee}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {editingEmployee ? 'Update Employee' : 'Create Employee'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && employeeToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-red-100 rounded-full p-3">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">Delete Employee</h3>
                  <p className="text-sm text-gray-500">This action cannot be undone</p>
                </div>
              </div>

              <p className="text-gray-700 mb-6">
                Are you sure you want to delete <span className="font-semibold">{employeeToDelete.name}</span>?
                This will permanently remove the employee from the system.
              </p>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setEmployeeToDelete(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDeleteEmployee}
                >
                  Delete Employee
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
