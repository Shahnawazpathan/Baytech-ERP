import { db } from '@/lib/db';

const prisma = db;

export interface PermissionCheck {
  resource: string;
  action: string;
}

/**
 * Check if a user has permission to perform an action on a resource
 */
export async function hasPermission(userId: string, resource: string, action: string): Promise<boolean> {
  try {
    // Get the user's role
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
      return false;
    }

    // Check if the user's role has the required permission
    const hasPerm = user.role.permissions.some(
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
 * Check multiple permissions at once
 */
export async function hasMultiplePermissions(userId: string, permissions: PermissionCheck[]): Promise<boolean[]> {
  const results: boolean[] = [];
  for (const perm of permissions) {
    results.push(await hasPermission(userId, perm.resource, perm.action));
  }
  return results;
}

/**
 * Get all permissions for a user
 */
export async function getUserPermissions(userId: string) {
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
      return [];
    }

    return user.role.permissions.map(rp => rp.permission);
  } catch (error) {
    console.error('Get user permissions error:', error);
    return [];
  }
}
