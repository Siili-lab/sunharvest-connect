import { PrismaClient, CropType, QualityGrade, PriceTrend } from '@prisma/client';
import { BASE_PRICES, calculateTrends, fetchRealWeatherData } from './marketDataService';

const prisma = new PrismaClient();

interface PricePredictionInput {
  cropType: CropType;
  grade: QualityGrade;
  county: string;
  quantity: number;
}

interface PricePredictionResult {
  recommendedPrice: number;
  priceRangeMin: number;
  priceRangeMax: number;
  confidence: number;
  marketAverage: number;
  trend: PriceTrend;
  reasoning: string[];
  demandLevel: 'low' | 'normal' | 'high';
}

// Grade multipliers
const GRADE_MULTIPLIERS: Record<QualityGrade, number> = {
  PREMIUM: 1.25,
  GRADE_A: 1.0,
  GRADE_B: 0.8,
  REJECT: 0.5,
};

// County demand factors (Nairobi has higher demand/prices)
const COUNTY_DEMAND: Record<string, number> = {
  'Nairobi': 1.15,
  'Mombasa': 1.1,
  'Kisumu': 1.05,
  'Nakuru': 1.0,
  'Kiambu': 0.95,
  'default': 1.0,
};

// Quantity discount (bulk = slightly lower per-unit price)
function getQuantityFactor(quantity: number): number {
  if (quantity > 500) return 0.95; // Bulk discount
  if (quantity > 200) return 0.98;
  if (quantity < 20) return 1.05; // Small quantity premium
  return 1.0;
}

// Weather impact on prices: heavy rain disrupts supply → higher prices
async function getWeatherFactor(county: string): Promise<{
  factor: number;
  reasoning: string | null;
}> {
  try {
    // Check DB for recent weather first
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    const recentWeather = await prisma.weatherData.findMany({
      where: { county, date: { gte: twoDaysAgo } },
      orderBy: { date: 'desc' },
      take: 3,
    });

    let rainfall = 0;
    let temperature = 25;

    if (recentWeather.length > 0) {
      rainfall = recentWeather.reduce((sum, w) => sum + w.rainfall, 0) / recentWeather.length;
      temperature = recentWeather.reduce((sum, w) => sum + w.temperature, 0) / recentWeather.length;
    } else {
      // Fallback: try live API
      const live = await fetchRealWeatherData(county);
      if (live) {
        rainfall = live.rainfall;
        temperature = live.temperature;
      } else {
        return { factor: 1.0, reasoning: null };
      }
    }

    // Heavy rain (>15mm avg) disrupts transport & harvest → prices rise
    if (rainfall > 15) {
      return {
        factor: 1.08,
        reasoning: `Heavy rainfall (${Math.round(rainfall)}mm) in ${county} is disrupting supply chains`,
      };
    }

    // Moderate rain (5-15mm) has mild positive effect on future supply
    if (rainfall > 5) {
      return {
        factor: 0.98,
        reasoning: `Good rainfall in ${county} supports crop growth`,
      };
    }

    // Very hot & dry → crops stressed, lower yield → higher prices
    if (temperature > 32 && rainfall < 1) {
      return {
        factor: 1.05,
        reasoning: `Hot dry conditions (${Math.round(temperature)}°C) in ${county} may reduce yields`,
      };
    }

    return { factor: 1.0, reasoning: null };
  } catch {
    return { factor: 1.0, reasoning: null };
  }
}

