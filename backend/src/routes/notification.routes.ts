/**
 * Notification Routes — CRUD for user notifications
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// GET /notifications — Get user's notifications (paginated, newest first)
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.notification.count({ where: { userId } }),
    ]);

    res.json({
      success: true,
      data: {
        notifications: notifications.map((n) => ({
          id: n.id,
          type: n.type,
          title: n.title,
          message: n.message,
          data: n.data,
          isRead: n.isRead,
          createdAt: n.createdAt.toISOString(),
        })),
        total,
      },
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ success: false, error: { code: 'FETCH_FAILED', message: 'Failed to fetch notifications' } });
  }
});

// PUT /notifications/:id/read — Mark single notification as read
router.put('/:id/read', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const { id } = req.params;

    const notification = await prisma.notification.findUnique({ where: { id } });

    if (!notification) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Notification not found' } });
    }

    if (notification.userId !== userId) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Not your notification' } });
    }

    await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error marking notification read:', error);
    res.status(500).json({ success: false, error: { code: 'UPDATE_FAILED', message: 'Failed to update notification' } });
  }
});

// PUT /notifications/read-all — Mark all as read
router.put('/read-all', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;

    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error marking all notifications read:', error);
    res.status(500).json({ success: false, error: { code: 'UPDATE_FAILED', message: 'Failed to update notifications' } });
  }
});

// GET /notifications/unread-count — Get unread count
router.get('/unread-count', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;

    const count = await prisma.notification.count({
      where: { userId, isRead: false },
    });

    res.json({ success: true, data: { count } });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ success: false, error: { code: 'FETCH_FAILED', message: 'Failed to fetch unread count' } });
  }
});

export { router as notificationRouter };
