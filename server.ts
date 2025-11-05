// server.ts - Next.js Standalone + Socket.IO
import { setupSocket } from '@/lib/socket';
import { createServer } from 'http';
import { Server } from 'socket.io';
import next from 'next';
import { initializeSystem } from '@/lib/init';
import path from 'path';
import { fileURLToPath } from 'url';

// Only fall back to local SQLite when DATABASE_URL isn't provided (e.g. fresh local dev)
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = `file:${path.join(process.cwd(), 'dev.db')}`;
}

const dev = process.env.NODE_ENV !== 'production';
const currentPort = process.env.PORT ? parseInt(process.env.PORT) : 3000;
const hostname = '0.0.0.0';

// Function to run auto-assignment job
async function runAutoAssignment() {
  try {
    // Import dynamically to avoid Next.js build issues
    const { db } = await import('@/lib/db');
    
    console.log('Starting automatic lead reassignment job...');
    
    // Find leads that were assigned more than 2 hours ago but not contacted
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago

    const uncontactedLeads = await db.lead.findMany({
      where: {
        assignedToId: { not: null }, // Leads that are assigned
        assignedAt: { not: null }, // Leads that have an assignment time
        contactedAt: null, // Leads that haven't been contacted yet
        assignedAt: { lte: twoHoursAgo }, // Assigned more than 2 hours ago
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

    console.log(`Found ${uncontactedLeads.length} leads to reassign`);

    if (uncontactedLeads.length === 0) {
      console.log('No leads need reassignment');
      return;
    }

    // Process each uncontacted lead
    const results = [];
    for (const lead of uncontactedLeads) {
      try {
        // Find available employees in the same department with the least assigned leads
        const availableEmployees = await db.employee.findMany({
          where: {
            departmentId: lead.assignedTo?.departmentId,
            status: 'ACTIVE',
            isActive: true
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

        console.log(`Lead ${lead.id} reassigned from ${previousAssigneeId} to ${leastLoadedEmployee.id}`);

      } catch (error) {
        console.error(`Error reassigning lead ${lead.id}:`, error);
        results.push({ leadId: lead.id, status: 'error', error: (error as Error).message });
      }
    }

    console.log(`Completed automatic reassignment job. Reassigned ${results.filter(r => r.status === 'reassigned').length} leads.`);
  } catch (error) {
    console.error('Error in automatic lead reassignment:', error);
  }
}

// Set up the auto-assignment job to run every 2 hours
function setupAutoAssignmentJob() {
  // Run immediately when server starts
  runAutoAssignment();
  
  // Then run every 2 hours (7,200,000 ms)
  const interval = 2 * 60 * 60 * 1000; // 2 hours in milliseconds
  setInterval(runAutoAssignment, interval);
  
  console.log('Auto-assignment job scheduled to run every 2 hours');
}

// Custom server with Socket.IO integration
async function createCustomServer() {
  try {
    // Create Next.js app
    const nextApp = next({ 
      dev,
      dir: process.cwd(),
      // In production, use the current directory where .next is located
      conf: dev ? undefined : { distDir: './.next' }
    });

    await nextApp.prepare();
    const handle = nextApp.getRequestHandler();

    // Create HTTP server that will handle both Next.js and Socket.IO
    const server = createServer((req, res) => {
      // Skip socket.io requests from Next.js handler
      if (req.url?.startsWith('/api/socketio')) {
        return;
      }
      handle(req, res);
    });

    // Setup Socket.IO
    const io = new Server(server, {
      path: '/api/socketio',
      cors: {
        origin: process.env.NODE_ENV === 'production' 
          ? [process.env.APP_URL || ''] 
          : ["http://localhost:*", "http://127.0.0.1:*"],
        methods: ["GET", "POST"],
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    setupSocket(io);

    // Run system initialization
    await initializeSystem();
    
    // Start the server
    server.listen(currentPort, hostname, () => {
      console.log(`> Ready on http://${hostname}:${currentPort}`);
      console.log(`> Socket.IO server running at ws://${hostname}:${currentPort}/api/socketio`);
      
      // Set up the auto-assignment job after server starts
      setupAutoAssignmentJob();
    });

  } catch (err) {
    console.error('Server startup error:', err);
    process.exit(1);
  }
}

// Start the server
createCustomServer();
