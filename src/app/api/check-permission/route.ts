import { NextRequest, NextResponse } from 'next/server';
import { hasPermission } from '@/lib/rbac';

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    const { resource, action } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { hasPermission: false, error: 'User ID is required' },
        { status: 400 }
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