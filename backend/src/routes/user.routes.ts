import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/auth';
import { requireSelfOrAdmin } from '../middleware/ownership';

const router = Router();
const prisma = new PrismaClient();

// GET /api/v1/users/:id/stats — role-specific stats (self or admin)
router.get('/:id/stats', requireAuth, requireSelfOrAdmin('id'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' },
      });
    }

    let stats: any = {
      role: user.role,
      name: user.name,
      rating: user.rating,
      totalRatings: user.totalRatings,
    };

    if (user.role === 'FARMER') {
      const [totalListings, activeListings, soldListings] = await Promise.all([
        prisma.produceListing.count({ where: { farmerId: id } }),
        prisma.produceListing.count({ where: { farmerId: id, status: 'ACTIVE' } }),
        prisma.produceListing.count({ where: { farmerId: id, status: 'SOLD' } }),
      ]);

      // Total revenue from completed transactions on farmer's listings
      const revenueResult = await prisma.transaction.aggregate({
        where: {
          listing: { farmerId: id },
          status: { in: ['COMPLETED', 'DELIVERED'] },
        },
        _sum: { agreedPrice: true },
      });

      stats = {
        ...stats,
        totalListings,
        activeListings,
        totalSold: soldListings,
        totalRevenue: revenueResult._sum.agreedPrice || 0,
      };
    } else if (user.role === 'BUYER') {
      const [totalPurchases, activeOffers] = await Promise.all([
        prisma.transaction.count({
          where: { buyerId: id, status: { in: ['COMPLETED', 'DELIVERED'] } },
        }),
        prisma.transaction.count({
          where: { buyerId: id, status: { in: ['PENDING', 'ACCEPTED', 'PAYMENT_PENDING'] } },
        }),
      ]);

      const spentResult = await prisma.transaction.aggregate({
        where: {
          buyerId: id,
          status: { in: ['COMPLETED', 'DELIVERED', 'PAID', 'IN_TRANSIT'] },
        },
        _sum: { agreedPrice: true },
      });

      stats = {
        ...stats,
        totalPurchases,
        totalSpent: spentResult._sum.agreedPrice || 0,
        activeOffers,
      };
    } else if (user.role === 'TRANSPORTER') {
      const [totalDeliveries, activeJobs] = await Promise.all([
        prisma.transaction.count({
          where: { transporterId: id, status: { in: ['COMPLETED', 'DELIVERED'] } },
        }),
        prisma.transaction.count({
          where: { transporterId: id, status: 'IN_TRANSIT' },
        }),
      ]);

      // Transporters earn a portion of the transaction — for now just count transactions
      stats = {
        ...stats,
        totalDeliveries,
        activeJobs,
      };
    }

    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Error fetching user stats:', error);
    res.status(500).json({
      success: false,
      error: { code: 'FETCH_FAILED', message: 'Failed to fetch user stats' },
    });
  }
});

// PUT /api/v1/users/:id — update profile (self or admin)
router.put('/:id', requireAuth, requireSelfOrAdmin('id'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, county, subCounty, ward, language, vehicleType, vehicleCapacity } = req.body;

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' },
      });
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (county !== undefined) updateData.county = county;
    if (subCounty !== undefined) updateData.subCounty = subCounty;
    if (ward !== undefined) updateData.ward = ward;
    if (language !== undefined) updateData.language = language;
    if (vehicleType !== undefined) updateData.vehicleType = vehicleType;
    if (vehicleCapacity !== undefined) updateData.vehicleCapacity = parseFloat(vehicleCapacity);

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        phone: true,
        role: true,
        county: true,
        subCounty: true,
        ward: true,
        language: true,
        vehicleType: true,
        vehicleCapacity: true,
        rating: true,
        updatedAt: true,
      },
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({
      success: false,
      error: { code: 'UPDATE_FAILED', message: 'Failed to update user' },
    });
  }
});

// GET /api/v1/users/:id/transactions — paginated transaction history (self or admin)
router.get('/:id/transactions', requireAuth, requireSelfOrAdmin('id'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { page = '1', limit = '20', status } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' },
      });
    }

    // Build where clause depending on role
    const where: any = {};
    if (user.role === 'FARMER') {
      where.listing = { farmerId: id };
    } else if (user.role === 'BUYER') {
      where.buyerId = id;
    } else if (user.role === 'TRANSPORTER') {
      where.transporterId = id;
    }

    if (status) {
      where.status = (status as string).toUpperCase();
    }

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: {
          listing: {
            select: {
              id: true,
              cropType: true,
              county: true,
              farmer: { select: { id: true, name: true } },
            },
          },
          buyer: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.transaction.count({ where }),
    ]);

    const data = transactions.map((tx) => ({
      id: tx.id,
      crop: tx.listing.cropType,
      quantity: tx.quantity,
      unit: tx.unit,
      agreedPrice: tx.agreedPrice,
      status: tx.status,
      farmer: tx.listing.farmer,
      buyer: tx.buyer,
      county: tx.listing.county,
      paymentMethod: tx.paymentMethod,
      paymentRef: tx.paymentRef,
      pickupDate: tx.pickupDate,
      deliveredAt: tx.deliveredAt,
      createdAt: tx.createdAt,
    }));

    res.json({
      success: true,
      data,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Error fetching user transactions:', error);
    res.status(500).json({
      success: false,
      error: { code: 'FETCH_FAILED', message: 'Failed to fetch transactions' },
    });
  }
});

export { router as userRouter };
