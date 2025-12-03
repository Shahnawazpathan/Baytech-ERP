import { useEffect, useState, useCallback } from 'react';
import { useAuth } from './use-auth';

interface PermissionCheck {
  resource: string;
  action: string;
}

export function usePermissions() {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  const bootstrapAdminPermissions = useCallback(() => {
    // Fast-path: admins/managers get all defined permissions without extra requests
    if (!user) return {};
    const role = user.role?.toLowerCase() || '';
    if (role.includes('admin') || role.includes('manager')) {
      const resources = ['employee', 'lead', 'attendance', 'department', 'role', 'permission', 'report', 'notification'];
      const actions = ['CREATE', 'READ', 'UPDATE', 'DELETE'];
      const map: Record<string, boolean> = {};
      resources.forEach(r => actions.forEach(a => { map[`${r}_${a}`] = true; }));
      map['report_READ'] = true;
      map['report_CREATE'] = true;
      map['notification_READ'] = true;
      map['notification_UPDATE'] = true;
      return map;
    }
    return {};
  }, [user]);

  const loadPermissions = useCallback(async () => {
    if (!user) {
      setPermissions({});
      setLoading(false);
      return;
    }

    // Use optimistic admin defaults, then refine if API returns data
    const optimistic = bootstrapAdminPermissions();
    if (Object.keys(optimistic).length > 0) {
      setPermissions(optimistic);
    }

    setLoading(true);
    try {
      const response = await fetch('/api/permissions', {
        method: 'GET',
        headers: {
          'x-user-id': user.id,
          'x-company-id': user.companyId || '',
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data?.map) {
          setPermissions(data.map);
        } else if (Array.isArray(data?.permissions)) {
          const map = (data.permissions as Array<{ resource: string; action: string }>).reduce(
            (acc, perm) => {
              acc[`${perm.resource}_${perm.action}`] = true;
              return acc;
            },
            {} as Record<string, boolean>
          );
          setPermissions(map);
        }
      } else {
        // Fall back to optimistic if API fails
        setPermissions(prev => Object.keys(prev).length ? prev : optimistic);
      }
    } catch (error) {
      console.error('Permission fetch error:', error);
      setPermissions(prev => Object.keys(prev).length ? prev : optimistic);
    } finally {
      setLoading(false);
    }
  }, [bootstrapAdminPermissions, user]);

  useEffect(() => {
    loadPermissions();
  }, [loadPermissions]);

  const hasPermission = useCallback((resource: string, action: string) => {
    return permissions[`${resource}_${action}`] || false;
  }, [permissions]);

  const checkPermissions = useCallback((permissionChecks: PermissionCheck[]): Record<string, boolean> => {
    return permissionChecks.reduce<Record<string, boolean>>((acc, perm) => {
      const key = `${perm.resource}_${perm.action}`;
      acc[key] = permissions[key] || false;
      return acc;
    }, {});
  }, [permissions]);

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
    refreshPermissions: loadPermissions,
    hasPermission,
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
