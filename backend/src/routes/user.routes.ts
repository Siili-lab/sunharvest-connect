import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth, optionalAuth } from '../middleware/auth';
import { requireSelfOrAdmin } from '../middleware/ownership';

const router = Router();
const prisma = new PrismaClient();

// GET /api/v1/users/:id/public-profile — public profile (no auth required)
router.get('/:id/public-profile', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        county: true,
        role: true,
        rating: true,
        totalRatings: true,
        createdAt: true,
        isVerified: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' },
      });
    }

    const [activeListings, completedDeals] = await Promise.all([
      prisma.produceListing.count({
        where: { farmerId: id, status: 'ACTIVE' },
      }),
      prisma.transaction.count({
        where: {
          OR: [
            { buyerId: id, status: { in: ['COMPLETED', 'DELIVERED'] } },
            { listing: { farmerId: id }, status: { in: ['COMPLETED', 'DELIVERED'] } },
          ],
        },
      }),
    ]);

    res.json({
      success: true,
      data: {
        id: user.id,
        name: user.name,
        county: user.county,
        role: user.role,
        rating: user.rating,
        totalRatings: user.totalRatings,
        createdAt: user.createdAt,
        isVerified: user.isVerified,
        activeListings,
        completedDeals,
      },
    });
  } catch (error) {
    console.error('Error fetching public profile:', error);
    res.status(500).json({
      success: false,
      error: { code: 'FETCH_FAILED', message: 'Failed to fetch profile' },
    });
  }
});

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

// GET /api/v1/users/:id/data-export — DPA 2019 Right to Portability (Section 27)
router.get('/:id/data-export', requireAuth, requireSelfOrAdmin('id'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const [user, smsLogs, gradingResults, transactions, listings] = await Promise.all([
      prisma.user.findUnique({
        where: { id },
        select: {
          id: true, name: true, phone: true, role: true, language: true,
          county: true, subCounty: true, ward: true,
          isVerified: true, createdAt: true, updatedAt: true,
          consentGivenAt: true, consentVersion: true,
          rating: true, totalRatings: true,
          vehicleType: true, vehicleCapacity: true,
        },
      }),
      prisma.smsLog.findMany({
        where: { userId: id },
        select: {
          direction: true, message: true, intent: true, entities: true,
          status: true, createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.gradingResult.findMany({
        where: { userId: id },
        select: {
          cropType: true, grade: true, confidence: true, defects: true,
          modelVersion: true, createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.transaction.findMany({
        where: {
          OR: [
            { buyerId: id },
            { listing: { farmerId: id } },
            { transporterId: id },
          ],
        },
        select: {
          id: true, quantity: true, unit: true, agreedPrice: true,
          status: true, paymentMethod: true, createdAt: true,
          listing: { select: { cropType: true, county: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.produceListing.findMany({
        where: { farmerId: id },
        select: {
          id: true, cropType: true, qualityGrade: true, priceAmount: true,
          quantity: true, county: true, status: true, createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' },
      });
    }

    const exportData = {
      exportedAt: new Date().toISOString(),
      dataProtectionAct: 'Kenya DPA 2019 - Section 27 (Right to Data Portability)',
      profile: user,
      smsHistory: smsLogs,
      qualityGradingResults: gradingResults,
      transactions,
      produceListings: listings,
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="sunharvest-data-export-${id}.json"`);
    res.json({ success: true, data: exportData });
  } catch (error) {
    console.error('Error exporting user data:', error);
    res.status(500).json({
      success: false,
      error: { code: 'EXPORT_FAILED', message: 'Failed to export data' },
    });
  }
});

// DELETE /api/v1/users/:id — delete account (Kenya DPA 2019 - Right to Erasure)
router.delete('/:id', requireAuth, requireSelfOrAdmin('id'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' },
      });
    }

    // DPA 2019 Right to Erasure — soft delete user + cascade anonymization
    // Transaction history kept for 7 years per Kenyan tax regulations
    await prisma.$transaction([
      // 1. Anonymize user record
      prisma.user.update({
        where: { id },
        data: {
          name: '[Deleted User]',
          phone: `deleted_${Date.now()}`,
          pin: '',
          county: null,
          subCounty: null,
          ward: null,
          latitude: null,
          longitude: null,
          consentGivenAt: null,
          consentVersion: null,
          isActive: false,
        },
      }),
      // 2. Anonymize SMS logs — clear message content, keep metadata for analytics
      prisma.smsLog.updateMany({
        where: { userId: id },
        data: {
          message: '[Deleted]',
          phone: '[Deleted]',
        },
      }),
      // 3. Clear grading result images (produce photos linked to user)
      prisma.gradingResult.updateMany({
        where: { userId: id },
        data: {
          imageUrl: '[Deleted]',
          imageHash: '[Deleted]',
        },
      }),
    ]);

    res.json({
      success: true,
      data: {
        message: 'Your account has been scheduled for deletion. Personal data will be removed within 30 days as per Kenya Data Protection Act 2019.',
      },
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({
      success: false,
      error: { code: 'DELETE_FAILED', message: 'Failed to delete account' },
    });
  }
});

export { router as userRouter };
