import { PrismaClient, CropType, SupplyLevel, DataSource, PriceTrend } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

// Kenya counties with agricultural activity
export const KENYA_COUNTIES = [
  'Kiambu', 'Nakuru', 'Nairobi', 'Mombasa', 'Kisumu',
  'Uasin Gishu', 'Trans Nzoia', 'Nyandarua', 'Meru', 'Embu',
  'Machakos', 'Kajiado', 'Nyeri', 'Murang\'a', 'Kirinyaga'
];

// Major markets in Kenya
export const KENYA_MARKETS = [
  { name: 'Wakulima Market', county: 'Nairobi' },
  { name: 'Kongowea Market', county: 'Mombasa' },
  { name: 'Kibuye Market', county: 'Kisumu' },
  { name: 'Marikiti Market', county: 'Nairobi' },
  { name: 'Nakuru Municipal Market', county: 'Nakuru' },
];

// Base prices per crop (KES/kg) - based on 2024 Kenya market data
export const BASE_PRICES: Record<CropType, { min: number; max: number; avg: number }> = {
  TOMATOES: { min: 40, max: 160, avg: 90 },
  MANGOES: { min: 30, max: 120, avg: 60 },
  ONIONS: { min: 50, max: 150, avg: 85 },
  POTATOES: { min: 35, max: 100, avg: 55 },
  CABBAGE: { min: 20, max: 80, avg: 40 },
  KALE: { min: 25, max: 70, avg: 45 },
  SPINACH: { min: 30, max: 80, avg: 50 },
  AVOCADO: { min: 40, max: 150, avg: 80 },
  BANANAS: { min: 20, max: 60, avg: 35 },
  ORANGES: { min: 30, max: 100, avg: 55 },
  PEPPERS: { min: 80, max: 250, avg: 140 },
  CARROTS: { min: 40, max: 120, avg: 70 },
  OTHER: { min: 30, max: 100, avg: 50 },
};

// Seasonal multipliers (Kenya has two rainy seasons: March-May, Oct-Dec)
function getSeasonalMultiplier(month: number, cropType: CropType): number {
  // Rainy seasons affect supply
  const isRainySeason = (month >= 3 && month <= 5) || (month >= 10 && month <= 12);

  // During rainy season: more supply = lower prices for most crops
  // After rainy season: harvest time = even more supply
  const harvestMonths: Record<CropType, number[]> = {
    TOMATOES: [1, 2, 6, 7], // Peak harvest after rains
    MANGOES: [11, 12, 1, 2], // Mango season
    ONIONS: [1, 2, 7, 8],
    POTATOES: [3, 4, 9, 10],
    CABBAGE: [1, 2, 3, 7, 8],
    KALE: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], // Year-round
    SPINACH: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    AVOCADO: [3, 4, 5, 6, 7, 8],
    BANANAS: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    ORANGES: [6, 7, 8, 9],
    PEPPERS: [1, 2, 6, 7],
    CARROTS: [1, 2, 3, 7, 8, 9],
    OTHER: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  };

  const isHarvestTime = harvestMonths[cropType].includes(month);

  if (isHarvestTime) {
    return 0.7 + Math.random() * 0.2; // Lower prices during harvest (0.7-0.9)
  } else if (isRainySeason) {
    return 0.85 + Math.random() * 0.15; // Slightly lower during rains
  } else {
    return 1.0 + Math.random() * 0.3; // Higher prices in dry season (1.0-1.3)
  }
}

