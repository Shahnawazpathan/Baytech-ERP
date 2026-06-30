import { NextRequest, NextResponse } from 'next/server';
import { getUserPermissions } from '@/lib/rbac';
import { getSessionUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const sessionUser = await getSessionUser(request);
    const userId = sessionUser?.id;

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const permissions = await getUserPermissions(userId);

    const map = permissions.reduce((acc, perm) => {
      acc[`${perm.resource}_${perm.action}`] = true;
      return acc;
    }, {} as Record<string, boolean>);

    return NextResponse.json({
      permissions,
      map,
    });
  } catch (error) {
    console.error('Error fetching permissions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch permissions' },
      { status: 500 }
    );
  }
}
