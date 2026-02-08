import { Router, Request, Response } from 'express';
import multer from 'multer';
import { PrismaClient, CropType, QualityGrade, ListingStatus } from '@prisma/client';
import { gradeProduce } from '../services/mockGradingModel';
import { predictPrice } from '../services/pricePredictor';
import { mapCropToEnum, mapGradeToEnum } from '../utils/cropMapping';
import crypto from 'crypto';
import { requireAuth, requireFarmer, optionalAuth, AuthenticatedRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();
const upload = multer({ storage: multer.memoryStorage() });

// Crop type mapping from frontend to enum (same as listings.routes.ts)
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

// Static fallback prices used when the DB / price predictor is unavailable
const STATIC_PRICES: Record<string, { min: number; max: number; avg: number }> = {
  tomato: { min: 80, max: 130, avg: 100 },
  potato: { min: 55, max: 100, avg: 75 },
  onion: { min: 65, max: 120, avg: 90 },
  mango: { min: 80, max: 180, avg: 120 },
  cabbage: { min: 30, max: 70, avg: 45 },
  kale: { min: 35, max: 65, avg: 48 },
  spinach: { min: 40, max: 75, avg: 55 },
  avocado: { min: 60, max: 150, avg: 90 },
  banana: { min: 25, max: 55, avg: 38 },
  orange: { min: 40, max: 95, avg: 60 },
  pepper: { min: 100, max: 250, avg: 160 },
  carrot: { min: 50, max: 110, avg: 75 },
  maize: { min: 30, max: 70, avg: 45 },
};

const GRADE_MULTIPLIERS: Record<string, number> = {
  Premium: 1.25,
  'Grade A': 1.0,
  'Grade B': 0.8,
  Reject: 0.5,
};

// POST /api/v1/produce/grade — requireAuth, use req.user.userId
router.post('/grade', requireAuth, upload.single('image'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: { code: 'NO_IMAGE', message: 'Image is required' },
      });
    }

    const cropType = req.body.cropType || 'tomato';
    const userId = (req as AuthenticatedRequest).user.userId;

    // ML grading (mock — swap in real model later)
    const startTime = Date.now();
    const prediction = await gradeProduce(req.file.buffer, cropType);
    const inferenceTime = Date.now() - startTime;

    // Attempt market-based price prediction; fall back to static prices so
    // grading never fails even when the DB isn't running.
    let suggestedPrice: number;
    let priceRangeMin: number | undefined;
    let priceRangeMax: number | undefined;
    let trend: string | undefined;
    let demandLevel: string | undefined;

    try {
      const cropEnum = mapCropToEnum(cropType);
      const gradeEnum = mapGradeToEnum(prediction.grade);
      const pricePrediction = await predictPrice({
        cropType: cropEnum,
        grade: gradeEnum,
        county: req.body.county || 'Nairobi',
        quantity: parseFloat(req.body.quantity) || 50,
      });

      suggestedPrice = pricePrediction.recommendedPrice;
      priceRangeMin = pricePrediction.priceRangeMin;
      priceRangeMax = pricePrediction.priceRangeMax;
      trend = pricePrediction.trend.toLowerCase();
      demandLevel = pricePrediction.demandLevel;
    } catch {
      // Fallback to static prices when DB / market service is unavailable
      const base = STATIC_PRICES[cropType.toLowerCase()] || STATIC_PRICES.tomato;
      const mult = GRADE_MULTIPLIERS[prediction.grade] ?? 1.0;
      suggestedPrice = Math.round(base.avg * mult);
      priceRangeMin = Math.round(base.min * mult);
      priceRangeMax = Math.round(base.max * mult);
      trend = 'stable';
      demandLevel = 'normal';
    }

    // Save GradingResult to the database
    let gradingResultId: string | undefined;
    try {
      const imageHash = crypto
        .createHash('sha256')
        .update(req.file.buffer)
        .digest('hex');

      const cropEnum = mapCropToEnum(cropType);
      const gradeEnum = mapGradeToEnum(prediction.grade);

      const gradingResult = await prisma.gradingResult.create({
        data: {
          userId,
          imageHash,
          imageUrl: `grading/${imageHash}.jpg`, // placeholder — real storage integration later
          cropType: cropEnum,
          grade: gradeEnum,
          confidence: prediction.confidence,
          defects: prediction.defects,
          modelVersion: 'mock-v1.0',
          inferenceTime,
        },
      });
      gradingResultId = gradingResult.id;
    } catch (dbErr) {
      // Don't fail the grading response if DB save fails
      console.error('[Grading] Failed to save grading result to DB:', dbErr);
    }

    res.json({
      success: true,
      data: {
        id: gradingResultId,
        grade: prediction.grade,
        confidence: prediction.confidence,
        suggestedPrice,
        priceRangeMin,
        priceRangeMax,
        currency: 'KSh',
        unit: 'kg',
        cropType,
        defects: prediction.defects,
        trend,
        demandLevel,
        gradedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: { code: 'GRADING_FAILED', message: 'Failed to grade image' },
    });
  }
});

