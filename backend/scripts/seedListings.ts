/**
 * Seed Listings and Users Data
 *
 * Run: npx ts-node scripts/seedListings.ts
 *
 * This creates sample farmers, buyers, and produce listings for the marketplace.
 */

import { PrismaClient, CropType, QualityGrade, UserRole, Unit } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Sample Kenyan counties
const COUNTIES = [
  'Kiambu', 'Nyandarua', 'Nyeri', 'Muranga', 'Kirinyaga',
  'Nakuru', 'Narok', 'Kajiado', 'Machakos', 'Makueni',
  'Meru', 'Embu', 'Tharaka Nithi', 'Laikipia', 'Uasin Gishu',
];

// Sample farmer names
const FARMER_NAMES = [
  'John Kamau', 'Mary Wanjiku', 'Peter Ochieng', 'Sarah Akinyi',
  'David Mwangi', 'Grace Njeri', 'James Mutua', 'Elizabeth Wambui',
  'Michael Kipchoge', 'Ann Chebet', 'Joseph Wekesa', 'Faith Muthoni',
];

// Sample buyer names
const BUYER_NAMES = [
  'Safari Hotel', 'Green Grocers Ltd', 'Mama Ngina Restaurant',
  'Westlands Supermarket', 'Java House', 'Naivas Stores',
  'Carrefour Kenya', 'Fresh Mart', 'Tuskys Supermarket',
];

// Crop prices (KSh per kg)
const CROP_PRICES: Record<CropType, { min: number; max: number }> = {
  TOMATOES: { min: 60, max: 120 },
  POTATOES: { min: 50, max: 90 },
  ONIONS: { min: 70, max: 130 },
  CABBAGE: { min: 30, max: 60 },
  KALE: { min: 40, max: 70 },
  SPINACH: { min: 45, max: 80 },
  CARROTS: { min: 60, max: 100 },
  MANGOES: { min: 100, max: 200 },
  AVOCADO: { min: 150, max: 300 },
  BANANAS: { min: 30, max: 60 },
  ORANGES: { min: 80, max: 150 },
  PEPPERS: { min: 100, max: 180 },
  OTHER: { min: 50, max: 100 },
};

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generatePhone(): string {
  const prefixes = ['0712', '0723', '0734', '0745', '0756', '0767', '0778', '0789'];
  return randomItem(prefixes) + randomInt(100000, 999999).toString();
}

