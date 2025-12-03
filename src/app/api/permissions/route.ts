import { NextRequest, NextResponse } from 'next/server';
import { getUserPermissions } from '@/lib/rbac';

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const permissions = await getUserPermissions(userId);

    const map = permissions.reduce<Record<string, boolean>>((acc, perm) => {
      acc[`${perm.resource}_${perm.action}`] = true;
      return acc;
    }, {});

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
