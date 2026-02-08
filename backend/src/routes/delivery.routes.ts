import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { requireSelfOrAdmin } from '../middleware/ownership';

const router = Router();
const prisma = new PrismaClient();

const requireTransporter = requireRole('TRANSPORTER');

// GET /api/v1/deliveries/available — list transactions needing a transporter (transporter only)
router.get('/available', requireAuth, requireTransporter, async (req: Request, res: Response) => {
  try {
    const { county, limit = '50' } = req.query;

    const where: any = {
      status: 'PAID',
      transporterId: null,
    };

    // Optionally filter by listing county
    if (county) {
      where.listing = {
        county: { contains: county as string, mode: 'insensitive' },
      };
    }

    const transactions = await prisma.transaction.findMany({
      where,
      include: {
        listing: {
          select: {
            id: true,
            cropType: true,
            quantity: true,
            county: true,
            farmer: {
              select: { id: true, name: true, phone: true, county: true },
            },
          },
        },
        buyer: {
          select: { id: true, name: true, phone: true, county: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string),
    });

    const data = transactions.map((tx) => ({
      transactionId: tx.id,
      crop: tx.listing.cropType,
      quantity: tx.quantity,
      unit: tx.unit,
      agreedPrice: tx.agreedPrice,
      pickup: {
        county: tx.listing.county,
        farmerName: tx.listing.farmer.name,
        farmerPhone: tx.listing.farmer.phone,
      },
      delivery: {
        county: tx.buyer.county,
        buyerName: tx.buyer.name,
        buyerPhone: tx.buyer.phone,
      },
      createdAt: tx.createdAt,
    }));

    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching available deliveries:', error);
    res.status(500).json({
      success: false,
      error: { code: 'FETCH_FAILED', message: 'Failed to fetch available deliveries' },
    });
  }
});

// POST /api/v1/deliveries/:transactionId/accept — transporter claims a job (use token userId)
router.post('/:transactionId/accept', requireAuth, requireTransporter, async (req: Request, res: Response) => {
  try {
    const { transactionId } = req.params;
    const transporterId = (req as AuthenticatedRequest).user.userId;

    // Verify the transaction exists and is PAID with no transporter
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
    });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Transaction not found' },
      });
    }

    if (transaction.status !== 'PAID') {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_STATUS', message: `Transaction status is ${transaction.status}, expected PAID` },
      });
    }

    if (transaction.transporterId) {
      return res.status(409).json({
        success: false,
        error: { code: 'ALREADY_CLAIMED', message: 'This delivery has already been claimed' },
      });
    }

    const updated = await prisma.transaction.update({
      where: { id: transactionId },
      data: {
        transporterId,
        status: 'IN_TRANSIT',
        pickupDate: new Date(),
      },
    });

    res.json({
      success: true,
      data: {
        transactionId: updated.id,
        status: updated.status,
        transporterId: updated.transporterId,
        pickupDate: updated.pickupDate,
      },
    });
  } catch (error) {
    console.error('Error accepting delivery:', error);
    res.status(500).json({
      success: false,
      error: { code: 'ACCEPT_FAILED', message: 'Failed to accept delivery' },
    });
  }
});

// PUT /api/v1/deliveries/:transactionId/complete — transporter marks delivery done (verify assigned)
router.put('/:transactionId/complete', requireAuth, requireTransporter, async (req: Request, res: Response) => {
  try {
    const { transactionId } = req.params;
    const userId = (req as AuthenticatedRequest).user.userId;

    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
    });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Transaction not found' },
      });
    }

    if (transaction.transporterId !== userId) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You are not the assigned transporter for this delivery.' },
      });
    }

    if (transaction.status !== 'IN_TRANSIT') {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_STATUS', message: `Transaction status is ${transaction.status}, expected IN_TRANSIT` },
      });
    }

    const updated = await prisma.transaction.update({
      where: { id: transactionId },
      data: {
        status: 'DELIVERED',
        deliveredAt: new Date(),
      },
    });

    res.json({
      success: true,
      data: {
        transactionId: updated.id,
        status: updated.status,
        deliveredAt: updated.deliveredAt,
      },
    });
  } catch (error) {
    console.error('Error completing delivery:', error);
    res.status(500).json({
      success: false,
      error: { code: 'COMPLETE_FAILED', message: 'Failed to complete delivery' },
    });
  }
});

// GET /api/v1/deliveries/my/:transporterId — transporter's jobs (self or admin)
router.get('/my/:transporterId', requireAuth, requireTransporter, requireSelfOrAdmin('transporterId'), async (req: Request, res: Response) => {
  try {
    const { transporterId } = req.params;
    const { status, limit = '50' } = req.query;

    const where: any = {
      transporterId,
    };

    if (status) {
      where.status = (status as string).toUpperCase();
    }

    const transactions = await prisma.transaction.findMany({
      where,
      include: {
        listing: {
          select: {
            id: true,
            cropType: true,
            quantity: true,
            county: true,
            farmer: {
              select: { id: true, name: true, phone: true, county: true },
            },
          },
        },
        buyer: {
          select: { id: true, name: true, phone: true, county: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: parseInt(limit as string),
    });

    const data = transactions.map((tx) => ({
      transactionId: tx.id,
      status: tx.status,
      crop: tx.listing.cropType,
      quantity: tx.quantity,
      unit: tx.unit,
      agreedPrice: tx.agreedPrice,
      pickup: {
        county: tx.listing.county,
        farmerName: tx.listing.farmer.name,
        farmerPhone: tx.listing.farmer.phone,
      },
      delivery: {
        county: tx.buyer.county,
        buyerName: tx.buyer.name,
        buyerPhone: tx.buyer.phone,
      },
      pickupDate: tx.pickupDate,
      deliveredAt: tx.deliveredAt,
      createdAt: tx.createdAt,
    }));

    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching transporter deliveries:', error);
    res.status(500).json({
      success: false,
      error: { code: 'FETCH_FAILED', message: 'Failed to fetch deliveries' },
    });
  }
});

export { router as deliveryRouter };