async function main() {
  console.log('Starting listings seed...\n');

  try {
    await prisma.$connect();
    console.log('Database connected\n');

    // Hash the default PIN
    const hashedPin = await bcrypt.hash('1234', 10);
    console.log('PIN hashed for secure storage\n');

    // Clear existing data
    console.log('Clearing existing listings and users...');
    await prisma.transaction.deleteMany({});
    await prisma.produceListing.deleteMany({});
    await prisma.user.deleteMany({});
    console.log('Cleared\n');

    // Create DEMO accounts with fixed phone numbers for easy testing
    console.log('Creating demo test accounts...');
    const demoFarmer = await prisma.user.create({
      data: {
        name: 'John Mwangi',
        phone: '+254712345678',
        pin: hashedPin,
        role: UserRole.FARMER,
        county: 'Kiambu',
        rating: 4.8,
        totalRatings: 156,
        isVerified: true,
      },
    });

    const demoBuyer = await prisma.user.create({
      data: {
        name: 'Sarah Ochieng',
        phone: '+254723456789',
        pin: hashedPin,
        role: UserRole.BUYER,
        county: 'Nairobi',
        rating: 4.9,
        totalRatings: 89,
        isVerified: true,
      },
    });

    const demoTransporter = await prisma.user.create({
      data: {
        name: 'James Kiprop',
        phone: '+254734567890',
        pin: hashedPin,
        role: UserRole.TRANSPORTER,
        county: 'Nakuru',
        rating: 4.7,
        totalRatings: 234,
        isVerified: true,
      },
    });
    console.log('Created 3 demo accounts\n');

    // Create additional farmers
    console.log('Creating farmers...');
    const farmers = [demoFarmer];
    for (const name of FARMER_NAMES.slice(1)) { // Skip first as we have demoFarmer
      const farmer = await prisma.user.create({
        data: {
          name,
          phone: generatePhone(),
          pin: hashedPin,
          role: UserRole.FARMER,
          county: randomItem(COUNTIES),
          rating: 3.5 + Math.random() * 1.5,
          totalRatings: randomInt(5, 50),
        },
      });
      farmers.push(farmer);
    }
    console.log(`Created ${farmers.length} farmers\n`);

    // Create additional buyers
    console.log('Creating buyers...');
    const buyers = [demoBuyer];
    for (const name of BUYER_NAMES.slice(1)) { // Skip first as we have demoBuyer
      const buyer = await prisma.user.create({
        data: {
          name,
          phone: generatePhone(),
          pin: hashedPin,
          role: UserRole.BUYER,
          county: randomItem(COUNTIES),
          rating: 4.0 + Math.random() * 1.0,
          totalRatings: randomInt(10, 100),
        },
      });
      buyers.push(buyer);
    }
    console.log(`Created ${buyers.length} buyers\n`);

    // Create listings
    console.log('Creating produce listings...');
    const listings = [];
    const cropTypes: CropType[] = [
      'TOMATOES', 'POTATOES', 'ONIONS', 'CABBAGE', 'KALE',
      'SPINACH', 'CARROTS', 'MANGOES', 'AVOCADO', 'BANANAS',
    ];
    const grades: QualityGrade[] = ['PREMIUM', 'GRADE_A', 'GRADE_B'];

    for (const farmer of farmers) {
      // Each farmer has 2-4 listings
      const numListings = randomInt(2, 4);
      for (let i = 0; i < numListings; i++) {
        const cropType = randomItem(cropTypes);
        const priceRange = CROP_PRICES[cropType];
        const grade = randomItem(grades);

        // Premium gets higher prices
        let priceMultiplier = 1;
        if (grade === 'PREMIUM') priceMultiplier = 1.2;
        if (grade === 'GRADE_B') priceMultiplier = 0.8;

        const basePrice = randomInt(priceRange.min, priceRange.max);
        const price = Math.round(basePrice * priceMultiplier);

        const harvestDate = new Date();
        harvestDate.setDate(harvestDate.getDate() - randomInt(1, 7));

        const availableUntil = new Date();
        availableUntil.setDate(availableUntil.getDate() + randomInt(3, 14));

        const listing = await prisma.produceListing.create({
          data: {
            farmerId: farmer.id,
            cropType,
            qualityGrade: grade,
            priceAmount: price,
            quantity: randomInt(50, 1000),
            unit: Unit.KG,
            county: farmer.county || COUNTIES[0],
            harvestDate,
            availableUntil,
            status: 'ACTIVE',
            images: [],
          },
        });
        listings.push(listing);
      }
    }
    console.log(`Created ${listings.length} listings\n`);

    // Summary
    console.log('═══════════════════════════════════════');
    console.log('SEEDING COMPLETE');
    console.log('═══════════════════════════════════════');
    console.log(`   Farmers:     ${farmers.length}`);
    console.log(`   Buyers:      ${buyers.length}`);
    console.log(`   Transporter: 1`);
    console.log(`   Listings:    ${listings.length}`);
    console.log('═══════════════════════════════════════');
    console.log('\nDEMO ACCOUNTS (PIN: 1234 for all):');
    console.log('───────────────────────────────────────');
    console.log(`   FARMER:      +254712345678`);
    console.log(`   BUYER:       +254723456789`);
    console.log(`   TRANSPORTER: +254734567890`);
    console.log('═══════════════════════════════════════\n');

  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
