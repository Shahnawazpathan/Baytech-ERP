import { NextRequest, NextResponse } from 'next/server';
import { hasPermission } from '@/lib/rbac';
import { getSessionUser } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const sessionUser = await getSessionUser(request);
    const userId = sessionUser?.id;
    const { resource, action } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { hasPermission: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const permission = await hasPermission(userId, resource, action);

    return NextResponse.json({ 
      hasPermission: permission 
    });
  } catch (error) {
    console.error('Permission check error:', error);
    return NextResponse.json(
      { hasPermission: false, error: 'Failed to check permission' },
      { status: 500 }
    );
  }
}
