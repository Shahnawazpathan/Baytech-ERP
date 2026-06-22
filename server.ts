import 'dotenv/config';
// server.ts - Next.js Standalone + Socket.IO
import { setupSocket } from '@/lib/socket';
import fs from 'fs';
import { createServer } from 'http';
import { Server } from 'socket.io';
import next from 'next';
import { initializeSystem } from '@/lib/init';
import path from 'path';
import { fileURLToPath } from 'url';





const dev = process.env.NODE_ENV !== 'production';
const currentPort = process.env.PORT ? parseInt(process.env.PORT) : 3007;
const hostname = '0.0.0.0';

function clearStaleProductionBuildForDev() {
  if (!dev) return;

  const nextDir = path.join(process.cwd(), '.next');
  const productionBuildMarker = path.join(nextDir, 'BUILD_ID');

  if (fs.existsSync(productionBuildMarker)) {
    console.log('Removing stale production .next output before starting dev server...');
    fs.rmSync(nextDir, { recursive: true, force: true });
  }
}

// Return inactive assigned leads to the shared leads pool.
async function runLeadPoolReclamation() {
  try {
    const { reclaimInactiveLeadsToPool } = await import('@/lib/lead-pool');
    console.log('Starting inactive lead pool reclamation...');
    const results = await reclaimInactiveLeadsToPool();
    console.log(`Lead pool reclamation completed. Returned ${results.filter(r => r.status === 'returned_to_pool').length} leads.`);
  } catch (error) {
    console.error('Error in lead pool reclamation:', error);
  }
}

// Check frequently; only leads inactive for the configured 8-hour window are returned.
function setupLeadPoolReclamationJob() {
  // Run after 10 seconds (non-blocking server startup)
  setTimeout(() => {
    runLeadPoolReclamation();
  }, 10000);

  const interval = 5 * 60 * 1000;
  setInterval(runLeadPoolReclamation, interval);

  if (process.env.NODE_ENV === 'development') {
    console.log('Lead pool reclamation scheduled to run every 5 minutes');
  }
}

// Custom server with Socket.IO integration
async function createCustomServer() {
  try {
    clearStaleProductionBuildForDev();

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
      
      setupLeadPoolReclamationJob();
    });

  } catch (err) {
    console.error('Server startup error:', err);
    process.exit(1);
  }
}

// Start the server
createCustomServer();
