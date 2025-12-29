import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Background job to reassign leads not contacted within 2 hours
export async function POST(request: NextRequest) {
  try {
    // Find leads that were assigned more than 8 hours ago but not contacted
    const eightHoursAgo = new Date(Date.now() - 8 * 60 * 60 * 1000); // 8 hours ago

    const uncontactedLeads = await db.lead.findMany({
      where: {
        assignedToId: { not: null }, // Leads that are assigned
        assignedAt: { not: null, lte: eightHoursAgo }, // Leads that have an assignment time and are older than 8 hours
        contactedAt: null, // Leads that haven't been contacted yet
        status: { in: ['NEW', 'CONTACTED'] } // Only reassign active leads
      },
      include: {
        assignedTo: {
          include: {
            department: true
          }
        }
      }
    });

    if (uncontactedLeads.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No leads need reassignment', 
        reassignedCount: 0 
      });
    }

    // Process each uncontacted lead
    const results: Array<{
      leadId: string;
      status: string;
      previousAssigneeId?: string | null;
      newAssigneeId?: string;
      error?: string;
    }> = [];
    for (const lead of uncontactedLeads) {
      try {
        // Find available employees in the same department with the least assigned leads (excluding admins)
        const availableEmployees = await db.employee.findMany({
          where: {
            departmentId: lead.assignedTo?.departmentId,
            status: 'ACTIVE',
            isActive: true,
            autoAssignEnabled: true,
            role: {
              name: {
                not: {
                  contains: 'Administrator'
                }
              }
            }
          }
        });

        if (availableEmployees.length === 0) {
          console.log(`No available employees in department for lead ${lead.id}`);
          results.push({ leadId: lead.id, status: 'no_available_employees' });
          continue;
        }

        // Count leads assigned to each employee
        const employeeLeadCounts: { [key: string]: number } = {};
        for (const emp of availableEmployees) {
          employeeLeadCounts[emp.id] = 0;
        }

        const assignedLeads = await db.lead.groupBy({
          by: ['assignedToId'],
          where: {
            assignedToId: { in: availableEmployees.map(e => e.id) },
            status: { in: ['NEW', 'CONTACTED'] }
          },
          _count: {
            id: true
          }
        });

        // Update counts based on existing assignments
        for (const assignment of assignedLeads) {
          if (assignment.assignedToId) {
            employeeLeadCounts[assignment.assignedToId] = assignment._count.id;
          }
        }

        // Find the employee with the least assigned leads
        let leastLoadedEmployee = availableEmployees[0];
        let minLeadCount = employeeLeadCounts[leastLoadedEmployee.id];

        for (const emp of availableEmployees) {
          const count = employeeLeadCounts[emp.id];
          if (count < minLeadCount) {
            minLeadCount = count;
            leastLoadedEmployee = emp;
          }
        }

        if (leastLoadedEmployee.id === lead.assignedToId) {
          // If the same employee would get the lead again, skip reassignment
          console.log(`Lead ${lead.id} already assigned to the least loaded employee`);
          results.push({ leadId: lead.id, status: 'already_least_loaded' });
          continue;
        }

        // Reassign the lead to the least loaded employee
        const previousAssigneeId = lead.assignedToId;
        const previousAssigneeName = lead.assignedTo ? `${lead.assignedTo.firstName} ${lead.assignedTo.lastName}` : 'Unassigned';

        const updatedLead = await db.lead.update({
          where: { id: lead.id },
          data: {
            assignedToId: leastLoadedEmployee.id,
            updatedAt: new Date()
          }
        });

        // Create lead history for reassignment
        await db.leadHistory.create({
          data: {
            leadId: lead.id,
            employeeId: leastLoadedEmployee.id,
            action: 'AUTO_REASSIGNED',
            oldValue: JSON.stringify({ 
              assignedToId: previousAssigneeId,
              assignedToName: previousAssigneeName
            }),
            newValue: JSON.stringify({ 
              assignedToId: leastLoadedEmployee.id,
              assignedToName: `${leastLoadedEmployee.firstName} ${leastLoadedEmployee.lastName}`
            }),
            notes: `Auto-reassigned from ${previousAssigneeName} to ${leastLoadedEmployee.firstName} ${leastLoadedEmployee.lastName} after 2 hours without contact`
          }
        });

        // Create notification for new assignee
        await db.notification.create({
          data: {
            title: 'Lead Auto-Reassigned',
            message: `${lead.firstName} ${lead.lastName} has been auto-reassigned to you after 2 hours without contact`,
            type: 'WARNING',
            category: 'LEAD',
            companyId: leastLoadedEmployee.companyId,
            employeeId: leastLoadedEmployee.id,
            metadata: JSON.stringify({ 
              leadId: lead.id, 
              leadNumber: lead.leadNumber,
              reason: 'auto_reassigned_no_contact'
            })
          }
        });

        // Create notification for previous assignee
        if (previousAssigneeId) {
          await db.notification.create({
            data: {
              title: 'Lead Auto-Reassigned',
              message: `${lead.firstName} ${lead.lastName} has been auto-reassigned to ${leastLoadedEmployee.firstName} ${leastLoadedEmployee.lastName} after 2 hours without contact`,
              type: 'INFO',
              category: 'LEAD',
              companyId: lead.assignedTo?.companyId || 'default-company',
              employeeId: previousAssigneeId,
              metadata: JSON.stringify({ 
                leadId: lead.id, 
                leadNumber: lead.leadNumber,
                reason: 'auto_reassigned_no_contact'
              })
            }
          });
        }

        results.push({ 
          leadId: lead.id, 
          status: 'reassigned', 
          previousAssigneeId,
          newAssigneeId: leastLoadedEmployee.id
        });

      } catch (error) {
        results.push({ leadId: lead.id, status: 'error', error: (error as Error).message });
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Automatic reassignment job completed', 
      reassignedCount: results.filter(r => r.status === 'reassigned').length,
      results 
    });

  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to run automatic reassignment job' },
      { status: 500 }
    );
  }
}
