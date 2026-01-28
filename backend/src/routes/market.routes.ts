import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { CropType, QualityGrade, PrismaClient } from '@prisma/client';
import { predictPrice, getCachedPrediction } from '../services/pricePredictor';
import { predictSuccess, getSuccessStats } from '../services/successPredictor';
import { calculateTrends, BASE_PRICES, KENYA_MARKETS } from '../services/marketDataService';

const router = Router();
const prisma = new PrismaClient();

// Validation schemas
const predictPriceSchema = z.object({
  crop: z.string(),
  grade: z.enum(['Premium', 'Grade A', 'Grade B', 'Reject']),
  quantity: z.number().positive(),
  county: z.string(),
});

const successEstimateSchema = z.object({
  crop: z.string(),
  grade: z.enum(['Premium', 'Grade A', 'Grade B', 'Reject']),
  price: z.number().positive(),
  quantity: z.number().positive(),
  county: z.string(),
});

// Map user-friendly names to enum values
function mapCropToEnum(crop: string): CropType {
  const mapping: Record<string, CropType> = {
    'tomato': 'TOMATOES',
    'tomatoes': 'TOMATOES',
    'mango': 'MANGOES',
    'mangoes': 'MANGOES',
    'onion': 'ONIONS',
    'onions': 'ONIONS',
    'potato': 'POTATOES',
    'potatoes': 'POTATOES',
    'cabbage': 'CABBAGE',
    'kale': 'KALE',
    'sukuma': 'KALE',
    'spinach': 'SPINACH',
    'avocado': 'AVOCADO',
    'banana': 'BANANAS',
    'bananas': 'BANANAS',
    'orange': 'ORANGES',
    'oranges': 'ORANGES',
    'pepper': 'PEPPERS',
    'peppers': 'PEPPERS',
    'carrot': 'CARROTS',
    'carrots': 'CARROTS',
  };
  return mapping[crop.toLowerCase()] || 'OTHER';
}

function mapGradeToEnum(grade: string): QualityGrade {
  const mapping: Record<string, QualityGrade> = {
    'Premium': 'PREMIUM',
    'Grade A': 'GRADE_A',
    'Grade B': 'GRADE_B',
    'Reject': 'REJECT',
  };
  return mapping[grade] || 'GRADE_A';
}

// GET /api/v1/market/prices - Get current market prices
router.get('/prices', async (req: Request, res: Response) => {
  try {
    const { crop, county } = req.query;

    if (crop && typeof crop === 'string') {
      const cropEnum = mapCropToEnum(crop);
      const trends = await calculateTrends(cropEnum, county as string);

      res.json({
        success: true,
        data: {
          crop,
          cropType: cropEnum,
          wholesale: trends.currentPrice,
          retail: Math.round(trends.currentPrice * 1.3),
          unit: 'kg',
          currency: 'KES',
          trend: trends.trend.toLowerCase(),
          changePercent: trends.changePercent,
          market: 'Wakulima Market',
          updatedAt: new Date().toISOString(),
        },
      });
    } else {
      // Return all crop prices
      const crops = Object.keys(BASE_PRICES);
      const allPrices = await Promise.all(
        crops.map(async (cropKey) => {
          const cropEnum = cropKey as CropType;
          const trends = await calculateTrends(cropEnum);
          return {
            crop: cropKey.toLowerCase(),
            cropType: cropEnum,
            wholesale: trends.currentPrice,
            retail: Math.round(trends.currentPrice * 1.3),
            unit: 'kg',
            currency: 'KES',
            trend: trends.trend.toLowerCase(),
            changePercent: trends.changePercent,
          };
        })
      );

      res.json({
        success: true,
        data: allPrices,
        market: 'Wakulima Market',
        updatedAt: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error('Price fetch error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to fetch prices' },
    });
  }
});

// POST /api/v1/market/predict-price - AI price recommendation
router.post('/predict-price', async (req: Request, res: Response) => {
  try {
    const data = predictPriceSchema.parse(req.body);

    const cropEnum = mapCropToEnum(data.crop);
    const gradeEnum = mapGradeToEnum(data.grade);

    // Check cache first
    const cached = await getCachedPrediction({
      cropType: cropEnum,
      grade: gradeEnum,
      county: data.county,
      quantity: data.quantity,
    });

    if (cached) {
      res.json({
        success: true,
        data: {
          ...cached,
          currency: 'KES',
          unit: 'kg',
          cached: true,
        },
      });
      return;
    }

    // Generate new prediction
    const prediction = await predictPrice({
      cropType: cropEnum,
      grade: gradeEnum,
      county: data.county,
      quantity: data.quantity,
    });

    res.json({
      success: true,
      data: {
        ...prediction,
        currency: 'KES',
        unit: 'kg',
        cached: false,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: error.errors[0].message },
      });
      return;
    }
    console.error('Price prediction error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Prediction failed' },
    });
  }
});

