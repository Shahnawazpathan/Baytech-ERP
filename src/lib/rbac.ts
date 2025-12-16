import { db } from '@/lib/db';
import { cache, createCacheKey } from '@/lib/cache';

const prisma = db;

export interface PermissionCheck {
  resource: string;
  action: string;
}

/**
 * Get user permissions from cache or database
 */
async function getUserPermissionsInternal(userId: string) {
  const cacheKey = createCacheKey('user-permissions', { userId });
  const cached = cache.get(cacheKey);

  if (cached) {
    return cached;
  }

  try {
    const user = await prisma.employee.findUnique({
      where: { id: userId },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true
              }
            }
          }
        }
      }
    });

    if (!user || !user.role) {
      return null;
    }

    const userPermissions = {
      role: user.role,
      permissions: user.role.permissions.map(rp => rp.permission)
    };

    // Cache for 5 minutes
    cache.set(cacheKey, userPermissions, 300000);

    return userPermissions;
  } catch (error) {
    console.error('Get user permissions error:', error);
    return null;
  }
}

/**
 * Check if a user has permission to perform an action on a resource
 */
export async function hasPermission(userId: string, resource: string, action: string): Promise<boolean> {
  try {
    const userPermissions = await getUserPermissionsInternal(userId);

    if (!userPermissions) {
      return false;
    }

    // Check if the user's role has the required permission
    const hasPerm = userPermissions.role.permissions.some(
      (rolePerm) =>
        rolePerm.permission.resource === resource &&
        rolePerm.permission.action === action &&
        rolePerm.permission.isActive
    );

    return hasPerm;
  } catch (error) {
    console.error('Permission check error:', error);
    return false;
  }
}

/**
 * Check multiple permissions at once (optimized to use single cache lookup)
 */
export async function hasMultiplePermissions(userId: string, permissions: PermissionCheck[]): Promise<boolean[]> {
  const userPermissions = await getUserPermissionsInternal(userId);

  if (!userPermissions) {
    return permissions.map(() => false);
  }

  return permissions.map(perm => {
    return userPermissions.role.permissions.some(
      (rolePerm) =>
        rolePerm.permission.resource === perm.resource &&
        rolePerm.permission.action === perm.action &&
        rolePerm.permission.isActive
    );
  });
}

/**
 * Get all permissions for a user (uses cache)
 */
export async function getUserPermissions(userId: string) {
  try {
    const userPermissions = await getUserPermissionsInternal(userId);

    if (!userPermissions) {
      return [];
    }

    return userPermissions.permissions;
  } catch (error) {
    console.error('Get user permissions error:', error);
    return [];
  }
}

/**
 * Invalidate user permission cache (call this when role/permissions change)
 */
export function invalidateUserPermissions(userId: string) {
  const cacheKey = createCacheKey('user-permissions', { userId });
  cache.delete(cacheKey);
}
