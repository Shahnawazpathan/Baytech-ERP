import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { invalidateCache } from '@/lib/cache';

// Mark a lead as contacted
export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    const body = await request.json();
    const { leadId } = body;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User authentication required' },
        { status: 401 }
      );
    }

    if (!leadId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check if lead exists and is assigned to this user or they have permission
    const lead = await db.lead.findUnique({
      where: { id: leadId }
    });

    if (!lead) {
      return NextResponse.json(
        { success: false, error: 'Lead not found' },
        { status: 404 }
      );
    }

    // Check if user has permission to update this lead
    // Either they are assigned to the lead or they are an admin/manager
    const hasPermission = 
      lead.assignedToId === userId || // User is assigned to the lead
      await isAdminOrManager(userId); // User is an admin or manager

    if (!hasPermission) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions to mark lead as contacted' },
        { status: 403 }
      );
    }

    // Update the lead to mark as contacted and set status to CONTACTED
    const updatedLead = await db.lead.update({
      where: { id: leadId },
      data: { 
        contactedAt: new Date(),
        status: 'CONTACTED', // Set status to CONTACTED as per the lead lifecycle
        updatedAt: new Date()
      }
    });

    invalidateCache('leads', lead.companyId);

    return NextResponse.json({
      success: true,
      data: updatedLead
    });
  } catch (error) {
    console.error('Error marking lead as contacted:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to mark lead as contacted' },
      { status: 500 }
    );
  }
}

// Helper function to check if user is admin or manager
async function isAdminOrManager(userId: string): Promise<boolean> {
  try {
    const user = await db.employee.findUnique({
      where: { id: userId },
      select: { role: { select: { name: true } } }
    });
    
    if (!user) return false;
    
    // Check if user's role contains "Admin" or "Manager" (case insensitive)
    const roleName = user.role?.name.toLowerCase();
    return roleName?.includes('admin') || roleName?.includes('manager');
  } catch (error) {
    console.error('Error checking user permissions:', error);
    return false;
  }
}
