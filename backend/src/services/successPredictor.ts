import { PrismaClient, CropType, QualityGrade, PriceTrend } from '@prisma/client';
import { BASE_PRICES, calculateTrends } from './marketDataService';

const prisma = new PrismaClient();

interface SuccessPredictionInput {
  cropType: CropType;
  grade: QualityGrade;
  askingPrice: number;
  quantity: number;
  county: string;
}

interface SuccessPredictionResult {
  estimatedDays: number;
  daysRange: { min: number; max: number };
  confidence: number;
  category: 'fast' | 'normal' | 'slow' | 'unlikely';
  probability: number; // Probability of selling
  factors: string[];
  suggestions: string[];
}

// Analyze historical sales to predict time to sell
export async function predictSuccess(input: SuccessPredictionInput): Promise<SuccessPredictionResult> {
  const { cropType, grade, askingPrice, quantity, county } = input;

  // Get market trends
  const trends = await calculateTrends(cropType, county);
  const marketPrice = trends.currentPrice || BASE_PRICES[cropType].avg;

  // Calculate price ratio (how competitive is the asking price?)
  const priceRatio = askingPrice / marketPrice;

  // Get historical data for similar listings
  const similarListings = await prisma.listingSaleData.findMany({
    where: {
      cropType,
      grade,
      sold: true,
    },
    orderBy: { listedAt: 'desc' },
    take: 50,
  });

  // Calculate average days to sell from historical data
  let avgDaysToSell = 5; // Default
  if (similarListings.length > 0) {
    const totalDays = similarListings
      .filter(l => l.daysToSell !== null)
      .reduce((sum, l) => sum + (l.daysToSell || 0), 0);
    avgDaysToSell = totalDays / similarListings.filter(l => l.daysToSell !== null).length;
  }

  // Adjust based on price competitiveness
  let priceMultiplier: number;
  if (priceRatio < 0.85) priceMultiplier = 0.5; // Very competitive - sells fast
  else if (priceRatio < 0.95) priceMultiplier = 0.75;
  else if (priceRatio < 1.05) priceMultiplier = 1.0;
  else if (priceRatio < 1.15) priceMultiplier = 1.5;
  else priceMultiplier = 2.5; // Overpriced - sells slow

  // Grade affects speed
  const gradeMultiplier: Record<QualityGrade, number> = {
    PREMIUM: 0.7,
    GRADE_A: 1.0,
    GRADE_B: 1.3,
    REJECT: 2.0,
  };

  // Trend affects speed
  let trendMultiplier = 1.0;
  if (trends.trend === 'RISING') trendMultiplier = 0.8; // High demand
  else if (trends.trend === 'FALLING') trendMultiplier = 1.2; // Low demand

  // Quantity affects speed (larger quantities take longer)
  let quantityMultiplier = 1.0;
  if (quantity > 200) quantityMultiplier = 1.3;
  else if (quantity > 500) quantityMultiplier = 1.5;
  else if (quantity < 50) quantityMultiplier = 0.9;

  // Calculate estimated days
  const estimatedDays = Math.max(1, Math.round(
    avgDaysToSell * priceMultiplier * gradeMultiplier[grade] * trendMultiplier * quantityMultiplier
  ));

  // Range
  const daysRange = {
    min: Math.max(1, Math.floor(estimatedDays * 0.6)),
    max: Math.ceil(estimatedDays * 1.5),
  };

  // Determine category
  let category: 'fast' | 'normal' | 'slow' | 'unlikely';
  if (estimatedDays <= 3) category = 'fast';
  else if (estimatedDays <= 7) category = 'normal';
  else if (estimatedDays <= 14) category = 'slow';
  else category = 'unlikely';

  // Calculate sell probability
  let probability = 0.8; // Base 80%
  if (priceRatio > 1.2) probability -= 0.3; // Overpriced
  if (priceRatio < 0.9) probability += 0.1; // Competitive
  if (grade === 'PREMIUM') probability += 0.05;
  if (grade === 'REJECT') probability -= 0.2;
  if (trends.trend === 'RISING') probability += 0.05;
  if (trends.trend === 'FALLING') probability -= 0.1;
  probability = Math.max(0.1, Math.min(0.95, probability));

  // Confidence
  const confidence = similarListings.length > 20 ? 0.85 : 0.7;

  // Generate factors affecting the prediction
  const factors: string[] = [];
  const suggestions: string[] = [];

  // Price analysis
  if (priceRatio < 0.9) {
    factors.push('Price is very competitive');
  } else if (priceRatio < 1.0) {
    factors.push('Price is competitive');
  } else if (priceRatio < 1.1) {
    factors.push('Price is at market rate');
  } else if (priceRatio < 1.2) {
    factors.push('Price is above market average');
    suggestions.push(`Consider lowering to KSh ${Math.round(marketPrice)} for faster sale`);
  } else {
    factors.push('Price significantly above market');
    suggestions.push(`Market price is KSh ${Math.round(marketPrice)}/kg - consider adjusting`);
  }

  // Grade
  if (grade === 'PREMIUM') {
    factors.push('Premium grade is in high demand');
  } else if (grade === 'GRADE_B') {
    factors.push('Grade B may take longer to find buyers');
    suggestions.push('Consider targeting budget-conscious buyers');
  } else if (grade === 'REJECT') {
    factors.push('Reject grade has limited market');
    suggestions.push('Consider selling for processing or animal feed');
  }

  // Trends
  if (trends.trend === 'RISING') {
    factors.push(`High demand - prices up ${trends.changePercent}%`);
  } else if (trends.trend === 'FALLING') {
    factors.push(`Lower demand - prices down ${Math.abs(trends.changePercent)}%`);
    suggestions.push('Sell soon before prices drop further');
  }

  // Quantity
  if (quantity > 200) {
    factors.push('Large quantity - may need wholesale buyer');
    suggestions.push('Consider splitting into smaller lots');
  }

  return {
    estimatedDays,
    daysRange,
    confidence: Math.round(confidence * 100) / 100,
    category,
    probability: Math.round(probability * 100) / 100,
    factors,
    suggestions,
  };
}

// Get success stats for dashboard
export async function getSuccessStats(cropType?: CropType): Promise<{
  avgDaysToSell: number;
  sellRate: number;
  avgPriceRatio: number;
}> {
  const where = cropType ? { cropType, sold: true } : { sold: true };

  const soldListings = await prisma.listingSaleData.findMany({
    where,
    orderBy: { listedAt: 'desc' },
    take: 100,
  });

  const allListings = await prisma.listingSaleData.count({
    where: cropType ? { cropType } : {},
  });

  if (soldListings.length === 0) {
    return { avgDaysToSell: 5, sellRate: 0.8, avgPriceRatio: 1.0 };
  }

  const avgDaysToSell = soldListings
    .filter(l => l.daysToSell !== null)
    .reduce((sum, l) => sum + (l.daysToSell || 0), 0) / soldListings.length;

  const sellRate = soldListings.length / (allListings || 1);

  const avgPriceRatio = soldListings
    .reduce((sum, l) => sum + l.priceRatio, 0) / soldListings.length;

  return {
    avgDaysToSell: Math.round(avgDaysToSell * 10) / 10,
    sellRate: Math.round(sellRate * 100) / 100,
    avgPriceRatio: Math.round(avgPriceRatio * 100) / 100,
  };
}
