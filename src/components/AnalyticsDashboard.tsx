"use client"

import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area
} from 'recharts'
import { Users, TrendingUp, DollarSign, Clock, Download, FileText } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface AnalyticsDashboardProps {
  safeUserId: string;
  safeCompanyId: string;
  canViewReports: boolean;
  reports: any[];
  leadsList: any[];
  employeesList: any[];
  attendanceList: any[];
  setReports: React.Dispatch<React.SetStateAction<any[]>>;
}

export function AnalyticsDashboard({ safeUserId, safeCompanyId, canViewReports, reports, leadsList, employeesList, attendanceList, setReports }: AnalyticsDashboardProps) {
  const { toast } = useToast()
  const [analyticsData, setAnalyticsData] = useState<any>(null)
  const [analyticsDateRange, setAnalyticsDateRange] = useState('30')
  const [loadingAnalytics, setLoadingAnalytics] = useState(false)

  const fetchAnalytics = useCallback(async (range: string = '30') => {
    if (!canViewReports) return
    setLoadingAnalytics(true)
    try {
      const response = await fetch(`/api/reports/analytics?range=${range}`, {
        headers: { 'Content-Type': 'application/json' },
      })
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setAnalyticsData(result.data)
        }
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load analytics data",
        variant: "destructive"
      })
    } finally {
      setLoadingAnalytics(false)
    }
  }, [canViewReports, safeUserId, safeCompanyId, toast])

  useEffect(() => {
    fetchAnalytics(analyticsDateRange)
  }, [fetchAnalytics, analyticsDateRange])

  const generateReport = async (type: string) => {
    try {
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type })
      });

      if (!response.ok) throw new Error('Failed to generate report via API');

      const result = await response.json();
      return result.data.report;
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate report.",
        variant: "destructive",
      });
      throw error;
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
).map(([status, count]) => `${status}: ${count}`).join('\\n')}
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
).map(([dept, count]) => `${dept}: ${count}`).join('\\n')}

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
${Object.entries(statusBreakdown as Record<string, number>).map(([status, count]) => `${status}: ${count} (${(leadsList.length ? ((count / leadsList.length) * 100) : 0).toFixed(1)}%)`).join('\\n')}

Priority Distribution:
High: ${leadsList.filter(l => l.priority === 'HIGH').length}
Medium: ${leadsList.filter(l => l.priority === 'MEDIUM').length}
Low: ${leadsList.filter(l => l.priority === 'LOW').length}

Average Credit Score: ${leadsList.length ? Math.round(leadsList.reduce((sum, lead) => sum + (lead.creditScore || 0), 0) / leadsList.length) : 0}
`
  }

  const handleGenerateReport = async (type: string) => {
    try {
      const report = await generateReport(type);
      setReports((prev: any) => [...prev, report]);

      let reportContent = '';
      switch (type) {
        case 'Sales': reportContent = generateSalesReport(); break;
        case 'Employee Performance': reportContent = generateEmployeePerformanceReport(); break;
        case 'Lead Conversion': reportContent = generateLeadConversionReport(); break;
        default: reportContent = 'General Report Content';
      }

      const blob = new Blob([reportContent], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${report.name.replace(/\\s+/g, '_')}.txt`;
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

  const handleExportReports = async () => {
    try {
      const reportsRes = await fetch('/api/reports', {
        headers: { 'Content-Type': 'application/json' },
      });
      if (reportsRes.ok) {
        const reportsData = await reportsRes.json();
        const reportsToExport = reportsData.success ? reportsData.data || [] : reports;

        const csvContent = [
          ['Report Name', 'Type', 'Generated Date', 'Status'],
          ...reportsToExport.map((report: any) => [
            report.name, report.type, report.generatedDate, report.status
          ])
        ].map(row => row.join(',')).join('\\n');

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
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Analytics & Reports</h2>
          <p className="text-sm text-gray-500">Comprehensive business intelligence and insights</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={analyticsDateRange} onValueChange={setAnalyticsDateRange}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Select range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => handleGenerateReport('Sales')}>
            <FileText className="h-4 w-4 mr-2" />
            Generate Report
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportReports}>
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
                <p className="text-xs text-blue-600 mt-2">{analyticsData.overview.activeLeads} active</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
              <CardHeader className="pb-2">
                <CardDescription className="text-green-700 font-medium">Conversion Rate</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="text-3xl font-bold text-green-900">{analyticsData.overview.conversionRate.toFixed(1)}%</div>
                  <TrendingUp className="h-8 w-8 text-green-600 opacity-50" />
                </div>
                <p className="text-xs text-green-600 mt-2">{analyticsData.overview.convertedLeads} converted</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
              <CardHeader className="pb-2">
                <CardDescription className="text-purple-700 font-medium">Revenue Pipeline</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="text-3xl font-bold text-purple-900">${(analyticsData.overview.pipelineRevenue / 1000000).toFixed(1)}M</div>
                  <DollarSign className="h-8 w-8 text-purple-600 opacity-50" />
                </div>
                <p className="text-xs text-purple-600 mt-2">${(analyticsData.overview.convertedRevenue / 1000000).toFixed(1)}M converted</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
              <CardHeader className="pb-2">
                <CardDescription className="text-orange-700 font-medium">Avg Response Time</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="text-3xl font-bold text-orange-900">{analyticsData.overview.avgResponseTime}h</div>
                  <Clock className="h-8 w-8 text-orange-600 opacity-50" />
                </div>
                <p className="text-xs text-orange-600 mt-2">{analyticsData.overview.responseRate.toFixed(0)}% within 2hrs</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Lead Trends Over Time</CardTitle>
              <CardDescription>Daily lead activity and conversions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64 min-w-0 sm:h-80">
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
                    <Area type="monotone" dataKey="total" stroke="#3b82f6" fillOpacity={1} fill="url(#colorNew)" name="New Leads" />
                    <Area type="monotone" dataKey="converted" stroke="#10b981" fillOpacity={1} fill="url(#colorConverted)" name="Converted" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Lead Status Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={Object.entries(analyticsData.statusDistribution).map(([name, value]) => ({ name, value }))}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {Object.keys(analyticsData.statusDistribution).map((_, index) => (
                          <Cell key={`cell-\${index}`} fill={['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][index % 5]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Lead Sources</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={Object.entries(analyticsData.sources).map(([name, value]) => ({ name, value }))}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <div className="text-center py-20 bg-gray-50 rounded-lg border border-gray-200">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No Analytics Data</h3>
          <p className="text-gray-500 max-w-md mx-auto mt-2">
            There is currently no data available for the selected period. 
            Try changing the date range or check back later.
          </p>
        </div>
      )}
    </div>
  )
}
