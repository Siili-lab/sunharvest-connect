import { Router, Request, Response } from 'express';
import { PrismaClient, CropType, QualityGrade, ListingStatus } from '@prisma/client';
import { requireAuth, requireFarmer, optionalAuth, AuthenticatedRequest } from '../middleware/auth';
import { requireListingOwnership } from '../middleware/ownership';

const router = Router();
const prisma = new PrismaClient();

// Crop type mapping from frontend to enum
const cropTypeMap: Record<string, CropType> = {
  tomato: 'TOMATOES',
  tomatoes: 'TOMATOES',
  potato: 'POTATOES',
  potatoes: 'POTATOES',
  onion: 'ONIONS',
  onions: 'ONIONS',
  cabbage: 'CABBAGE',
  kale: 'KALE',
  spinach: 'SPINACH',
  carrot: 'CARROTS',
  carrots: 'CARROTS',
  mango: 'MANGOES',
  mangoes: 'MANGOES',
  avocado: 'AVOCADO',
  banana: 'BANANAS',
  bananas: 'BANANAS',
};

const gradeMap: Record<string, QualityGrade> = {
  premium: 'PREMIUM',
  'grade a': 'GRADE_A',
  'grade_a': 'GRADE_A',
  'grade b': 'GRADE_B',
  'grade_b': 'GRADE_B',
  reject: 'REJECT',
};

// GET /listings - Get all active listings (public)
router.get('/', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { crop, county, grade, minPrice, maxPrice, limit = 50 } = req.query;

    const where: any = {
      status: 'ACTIVE',
    };

    if (crop) {
      const cropKey = (crop as string).toLowerCase();
      if (cropTypeMap[cropKey]) {
        where.cropType = cropTypeMap[cropKey];
      }
    }

    if (county) {
      where.county = { contains: county as string, mode: 'insensitive' };
    }

    if (grade) {
      const gradeKey = (grade as string).toLowerCase();
      if (gradeMap[gradeKey]) {
        where.qualityGrade = gradeMap[gradeKey];
      }
    }

    if (minPrice || maxPrice) {
      where.priceAmount = {};
      if (minPrice) where.priceAmount.gte = parseFloat(minPrice as string);
      if (maxPrice) where.priceAmount.lte = parseFloat(maxPrice as string);
    }

    const take = Math.min(Math.max(parseInt(limit as string) || 50, 1), 100);

    const listings = await prisma.produceListing.findMany({
      where,
      include: {
        farmer: {
          select: {
            id: true,
            name: true,
            county: true,
            rating: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take,
    });

    // Transform to frontend format
    const response = listings.map((listing) => ({
      id: listing.id,
      crop: listing.cropType.charAt(0) + listing.cropType.slice(1).toLowerCase(),
      grade: listing.qualityGrade === 'GRADE_A' ? 'Grade A' :
             listing.qualityGrade === 'GRADE_B' ? 'Grade B' :
             listing.qualityGrade === 'PREMIUM' ? 'Premium' : 'Reject',
      price: listing.priceAmount,
      quantity: listing.quantity,
      farmer: listing.farmer.name,
      farmerId: listing.farmer.id,
      location: listing.county,
      images: listing.images,
      harvestDate: listing.harvestDate,
      createdAt: listing.createdAt,
    }));

    res.json(response);
  } catch (error) {
    console.error('Error fetching listings:', error);
    res.status(500).json({ error: 'Failed to fetch listings' });
  }
});

// GET /listings/:id - Get single listing (public)
router.get('/:id', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const listing = await prisma.produceListing.findUnique({
      where: { id },
      include: {
        farmer: {
          select: {
            id: true,
            name: true,
            county: true,
            rating: true,
            totalRatings: true,
          },
        },
      },
    });

    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    res.json({
      id: listing.id,
      crop: listing.cropType,
      grade: listing.qualityGrade,
      price: listing.priceAmount,
      quantity: listing.quantity,
      farmer: listing.farmer,
      location: listing.county,
      images: listing.images,
      description: listing.variety,
      harvestDate: listing.harvestDate,
      availableUntil: listing.availableUntil,
      status: listing.status,
      createdAt: listing.createdAt,
    });
  } catch (error) {
    console.error('Error fetching listing:', error);
    res.status(500).json({ error: 'Failed to fetch listing' });
  }
});

// POST /listings - Create new listing (farmer only, use token userId)
router.post('/', requireAuth, requireFarmer, async (req: Request, res: Response) => {
  try {
    const farmerId = (req as AuthenticatedRequest).user.userId;
    const {
      crop,
      grade,
      price,
      quantity,
      description,
      county,
      images,
      harvestDate,
      availableDays = 7,
    } = req.body;

    if (!crop || !grade || !price || !quantity || !county) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['crop', 'grade', 'price', 'quantity', 'county'],
      });
    }

    const cropKey = crop.toLowerCase();
    const gradeKey = grade.toLowerCase();

    if (!cropTypeMap[cropKey]) {
      return res.status(400).json({ error: `Invalid crop type: ${crop}` });
    }

    if (!gradeMap[gradeKey]) {
      return res.status(400).json({ error: `Invalid grade: ${grade}` });
    }

    const availableUntil = new Date();
    availableUntil.setDate(availableUntil.getDate() + availableDays);

    const listing = await prisma.produceListing.create({
      data: {
        farmerId,
        cropType: cropTypeMap[cropKey],
        qualityGrade: gradeMap[gradeKey],
        priceAmount: parseFloat(price),
        quantity: parseFloat(quantity),
        variety: description,
        county,
        images: images || [],
        harvestDate: harvestDate ? new Date(harvestDate) : null,
        availableUntil,
        status: 'ACTIVE',
      },
      include: {
        farmer: {
          select: { name: true, phone: true },
        },
      },
    });

    res.status(201).json({
      success: true,
      listing: {
        id: listing.id,
        crop: listing.cropType,
        grade: listing.qualityGrade,
        price: listing.priceAmount,
        quantity: listing.quantity,
        status: listing.status,
      },
    });
  } catch (error) {
    console.error('Error creating listing:', error);
    res.status(500).json({ error: 'Failed to create listing' });
  }
});

// PUT /listings/:id - Update listing (farmer owner only)
router.put('/:id', requireAuth, requireFarmer, requireListingOwnership, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { price, quantity, status, description } = req.body;

    const ALLOWED_STATUSES: ListingStatus[] = ['ACTIVE', 'SOLD', 'CANCELLED'];

    const updateData: any = {};
    if (price !== undefined) updateData.priceAmount = parseFloat(price);
    if (quantity !== undefined) updateData.quantity = parseFloat(quantity);
    if (status !== undefined) {
      if (!ALLOWED_STATUSES.includes(status as ListingStatus)) {
        return res.status(400).json({ error: `Invalid status. Allowed: ${ALLOWED_STATUSES.join(', ')}` });
      }
      updateData.status = status;
    }
    if (description !== undefined) updateData.variety = description;

    const listing = await prisma.produceListing.update({
      where: { id },
      data: updateData,
    });

    res.json({
      success: true,
      listing: {
        id: listing.id,
        price: listing.priceAmount,
        quantity: listing.quantity,
        status: listing.status,
      },
    });
  } catch (error) {
    console.error('Error updating listing:', error);
    res.status(500).json({ error: 'Failed to update listing' });
  }
});

// DELETE /listings/:id - Cancel listing (farmer owner only)
router.delete('/:id', requireAuth, requireFarmer, requireListingOwnership, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.produceListing.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error cancelling listing:', error);
    res.status(500).json({ error: 'Failed to cancel listing' });
  }
});

export default router;