export async function predictPrice(input: PricePredictionInput): Promise<PricePredictionResult> {
  const { cropType, grade, county, quantity } = input;

  // Get current market trends
  const trends = await calculateTrends(cropType, county);

  // Base price from market data
  const basePrice = trends.currentPrice || BASE_PRICES[cropType].avg;

  // Apply modifiers
  const gradeMultiplier = GRADE_MULTIPLIERS[grade];
  const countyDemand = COUNTY_DEMAND[county] || COUNTY_DEMAND['default'];
  const quantityFactor = getQuantityFactor(quantity);

  // Weather-based adjustment
  const weather = await getWeatherFactor(county);

  // Trend adjustment
  let trendAdjustment = 1.0;
  if (trends.trend === 'RISING') trendAdjustment = 1.05;
  else if (trends.trend === 'FALLING') trendAdjustment = 0.95;

  // Calculate recommended price (now includes weather factor)
  const recommendedPrice = Math.round(
    basePrice * gradeMultiplier * countyDemand * quantityFactor * trendAdjustment * weather.factor
  );

  // Price range (±10-15%)
  const variance = grade === 'PREMIUM' ? 0.10 : 0.15;
  const priceRangeMin = Math.round(recommendedPrice * (1 - variance));
  const priceRangeMax = Math.round(recommendedPrice * (1 + variance));

  // Confidence based on data quality
  let confidence = 0.75; // Base confidence
  if (trends.currentPrice) confidence += 0.1; // Have recent data
  if (trends.changePercent !== 0) confidence += 0.05; // Have trend data

  // Determine demand level
  let demandLevel: 'low' | 'normal' | 'high' = 'normal';
  if (trends.trend === 'RISING') demandLevel = 'high';
  else if (trends.trend === 'FALLING') demandLevel = 'low';

  // Generate reasoning
  const reasoning: string[] = [];

  if (grade === 'PREMIUM') {
    reasoning.push('Premium grade commands 25% price premium');
  } else if (grade === 'GRADE_B') {
    reasoning.push('Grade B typically sells at 20% below Grade A');
  }

  if (trends.trend === 'RISING') {
    reasoning.push(`Prices trending up ${trends.changePercent}% this week`);
  } else if (trends.trend === 'FALLING') {
    reasoning.push(`Prices down ${Math.abs(trends.changePercent)}% - consider selling soon`);
  }

  if (countyDemand > 1.0) {
    reasoning.push(`${county} has higher demand than average`);
  }

  if (quantity > 200) {
    reasoning.push('Bulk quantity may attract wholesale buyers');
  }

  if (weather.reasoning) {
    reasoning.push(weather.reasoning);
  }

  // Cache the prediction
  try {
    const validUntil = new Date();
    validUntil.setHours(validUntil.getHours() + 24); // Valid for 24 hours

    await prisma.pricePrediction.create({
      data: {
        cropType,
        grade,
        county,
        quantity,
        predictedPrice: recommendedPrice,
        priceRangeMin,
        priceRangeMax,
        confidence,
        marketAverage: trends.currentPrice,
        trend: trends.trend,
        reasoning: reasoning.join('; '),
        validUntil,
        modelVersion: '1.0.0',
      },
    });
  } catch (error) {
    // Caching is optional, don't fail if it errors
    console.error('Failed to cache prediction:', error);
  }

  return {
    recommendedPrice,
    priceRangeMin,
    priceRangeMax,
    confidence: Math.round(confidence * 100) / 100,
    marketAverage: trends.currentPrice,
    trend: trends.trend,
    reasoning,
    demandLevel,
  };
}

// Get cached prediction if still valid
export async function getCachedPrediction(input: PricePredictionInput): Promise<PricePredictionResult | null> {
  const cached = await prisma.pricePrediction.findFirst({
    where: {
      cropType: input.cropType,
      grade: input.grade,
      county: input.county,
      quantity: {
        gte: input.quantity * 0.9,
        lte: input.quantity * 1.1,
      },
      validUntil: { gte: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!cached) return null;

  return {
    recommendedPrice: cached.predictedPrice,
    priceRangeMin: cached.priceRangeMin,
    priceRangeMax: cached.priceRangeMax,
    confidence: cached.confidence,
    marketAverage: cached.marketAverage,
    trend: cached.trend,
    reasoning: cached.reasoning?.split('; ') || [],
    demandLevel: cached.trend === 'RISING' ? 'high' : cached.trend === 'FALLING' ? 'low' : 'normal',
  };
}