// Generate realistic price with noise
function generatePrice(
  cropType: CropType,
  date: Date,
  marketIndex: number = 0
): number {
  const base = BASE_PRICES[cropType];
  const month = date.getMonth() + 1;

  // Seasonal effect
  const seasonalMult = getSeasonalMultiplier(month, cropType);

  // Market effect (Nairobi is usually higher)
  const marketMult = marketIndex === 0 ? 1.1 : 1.0;

  // Random daily variation (-10% to +10%)
  const dailyVariation = 0.9 + Math.random() * 0.2;

  // Year-over-year inflation (~5% per year)
  const currentYear = new Date().getFullYear();
  const yearDiff = currentYear - date.getFullYear();
  const inflationMult = Math.pow(0.95, yearDiff); // Older prices were lower

  const price = base.avg * seasonalMult * marketMult * dailyVariation * inflationMult;

  return Math.round(Math.max(base.min * 0.8, Math.min(base.max * 1.2, price)));
}

// Generate 2 years of historical data
export async function generateHistoricalPriceData(): Promise<void> {
  console.log('Generating historical price data...');

  const endDate = new Date();
  const startDate = new Date();
  startDate.setFullYear(startDate.getFullYear() - 2); // 2 years ago

  const crops = Object.values(CropType);
  let totalRecords = 0;

  // Generate data for each day
  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    for (let marketIdx = 0; marketIdx < KENYA_MARKETS.length; marketIdx++) {
      const market = KENYA_MARKETS[marketIdx];

      for (const crop of crops) {
        const price = generatePrice(crop as CropType, currentDate, marketIdx);

        // Determine supply level based on season
        const month = currentDate.getMonth() + 1;
        const isHarvest = month >= 1 && month <= 3;
        const supplyLevel: SupplyLevel = isHarvest ? 'HIGH' :
          (month >= 6 && month <= 8) ? 'LOW' : 'NORMAL';

        try {
          await prisma.priceHistory.upsert({
            where: {
              cropType_market_date: {
                cropType: crop as CropType,
                market: market.name,
                date: new Date(currentDate.toISOString().split('T')[0]),
              },
            },
            update: {
              price,
              supplyLevel,
            },
            create: {
              cropType: crop as CropType,
              market: market.name,
              county: market.county,
              price,
              supplyLevel,
              date: new Date(currentDate.toISOString().split('T')[0]),
              source: 'SYNTHETIC',
            },
          });
          totalRecords++;
        } catch (error) {
          // Skip duplicates
        }
      }
    }

    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);
  }

  console.log(`Generated ${totalRecords} price history records`);
}

