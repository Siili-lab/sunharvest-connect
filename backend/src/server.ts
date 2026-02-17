import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { app } from './app';
import { config } from './config';
import { connectRedis } from './services/redisClient';
import { verifyToken } from './middleware/auth';
import { registerClient, removeClient } from './services/notificationService';

const BASE_PORT = Number(config.port);
const MAX_RETRIES = 5;

function startServer(port: number, attempt: number = 0): void {
  const server = http.createServer(app);

  // WebSocket server
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: WebSocket, req) => {
    // Authenticate via token in query string: /ws?token=xxx
    const url = new URL(req.url || '', `http://localhost:${port}`);
    const token = url.searchParams.get('token');

    if (!token) {
      ws.close(4001, 'Authentication required');
      return;
    }

    const payload = verifyToken(token);
    if (!payload) {
      ws.close(4001, 'Invalid token');
      return;
    }

    const userId = payload.userId;
    registerClient(userId, ws);
    console.log(`[WS] Client connected: ${userId}`);

    // Heartbeat
    let isAlive = true;
    ws.on('pong', () => { isAlive = true; });

    const heartbeat = setInterval(() => {
      if (!isAlive) {
        ws.terminate();
        return;
      }
      isAlive = false;
      ws.ping();
    }, 30000);

    ws.on('close', () => {
      clearInterval(heartbeat);
      removeClient(userId, ws);
      console.log(`[WS] Client disconnected: ${userId}`);
    });

    ws.on('error', () => {
      clearInterval(heartbeat);
      removeClient(userId, ws);
    });

    // Send a welcome message
    ws.send(JSON.stringify({ type: 'connected', userId }));
  });

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
    console.log(`WebSocket available at ws://localhost:${port}/ws`);
    console.log(`Health check: http://localhost:${port}/health`);
    console.log(`Environment: ${config.nodeEnv}`);
  });

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE' && attempt < MAX_RETRIES) {
      const next = port + 1;
      console.warn(`Port ${port} in use, trying ${next}...`);
      server.close();
      startServer(next, attempt + 1);
    } else {
      console.error('Server failed to start:', err.message);
      process.exit(1);
    }
  });
}

// Connect Redis (non-blocking, falls back gracefully)
connectRedis().then(() => {
  startServer(BASE_PORT);
}).catch(() => {
  console.warn('[Redis] Starting without cache');
  startServer(BASE_PORT);
});