// POST /api/v1/market/success-estimate - Predict time to sell
router.post('/success-estimate', async (req: Request, res: Response) => {
  try {
    const data = successEstimateSchema.parse(req.body);

    const cropEnum = mapCropToEnum(data.crop);
    const gradeEnum = mapGradeToEnum(data.grade);

    const prediction = await predictSuccess({
      cropType: cropEnum,
      grade: gradeEnum,
      askingPrice: data.price,
      quantity: data.quantity,
      county: data.county,
    });

    res.json({
      success: true,
      data: prediction,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: error.errors[0].message },
      });
      return;
    }
    console.error('Success prediction error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Prediction failed' },
    });
  }
});

// GET /api/v1/market/trends - Get price trends
router.get('/trends', async (req: Request, res: Response) => {
  try {
    const { crop, county } = req.query;

    const cropEnum = crop ? mapCropToEnum(crop as string) : 'TOMATOES';
    const trends = await calculateTrends(cropEnum, county as string);

    // Get historical prices for chart
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const history = await prisma.priceHistory.findMany({
      where: {
        cropType: cropEnum,
        date: { gte: thirtyDaysAgo },
      },
      orderBy: { date: 'asc' },
      select: {
        date: true,
        price: true,
        market: true,
      },
    });

    // Aggregate by date (average across markets)
    const dailyPrices: Record<string, number[]> = {};
    history.forEach(h => {
      const dateStr = h.date.toISOString().split('T')[0];
      if (!dailyPrices[dateStr]) dailyPrices[dateStr] = [];
      dailyPrices[dateStr].push(h.price);
    });

    const chartData = Object.entries(dailyPrices).map(([date, prices]) => ({
      date,
      price: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
    }));

    // Forecast next 7 days (simple linear projection)
    const recentPrices = chartData.slice(-7);
    const avgChange = recentPrices.length > 1
      ? (recentPrices[recentPrices.length - 1].price - recentPrices[0].price) / recentPrices.length
      : 0;

    const forecast: { date: string; price: number }[] = [];
    let lastPrice = trends.currentPrice;
    for (let i = 1; i <= 7; i++) {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + i);
      lastPrice = Math.round(lastPrice + avgChange * 0.8); // Dampened projection
      forecast.push({
        date: futureDate.toISOString().split('T')[0],
        price: lastPrice,
      });
    }

    res.json({
      success: true,
      data: {
        crop: crop || 'tomatoes',
        cropType: cropEnum,
        currentPrice: trends.currentPrice,
        weekAgo: trends.weekAgo,
        monthAgo: trends.monthAgo,
        trend: trends.trend.toLowerCase(),
        changePercent: trends.changePercent,
        history: chartData,
        forecast,
        demandLevel: trends.trend === 'RISING' ? 'high' : trends.trend === 'FALLING' ? 'low' : 'normal',
        bestTimeToSell: trends.trend === 'FALLING' ? 'now' : trends.trend === 'RISING' ? 'wait' : 'anytime',
      },
    });
  } catch (error) {
    console.error('Trends error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to fetch trends' },
    });
  }
});

// GET /api/v1/market/intelligence - Full market dashboard
router.get('/intelligence', async (req: Request, res: Response) => {
  try {
    const { county } = req.query;

    // Get trends for top crops
    const topCrops: CropType[] = ['TOMATOES', 'POTATOES', 'ONIONS', 'CABBAGE', 'KALE'];

    const cropData = await Promise.all(
      topCrops.map(async (cropType) => {
        const trends = await calculateTrends(cropType, county as string);
        const stats = await getSuccessStats(cropType);
        return {
          crop: cropType.toLowerCase(),
          price: trends.currentPrice,
          trend: trends.trend.toLowerCase(),
          changePercent: trends.changePercent,
          avgDaysToSell: stats.avgDaysToSell,
          demandLevel: trends.trend === 'RISING' ? 'high' : trends.trend === 'FALLING' ? 'low' : 'normal',
        };
      })
    );

    // Sort by demand
    const hotCrops = cropData.filter(c => c.trend === 'rising').map(c => c.crop);
    const coldCrops = cropData.filter(c => c.trend === 'falling').map(c => c.crop);

    // Market summary
    const risingCount = cropData.filter(c => c.trend === 'rising').length;
    const fallingCount = cropData.filter(c => c.trend === 'falling').length;

    let marketSentiment: 'bullish' | 'bearish' | 'neutral';
    if (risingCount > fallingCount + 1) marketSentiment = 'bullish';
    else if (fallingCount > risingCount + 1) marketSentiment = 'bearish';
    else marketSentiment = 'neutral';

    res.json({
      success: true,
      data: {
        summary: {
          marketSentiment,
          risingCrops: risingCount,
          fallingCrops: fallingCount,
          stableCrops: topCrops.length - risingCount - fallingCount,
        },
        crops: cropData,
        hotCrops,
        coldCrops,
        markets: KENYA_MARKETS,
        lastUpdated: new Date().toISOString(),
        insights: [
          risingCount > 2 ? 'Strong demand across multiple crops - good time to sell' : null,
          fallingCount > 2 ? 'Prices falling - consider selling soon' : null,
          hotCrops.length > 0 ? `High demand for ${hotCrops.join(', ')}` : null,
        ].filter(Boolean),
      },
    });
  } catch (error) {
    console.error('Intelligence error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to fetch market intelligence' },
    });
  }
});

export { router as marketRouter };
