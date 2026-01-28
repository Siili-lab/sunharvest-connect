/**
 * Seed Market Intelligence Data
 *
 * Run: npx ts-node scripts/seedMarketData.ts
 *
 * This generates 2 years of historical price data, weather data,
 * and sample listing sale data for ML model training.
 */

import { PrismaClient } from '@prisma/client';
import {
  generateHistoricalPriceData,
  generateHistoricalWeatherData,
  generateListingSaleData,
} from '../src/services/marketDataService';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting market data seeding...\n');

  const startTime = Date.now();

  try {
    // Check database connection
    await prisma.$connect();
    console.log('✅ Database connected\n');

    // Generate historical price data
    console.log('📊 Generating 2 years of price history...');
    await generateHistoricalPriceData();
    console.log('');

    // Generate weather data
    console.log('🌤️  Generating weather data...');
    await generateHistoricalWeatherData();
    console.log('');

    // Generate listing sale data
    console.log('📈 Generating listing sale data...');
    await generateListingSaleData();
    console.log('');

    // Summary
    const priceCount = await prisma.priceHistory.count();
    const weatherCount = await prisma.weatherData.count();
    const saleCount = await prisma.listingSaleData.count();

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log('═══════════════════════════════════════');
    console.log('✅ SEEDING COMPLETE');
    console.log('═══════════════════════════════════════');
    console.log(`   Price history records: ${priceCount.toLocaleString()}`);
    console.log(`   Weather records:       ${weatherCount.toLocaleString()}`);
    console.log(`   Sale data records:     ${saleCount.toLocaleString()}`);
    console.log(`   Duration:              ${duration}s`);
    console.log('═══════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
