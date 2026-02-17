/**
 * Notification Service — WebSocket + DB-backed notifications
 *
 * Maintains in-memory WebSocket client map and persists notifications to DB.
 */

import { PrismaClient } from '@prisma/client';
import { WebSocket } from 'ws';

const prisma = new PrismaClient();

// In-memory map of userId → active WebSocket connections
const clients = new Map<string, WebSocket[]>();

/**
 * Register a WebSocket client for a user
 */
export function registerClient(userId: string, ws: WebSocket): void {
  const existing = clients.get(userId) || [];
  existing.push(ws);
  clients.set(userId, existing);
}

/**
 * Remove a WebSocket client for a user
 */
export function removeClient(userId: string, ws: WebSocket): void {
  const existing = clients.get(userId);
  if (!existing) return;
  const filtered = existing.filter((c) => c !== ws);
  if (filtered.length === 0) {
    clients.delete(userId);
  } else {
    clients.set(userId, filtered);
  }
}

/**
 * Send a JSON payload to all connected WebSocket clients for a user
 */
export function broadcastToUser(userId: string, payload: any): void {
  const sockets = clients.get(userId);
  if (!sockets || sockets.length === 0) return;

  const message = JSON.stringify(payload);
  for (const ws of sockets) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  }
}

/**
 * Create a notification: save to DB + send via WebSocket if user is online
 */
export async function notifyUser(
  userId: string,
  type: string,
  title: string,
  message: string,
  data?: Record<string, any>
): Promise<void> {
  try {
    // Save to database
    const notification = await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        data: data || undefined,
      },
    });

    // Send via WebSocket if connected
    broadcastToUser(userId, {
      type: 'notification',
      notification: {
        id: notification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        data: notification.data,
        isRead: notification.isRead,
        createdAt: notification.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error creating notification:', error);
    // Non-fatal — don't throw
  }
}
