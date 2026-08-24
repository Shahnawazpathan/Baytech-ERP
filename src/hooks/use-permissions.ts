import { useEffect, useState, useCallback } from 'react';
import { useAuth } from './use-auth';

interface PermissionCheck {
  resource: string;
  action: string;
}

/**
 * Client-side permission mirror of the server's RBAC (src/lib/rbac.ts).
 *
 * The single source of truth is the permission set assigned to the user's
 * role in the database, served by GET /api/permissions. No role-name
 * sniffing and no hardcoded admin bypasses here - if a permission isn't in
 * the server response, the UI hides it.
 */
export function usePermissions() {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  const loadPermissions = useCallback(async () => {
    if (!user) {
      setPermissions({});
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Identity is derived from the httpOnly session cookie by the server
      const response = await fetch('/api/permissions');

      if (response.ok) {
        const data = await response.json();
        let map: Record<string, boolean> = {};

        if (data?.map && typeof data.map === 'object') {
          map = data.map;
        } else if (Array.isArray(data?.permissions)) {
          map = (data.permissions as Array<{ resource: string; action: string }>).reduce(
            (acc, perm) => {
              acc[`${perm.resource}_${perm.action}`] = true;
              return acc;
            },
            {} as Record<string, boolean>
          );
        }

        setPermissions(map);
      } else {
        // On failure grant nothing visible - fail closed, never open
        setPermissions({});
      }
    } catch (error) {
      console.error('Permission fetch error:', error);
      setPermissions({});
    } finally {
      setLoading(false);
    }
  }, [user]);

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

  return {
    permissions,
    loading,
    refreshPermissions: loadPermissions,
    hasPermission,
    checkPermissions,
    canViewEmployees: hasPermission('employee', 'READ'),
    canCreateEmployees: hasPermission('employee', 'CREATE'),
    canUpdateEmployees: hasPermission('employee', 'UPDATE'),
    canDeleteEmployees: hasPermission('employee', 'DELETE'),
    canViewLeads: hasPermission('lead', 'READ'),
    canCreateLeads: hasPermission('lead', 'CREATE'),
    canUpdateLeads: hasPermission('lead', 'UPDATE'),
    canDeleteLeads: hasPermission('lead', 'DELETE'),
    canViewAttendance: hasPermission('attendance', 'READ'),
    canCreateAttendance: hasPermission('attendance', 'CREATE'),
    canUpdateAttendance: hasPermission('attendance', 'UPDATE'),
    canDeleteAttendance: hasPermission('attendance', 'DELETE'),
    canViewReports: hasPermission('report', 'READ'),
  };
}