// Generate weather data
export async function generateHistoricalWeatherData(): Promise<void> {
  console.log('Generating historical weather data...');

  const endDate = new Date();
  const startDate = new Date();
  startDate.setFullYear(startDate.getFullYear() - 2);

  let totalRecords = 0;

  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    for (const county of KENYA_COUNTIES) {
      const month = currentDate.getMonth() + 1;

      // Kenya climate patterns
      const isRainySeason = (month >= 3 && month <= 5) || (month >= 10 && month <= 12);

      // Temperature: 15-30°C depending on altitude
      const baseTemp = county === 'Nairobi' ? 20 : 25;
      const temperature = baseTemp + (Math.random() * 10 - 5);

      // Rainfall: higher during rainy seasons
      const rainfall = isRainySeason
        ? 5 + Math.random() * 20
        : Math.random() * 5;

      // Humidity
      const humidity = isRainySeason
        ? 60 + Math.random() * 30
        : 40 + Math.random() * 20;

      try {
        await prisma.weatherData.upsert({
          where: {
            county_date: {
              county,
              date: new Date(currentDate.toISOString().split('T')[0]),
            },
          },
          update: {
            temperature: Math.round(temperature * 10) / 10,
            rainfall: Math.round(rainfall * 10) / 10,
            humidity: Math.round(humidity),
          },
          create: {
            county,
            temperature: Math.round(temperature * 10) / 10,
            rainfall: Math.round(rainfall * 10) / 10,
            humidity: Math.round(humidity),
            date: new Date(currentDate.toISOString().split('T')[0]),
            source: 'synthetic',
          },
        });
        totalRecords++;
      } catch (error) {
        // Skip duplicates
      }
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  console.log(`Generated ${totalRecords} weather records`);
}

// Generate sample listing sale data (for success prediction training)
export async function generateListingSaleData(): Promise<void> {
  console.log('Generating listing sale data...');

  const crops = Object.values(CropType);
  const grades = ['PREMIUM', 'GRADE_A', 'GRADE_B', 'REJECT'] as const;
  let totalRecords = 0;

  // Generate 500 sample listings
  for (let i = 0; i < 500; i++) {
    const crop = crops[Math.floor(Math.random() * crops.length)] as CropType;
    const grade = grades[Math.floor(Math.random() * grades.length)];
    const county = KENYA_COUNTIES[Math.floor(Math.random() * KENYA_COUNTIES.length)];

    const marketPrice = BASE_PRICES[crop].avg;

    // Price ratio: how competitive is the listing?
    // Lower ratio = more competitive = faster sale
    const priceRatio = 0.7 + Math.random() * 0.6; // 0.7 to 1.3
    const askingPrice = Math.round(marketPrice * priceRatio);

    // Days to sell depends on: price ratio, grade, demand
    let baseDays: number;
    if (priceRatio < 0.85) baseDays = 1 + Math.floor(Math.random() * 3); // Very competitive
    else if (priceRatio < 1.0) baseDays = 2 + Math.floor(Math.random() * 5); // Competitive
    else if (priceRatio < 1.15) baseDays = 4 + Math.floor(Math.random() * 7); // Fair
    else baseDays = 7 + Math.floor(Math.random() * 14); // Overpriced

    // Grade affects speed
    const gradeMultiplier = { PREMIUM: 0.7, GRADE_A: 0.9, GRADE_B: 1.1, REJECT: 1.5 };
    const daysToSell = Math.ceil(baseDays * gradeMultiplier[grade]);

    // 80% of listings sell, 20% don't (expire)
    const sold = Math.random() < 0.8;

    const listedAt = new Date();
    listedAt.setDate(listedAt.getDate() - Math.floor(Math.random() * 365));

    const soldAt = sold ? new Date(listedAt.getTime() + daysToSell * 24 * 60 * 60 * 1000) : null;

    await prisma.listingSaleData.create({
      data: {
        cropType: crop,
        grade,
        county,
        quantity: 10 + Math.floor(Math.random() * 200),
        askingPrice,
        marketPrice,
        priceRatio,
        sold,
        daysToSell: sold ? daysToSell : null,
        finalPrice: sold ? askingPrice * (0.95 + Math.random() * 0.1) : null,
        listedAt,
        soldAt,
      },
    });
    totalRecords++;
  }

  console.log(`Generated ${totalRecords} listing sale records`);
}

// Calculate current market trends
export async function calculateTrends(cropType: CropType, county?: string): Promise<{
  currentPrice: number;
  weekAgo: number;
  monthAgo: number;
  trend: PriceTrend;
  changePercent: number;
}> {
  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const monthAgo = new Date(today);
  monthAgo.setMonth(monthAgo.getMonth() - 1);

  // Get recent prices
  const recentPrices = await prisma.priceHistory.findMany({
    where: {
      cropType,
      ...(county && { county }),
      date: { gte: monthAgo },
    },
    orderBy: { date: 'desc' },
  });

  if (recentPrices.length === 0) {
    return {
      currentPrice: BASE_PRICES[cropType].avg,
      weekAgo: BASE_PRICES[cropType].avg,
      monthAgo: BASE_PRICES[cropType].avg,
      trend: 'STABLE',
      changePercent: 0,
    };
  }

  // Calculate averages
  const currentPrices = recentPrices.filter(p =>
    p.date >= new Date(today.toISOString().split('T')[0])
  );
  const weekAgoPrices = recentPrices.filter(p => {
    const d = new Date(p.date);
    return d >= weekAgo && d < new Date(today.setDate(today.getDate() - 1));
  });
  const monthAgoPrices = recentPrices.filter(p => {
    const d = new Date(p.date);
    return d >= monthAgo && d < weekAgo;
  });

  const avg = (prices: typeof recentPrices) =>
    prices.length > 0
      ? prices.reduce((sum, p) => sum + p.price, 0) / prices.length
      : BASE_PRICES[cropType].avg;

  const currentPrice = Math.round(avg(currentPrices.length > 0 ? currentPrices : recentPrices.slice(0, 5)));
  const weekAgoPrice = Math.round(avg(weekAgoPrices.length > 0 ? weekAgoPrices : recentPrices));
  const monthAgoPrice = Math.round(avg(monthAgoPrices.length > 0 ? monthAgoPrices : recentPrices));

  const changePercent = ((currentPrice - weekAgoPrice) / weekAgoPrice) * 100;

  let trend: PriceTrend;
  if (changePercent > 5) trend = 'RISING';
  else if (changePercent < -5) trend = 'FALLING';
  else trend = 'STABLE';

  return {
    currentPrice,
    weekAgo: weekAgoPrice,
    monthAgo: monthAgoPrice,
    trend,
    changePercent: Math.round(changePercent * 10) / 10,
  };
}

// Kenya county coordinates for weather API
const COUNTY_COORDS: Record<string, { lat: number; lon: number }> = {
  'Nairobi': { lat: -1.2921, lon: 36.8219 },
  'Mombasa': { lat: -4.0435, lon: 39.6682 },
  'Kisumu': { lat: -0.1022, lon: 34.7617 },
  'Nakuru': { lat: -0.3031, lon: 36.0800 },
  'Kiambu': { lat: -1.1714, lon: 36.8356 },
  'Uasin Gishu': { lat: 0.5143, lon: 35.2698 },
  'Trans Nzoia': { lat: 1.0567, lon: 34.9507 },
  'Nyandarua': { lat: -0.1804, lon: 36.5230 },
  'Meru': { lat: 0.0500, lon: 37.6500 },
  'Embu': { lat: -0.5375, lon: 37.4592 },
  'Machakos': { lat: -1.5177, lon: 37.2634 },
  'Kajiado': { lat: -1.8519, lon: 36.7819 },
  'Nyeri': { lat: -0.4197, lon: 36.9553 },
  'Murang\'a': { lat: -0.7839, lon: 37.1511 },
  'Kirinyaga': { lat: -0.5000, lon: 37.3000 },
};

// Fetch real weather data from Open-Meteo (free, no API key needed)
export async function fetchRealWeatherData(county: string): Promise<{
  temperature: number;
  rainfall: number;
  humidity: number;
} | null> {
  const coords = COUNTY_COORDS[county];
  if (!coords) return null;

  try {
    const response = await axios.get(
      `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&current=temperature_2m,relative_humidity_2m,precipitation`
    );

    const current = response.data.current;
    return {
      temperature: current.temperature_2m,
      rainfall: current.precipitation,
      humidity: current.relative_humidity_2m,
    };
  } catch (error) {
    console.error('Weather fetch error:', error);
    return null;
  }
}

// Update today's weather from real API
export async function syncRealWeatherData(): Promise<void> {
  console.log('Syncing real weather data...');
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const county of Object.keys(COUNTY_COORDS)) {
    const weather = await fetchRealWeatherData(county);
    if (weather) {
      try {
        await prisma.weatherData.upsert({
          where: {
            county_date: { county, date: today },
          },
          update: {
            temperature: weather.temperature,
            rainfall: weather.rainfall,
            humidity: weather.humidity,
            source: 'open-meteo',
          },
          create: {
            county,
            date: today,
            temperature: weather.temperature,
            rainfall: weather.rainfall,
            humidity: weather.humidity,
            source: 'open-meteo',
          },
        });
      } catch (e) {
        // Skip errors
      }
    }
  }
  console.log('Weather sync complete');
}

export { prisma };
