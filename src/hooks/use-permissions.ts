import { useEffect, useState } from 'react';
import { useAuth } from './use-auth';

interface PermissionCheck {
  resource: string;
  action: string;
}

export function usePermissions() {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  // Check if user has a specific permission
  const hasPermission = async (resource: string, action: string): Promise<boolean> => {
    if (!user) {
      return false;
    }

    try {
      const response = await fetch('/api/check-permission', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id,
        },
        body: JSON.stringify({ resource, action })
      });

      if (response.ok) {
        const data = await response.json();
        return data.hasPermission;
      }
      return false;
    } catch (error) {
      console.error('Permission check error:', error);
      return false;
    }
  };

  // Check multiple permissions at once
  const checkPermissions = async (permissionChecks: PermissionCheck[]): Promise<Record<string, boolean>> => {
    if (!user) {
      return {};
    }

    const result: Record<string, boolean> = {};
    
    for (const perm of permissionChecks) {
      const key = `${perm.resource}_${perm.action}`;
      result[key] = await hasPermission(perm.resource, perm.action);
    }

    return result;
  };

  // Preload common permissions
  useEffect(() => {
    const loadPermissions = async () => {
      if (user) {
        setLoading(true);
        const allPermissions = [
          // Employee permissions
          { resource: 'employee', action: 'CREATE' },
          { resource: 'employee', action: 'READ' },
          { resource: 'employee', action: 'UPDATE' },
          { resource: 'employee', action: 'DELETE' },
          
          // Lead permissions
          { resource: 'lead', action: 'CREATE' },
          { resource: 'lead', action: 'READ' },
          { resource: 'lead', action: 'UPDATE' },
          { resource: 'lead', action: 'DELETE' },
          
          // Attendance permissions
          { resource: 'attendance', action: 'CREATE' },
          { resource: 'attendance', action: 'READ' },
          { resource: 'attendance', action: 'UPDATE' },
          { resource: 'attendance', action: 'DELETE' },
          
          // Department permissions
          { resource: 'department', action: 'CREATE' },
          { resource: 'department', action: 'READ' },
          { resource: 'department', action: 'UPDATE' },
          { resource: 'department', action: 'DELETE' },
          
          // Role permissions
          { resource: 'role', action: 'CREATE' },
          { resource: 'role', action: 'READ' },
          { resource: 'role', action: 'UPDATE' },
          { resource: 'role', action: 'DELETE' },
          
          // Report permissions
          { resource: 'report', action: 'READ' },
          { resource: 'report', action: 'CREATE' },
          
          // Notification permissions
          { resource: 'notification', action: 'READ' },
          { resource: 'notification', action: 'UPDATE' },
        ];

        const perms = await checkPermissions(allPermissions);
        setPermissions(perms);
        setLoading(false);
      }
    };

    loadPermissions();
  }, [user]);

  // Specialized permission checks for UI
  const canViewEmployees = permissions['employee_READ'] || false;
  const canCreateEmployees = permissions['employee_CREATE'] || false;
  const canUpdateEmployees = permissions['employee_UPDATE'] || false;
  const canDeleteEmployees = permissions['employee_DELETE'] || false;
  
  const canViewLeads = permissions['lead_READ'] || false;
  const canCreateLeads = permissions['lead_CREATE'] || false;
  const canUpdateLeads = permissions['lead_UPDATE'] || false;
  const canDeleteLeads = permissions['lead_DELETE'] || false;
  
  const canViewAttendance = permissions['attendance_READ'] || false;
  const canCreateAttendance = permissions['attendance_CREATE'] || false;
  const canUpdateAttendance = permissions['attendance_UPDATE'] || false;
  const canDeleteAttendance = permissions['attendance_DELETE'] || false;
  
  const canViewReports = permissions['report_READ'] || false;

  return {
    permissions,
    loading,
    hasPermission: (resource: string, action: string) => 
      permissions[`${resource}_${action}`] || false,
    checkPermissions,
    // Specialized permission checks
    canViewEmployees,
    canCreateEmployees,
    canUpdateEmployees,
    canDeleteEmployees,
    canViewLeads,
    canCreateLeads,
    canUpdateLeads,
    canDeleteLeads,
    canViewAttendance,
    canCreateAttendance,
    canUpdateAttendance,
    canDeleteAttendance,
    canViewReports,
  };
}