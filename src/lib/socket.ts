import { Server } from 'socket.io';
import { db } from './db';

export const setupSocket = (io: Server) => {
  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    
    // Handle client authentication
    socket.on('authenticate', (data: { userId: string; companyId: string }) => {
      const { userId, companyId } = data;
      
      // Join relevant rooms for notifications
      if (userId) {
        socket.join(`user_${userId}`);
      }
      if (companyId) {
        socket.join(`company_${companyId}`);
      }
      
      // Send current notifications to newly connected user
      sendUserNotifications(io, userId, companyId);
    });

    // Handle attendance check-in/check-out events
    socket.on('attendance_update', async (data: { employeeId: string; companyId: string; action: string; timestamp: Date }) => {
      try {
        // Create a notification for attendance event
        const notification = await db.notification.create({
          data: {
            title: `Attendance ${data.action}`,
            message: `Employee ${data.employeeId} has ${data.action} at ${new Date(data.timestamp).toLocaleTimeString()}`,
            type: 'INFO',
            category: 'ATTENDANCE',
            companyId: data.companyId,
            employeeId: data.employeeId,
          }
        });

        // Broadcast to relevant rooms
        io.to(`company_${data.companyId}`).emit('notification', {
          id: notification.id,
          title: notification.title,
          message: notification.message,
          type: notification.type,
          time: 'Just now'
        });

        io.to(`user_${data.employeeId}`).emit('notification', {
          id: notification.id,
          title: notification.title,
          message: notification.message,
          type: notification.type,
          time: 'Just now'
        });
      } catch (error) {
        console.error('Error creating attendance notification:', error);
      }
    });

    // Handle lead updates
    socket.on('lead_update', async (data: { leadId: string; companyId: string; action: string; updatedBy: string }) => {
      try {
        // Create a notification for lead event
        const notification = await db.notification.create({
          data: {
            title: `Lead ${data.action}`,
            message: `Lead has been ${data.action} by ${data.updatedBy}`,
            type: 'INFO',
            category: 'LEAD',
            companyId: data.companyId,
          }
        });

        // Broadcast to relevant rooms
        io.to(`company_${data.companyId}`).emit('notification', {
          id: notification.id,
          title: notification.title,
          message: notification.message,
          type: notification.type,
          time: 'Just now'
        });
      } catch (error) {
        console.error('Error creating lead notification:', error);
      }
    });

    // Handle employee updates
    socket.on('employee_update', async (data: { employeeId: string; companyId: string; action: string; updatedBy: string }) => {
      try {
        // Create a notification for employee event
        const notification = await db.notification.create({
          data: {
            title: `Employee ${data.action}`,
            message: `Employee has been ${data.action} by ${data.updatedBy}`,
            type: 'INFO',
            category: 'EMPLOYEE',
            companyId: data.companyId,
          }
        });

        // Broadcast to relevant rooms
        io.to(`company_${data.companyId}`).emit('notification', {
          id: notification.id,
          title: notification.title,
          message: notification.message,
          type: notification.type,
          time: 'Just now'
        });
      } catch (error) {
        console.error('Error creating employee notification:', error);
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });

    // Send welcome message
    socket.emit('message', {
      text: 'Welcome to Baytech ERP WebSocket Server!',
      senderId: 'system',
      timestamp: new Date().toISOString(),
    });
  });
};

// Function to send user notifications
async function sendUserNotifications(io: Server, userId: string, companyId: string) {
  try {
    // Get recent notifications for the user
    const whereClause: any = { 
      companyId, 
      isRead: false
    };
    
    if (userId) {
      whereClause.OR = [
        { employeeId: userId },
        { employeeId: null } // Include company-wide notifications
      ];
    }
    
    const notifications = await db.notification.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    // Send notifications to user
    if (userId) {
      io.to(`user_${userId}`).emit('notifications', notifications.map(n => ({
        id: n.id,
        title: n.title,
        message: n.message,
        type: n.type,
        time: formatTimeAgo(n.createdAt),
        isRead: n.isRead
      })));
    }
    
    // Also send to company room
    io.to(`company_${companyId}`).emit('notifications', notifications.map(n => ({
      id: n.id,
      title: n.title,
      message: n.message,
      type: n.type,
      time: formatTimeAgo(n.createdAt),
      isRead: n.isRead
    })));
  } catch (error) {
    console.error('Error sending user notifications:', error);
  }
}

// Helper function to format time ago
function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  } else if (diffHours > 0) {
    return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  } else if (diffMins > 0) {
    return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
  } else {
    return 'Just now';
  }
}