// GET /api/v1/produce/listings — public, optionalAuth
router.get('/listings', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { crop, county, grade, minPrice, maxPrice, limit = '50' } = req.query;

    const where: any = {
      status: 'ACTIVE' as ListingStatus,
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

    const listings = await prisma.produceListing.findMany({
      where,
      include: {
        farmer: {
          select: {
            id: true,
            name: true,
            phone: true,
            county: true,
            rating: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string),
    });

    const response = listings.map((listing) => ({
      id: listing.id,
      crop: listing.cropType.charAt(0) + listing.cropType.slice(1).toLowerCase(),
      grade:
        listing.qualityGrade === 'GRADE_A'
          ? 'Grade A'
          : listing.qualityGrade === 'GRADE_B'
            ? 'Grade B'
            : listing.qualityGrade === 'PREMIUM'
              ? 'Premium'
              : 'Reject',
      price: listing.priceAmount,
      quantity: listing.quantity,
      farmer: listing.farmer.name,
      farmerId: listing.farmer.id,
      phone: listing.farmer.phone,
      location: listing.county,
      images: listing.images,
      harvestDate: listing.harvestDate,
      createdAt: listing.createdAt,
    }));

    res.json({ success: true, data: response });
  } catch (error) {
    console.error('Error fetching produce listings:', error);
    res.status(500).json({
      success: false,
      error: { code: 'FETCH_FAILED', message: 'Failed to fetch listings' },
    });
  }
});

// POST /api/v1/produce/listings — requireAuth + requireFarmer, use req.user.userId as farmerId
router.post('/listings', requireAuth, requireFarmer, async (req: Request, res: Response) => {
  try {
    const farmerId = (req as AuthenticatedRequest).user.userId;
    const {
      cropType,
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

    const cropName = cropType || crop;
    if (!cropName || !grade || !price || !quantity || !county) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'Missing required fields',
          required: ['cropType', 'grade', 'price', 'quantity', 'county'],
        },
      });
    }

    const cropKey = cropName.toLowerCase();
    const gradeKey = grade.toLowerCase();

    if (!cropTypeMap[cropKey]) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_CROP', message: `Invalid crop type: ${cropName}` },
      });
    }

    if (!gradeMap[gradeKey]) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_GRADE', message: `Invalid grade: ${grade}` },
      });
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
      data: {
        id: listing.id,
        cropType: listing.cropType,
        grade: listing.qualityGrade,
        price: listing.priceAmount,
        quantity: listing.quantity,
        status: listing.status,
        createdAt: listing.createdAt,
      },
    });
  } catch (error) {
    console.error('Error creating produce listing:', error);
    res.status(500).json({
      success: false,
      error: { code: 'CREATE_FAILED', message: 'Failed to create listing' },
    });
  }
});

export { router as produceRouter };
