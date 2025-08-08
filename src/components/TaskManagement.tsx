"use client"

import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { 
  CheckSquare, 
  Plus, 
  Calendar,
  User,
  Flag,
  Clock,
  AlertCircle,
  CheckCircle,
  Search,
  Filter,
  MoreHorizontal
} from 'lucide-react'

interface Task {
  id: string
  title: string
  description: string
  status: 'TODO' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED'
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  assignedTo: string
  dueDate: string
  createdAt: string
  category: string
  tags: string[]
}

interface TaskManagementProps {
  companyId?: string
}

export function TaskManagement({ companyId = 'default' }: TaskManagementProps) {
  const { toast } = useToast()
  const [tasks, setTasks] = useState<Task[]>([
    {
      id: '1',
      title: 'Follow up with John Smith lead',
      description: 'Call John Smith regarding his mortgage application status and answer any questions',
      status: 'TODO',
      priority: 'HIGH',
      assignedTo: 'Alice Johnson',
      dueDate: '2024-01-20',
      createdAt: '2024-01-15',
      category: 'Leads',
      tags: ['follow-up', 'mortgage']
    },
    {
      id: '2',
      title: 'Prepare monthly sales report',
      description: 'Compile and analyze monthly sales data for management review',
      status: 'IN_PROGRESS',
      priority: 'MEDIUM',
      assignedTo: 'Bob Smith',
      dueDate: '2024-01-25',
      createdAt: '2024-01-12',
      category: 'Reports',
      tags: ['sales', 'monthly']
    },
    {
      id: '3',
      title: 'Update CRM system',
      description: 'Update customer records and ensure data accuracy in the CRM system',
      status: 'DONE',
      priority: 'LOW',
      assignedTo: 'Carol Brown',
      dueDate: '2024-01-18',
      createdAt: '2024-01-10',
      category: 'System',
      tags: ['crm', 'maintenance']
    }
  ])

  const [showAddTaskModal, setShowAddTaskModal] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [filters, setFilters] = useState({
    search: '',
    status: 'ALL',
    priority: 'ALL',
    assignedTo: 'ALL'
  })

  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    priority: 'MEDIUM' as const,
    assignedTo: '',
    dueDate: '',
    category: 'General',
    tags: ''
  })

  const employees = [
    'Alice Johnson',
    'Bob Smith', 
    'Carol Brown',
    'David Lee'
  ]

  const categories = [
    'General',
    'Leads',
    'Reports', 
    'System',
    'Meetings',
    'Training'
  ]

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'TODO': return 'bg-gray-100 text-gray-800'
      case 'IN_PROGRESS': return 'bg-blue-100 text-blue-800'
      case 'DONE': return 'bg-green-100 text-green-800'
      case 'CANCELLED': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'LOW': return 'bg-green-100 text-green-800'
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800'
      case 'HIGH': return 'bg-orange-100 text-orange-800'
      case 'URGENT': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const isOverdue = (dueDate: string) => {
    return new Date(dueDate) < new Date()
  }

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(filters.search.toLowerCase()) ||
                         task.description.toLowerCase().includes(filters.search.toLowerCase()) ||
                         task.assignedTo.toLowerCase().includes(filters.search.toLowerCase())
    const matchesStatus = filters.status === 'ALL' || task.status === filters.status
    const matchesPriority = filters.priority === 'ALL' || task.priority === filters.priority
    const matchesAssignedTo = filters.assignedTo === 'ALL' || task.assignedTo === filters.assignedTo
    
    return matchesSearch && matchesStatus && matchesPriority && matchesAssignedTo
  })

  const handleAddTask = () => {
    if (!newTask.title.trim()) {
      toast({
        title: "Validation Error",
        description: "Task title is required",
        variant: "destructive",
      })
      return
    }

    const task: Task = {
      id: Date.now().toString(),
      title: newTask.title,
      description: newTask.description,
      status: 'TODO',
      priority: newTask.priority,
      assignedTo: newTask.assignedTo,
      dueDate: newTask.dueDate,
      createdAt: new Date().toISOString().split('T')[0],
      category: newTask.category,
      tags: newTask.tags.split(',').map(tag => tag.trim()).filter(Boolean)
    }

    setTasks([...tasks, task])
    setNewTask({
      title: '',
      description: '',
      priority: 'MEDIUM',
      assignedTo: '',
      dueDate: '',
      category: 'General',
      tags: ''
    })
    setShowAddTaskModal(false)

    toast({
      title: "Task Created",
      description: `Task "${task.title}" has been created successfully`,
    })
  }

  const handleUpdateTaskStatus = (taskId: string, newStatus: Task['status']) => {
    setTasks(tasks.map(task => 
      task.id === taskId ? { ...task, status: newStatus } : task
    ))

    toast({
      title: "Task Updated",
      description: `Task status updated to ${newStatus.replace('_', ' ').toLowerCase()}`,
    })
  }

  const getTaskStats = () => {
    const stats = {
      total: tasks.length,
      todo: tasks.filter(t => t.status === 'TODO').length,
      inProgress: tasks.filter(t => t.status === 'IN_PROGRESS').length,
      done: tasks.filter(t => t.status === 'DONE').length,
      overdue: tasks.filter(t => t.status !== 'DONE' && isOverdue(t.dueDate)).length
    }
    return stats
  }

  const stats = getTaskStats()

  return (
    <div className="space-y-6">
      {/* Task Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">To Do</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">{stats.todo}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.inProgress}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.done}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.overdue}</div>
          </CardContent>
        </Card>
      </div>

      {/* Task Management Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CheckSquare className="h-5 w-5" />
                Task Management
              </CardTitle>
              <CardDescription>
                Organize and track team tasks and assignments
              </CardDescription>
            </div>
            <Button onClick={() => setShowAddTaskModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Task
            </Button>
          </div>
        </CardHeader>
        
        <CardContent>
          {/* Filters */}
          <div className="flex gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search tasks..."
                value={filters.search}
                onChange={(e) => setFilters({...filters, search: e.target.value})}
                className="pl-10"
              />
            </div>
            
            <Select value={filters.status} onValueChange={(value) => setFilters({...filters, status: value})}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Status</SelectItem>
                <SelectItem value="TODO">To Do</SelectItem>
                <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                <SelectItem value="DONE">Done</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.priority} onValueChange={(value) => setFilters({...filters, priority: value})}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Priority</SelectItem>
                <SelectItem value="LOW">Low</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="HIGH">High</SelectItem>
                <SelectItem value="URGENT">Urgent</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.assignedTo} onValueChange={(value) => setFilters({...filters, assignedTo: value})}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Assignees</SelectItem>
                {employees.map(employee => (
                  <SelectItem key={employee} value={employee}>{employee}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Task List */}
          <div className="space-y-4">
            {filteredTasks.map((task) => (
              <Card key={task.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-medium">{task.title}</h4>
                      {isOverdue(task.dueDate) && task.status !== 'DONE' && (
                        <AlertCircle className="h-4 w-4 text-red-500" />
                      )}
                    </div>
                    
                    <p className="text-sm text-gray-600 mb-3">{task.description}</p>
                    
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        <span>{task.assignedTo}</span>
                      </div>
                      
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>{task.dueDate}</span>
                      </div>
                      
                      <div className="flex items-center gap-1">
                        <CheckSquare className="h-3 w-3" />
                        <span>{task.category}</span>
                      </div>
                    </div>

                    {task.tags.length > 0 && (
                      <div className="flex gap-1 mt-2">
                        {task.tags.map((tag, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Badge className={getPriorityColor(task.priority)}>
                      <Flag className="h-3 w-3 mr-1" />
                      {task.priority}
                    </Badge>
                    
                    <Select 
                      value={task.status} 
                      onValueChange={(value) => handleUpdateTaskStatus(task.id, value as Task['status'])}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TODO">To Do</SelectItem>
                        <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                        <SelectItem value="DONE">Done</SelectItem>
                        <SelectItem value="CANCELLED">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </Card>
            ))}

            {filteredTasks.length === 0 && (
              <div className="text-center py-8">
                <CheckSquare className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <h3 className="font-medium text-gray-900 mb-2">No tasks found</h3>
                <p className="text-sm text-gray-500">
                  {filters.search || filters.status !== 'ALL' || filters.priority !== 'ALL' || filters.assignedTo !== 'ALL'
                    ? 'Try adjusting your filters'
                    : 'Create your first task to get started'
                  }
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Add Task Modal */}
      <Dialog open={showAddTaskModal} onOpenChange={setShowAddTaskModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Task</DialogTitle>
            <DialogDescription>
              Add a new task to track work and assignments
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="task-title">Title *</Label>
              <Input
                id="task-title"
                value={newTask.title}
                onChange={(e) => setNewTask({...newTask, title: e.target.value})}
                placeholder="Enter task title"
              />
            </div>

            <div>
              <Label htmlFor="task-description">Description</Label>
              <Textarea
                id="task-description"
                value={newTask.description}
                onChange={(e) => setNewTask({...newTask, description: e.target.value})}
                placeholder="Describe the task..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="task-priority">Priority</Label>
                <Select value={newTask.priority} onValueChange={(value) => setNewTask({...newTask, priority: value as any})}>
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

              <div>
                <Label htmlFor="task-category">Category</Label>
                <Select value={newTask.category} onValueChange={(value) => setNewTask({...newTask, category: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(category => (
                      <SelectItem key={category} value={category}>{category}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="task-assignee">Assigned To</Label>
                <Select value={newTask.assignedTo} onValueChange={(value) => setNewTask({...newTask, assignedTo: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select assignee" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map(employee => (
                      <SelectItem key={employee} value={employee}>{employee}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="task-due-date">Due Date</Label>
                <Input
                  id="task-due-date"
                  type="date"
                  value={newTask.dueDate}
                  onChange={(e) => setNewTask({...newTask, dueDate: e.target.value})}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="task-tags">Tags (comma separated)</Label>
              <Input
                id="task-tags"
                value={newTask.tags}
                onChange={(e) => setNewTask({...newTask, tags: e.target.value})}
                placeholder="e.g., urgent, follow-up, customer"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddTaskModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddTask}>
              Create Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}