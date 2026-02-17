/**
 * SunHarvest Connect — Database Seed Script
 *
 * Populates the database with:
 *   1. Historical market price data (2 years, 13 crops, 5 markets)
 *   2. Historical weather data (2 years, 15 counties)
 *   3. Sample listing sale data (500 records for ML training)
 *   4. Current day real weather data from Open-Meteo API
 *   5. Current MarketPrice snapshots for the /market/prices endpoint
 *
 * Usage:  npx ts-node prisma/seed.ts
 *   or:   npm run db:seed
 */

import { PrismaClient, CropType } from '@prisma/client';
import {
  generateHistoricalPriceData,
  generateHistoricalWeatherData,
  generateListingSaleData,
  syncRealWeatherData,
  BASE_PRICES,
  KENYA_MARKETS,
  calculateTrends,
} from '../src/services/marketDataService';

const prisma = new PrismaClient();

async function seedMarketPriceSnapshots(): Promise<void> {
  console.log('Seeding current MarketPrice snapshots...');

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const crops = Object.keys(BASE_PRICES) as CropType[];
  let count = 0;

  for (const market of KENYA_MARKETS) {
    for (const crop of crops) {
      // Get trends from historical data (if available) or use base prices
      let wholesale: number;
      let trend: 'RISING' | 'STABLE' | 'FALLING' = 'STABLE';
      let previousPrice: number | null = null;

      try {
        const trends = await calculateTrends(crop, market.county);
        wholesale = trends.currentPrice;
        trend = trends.trend;
        previousPrice = trends.weekAgo;
      } catch {
        wholesale = BASE_PRICES[crop].avg;
      }

      const retail = Math.round(wholesale * 1.3);

      try {
        await prisma.marketPrice.upsert({
          where: {
            cropType_market_date: {
              cropType: crop,
              market: market.name,
              date: today,
            },
          },
          update: {
            wholesale,
            retail,
            trend,
            previousPrice,
            source: 'seed',
          },
          create: {
            cropType: crop,
            market: market.name,
            marketType: 'WHOLESALE',
            wholesale,
            retail,
            trend,
            previousPrice,
            date: today,
            source: 'seed',
          },
        });
        count++;
      } catch (error) {
        // Skip on duplicate/error
      }
    }
  }

  console.log(`Seeded ${count} MarketPrice snapshots`);
}

async function seedSaccoGroups(): Promise<void> {
  console.log('Seeding SACCO groups...');

  const groups = [
    {
      name: 'Kiambu Farmers Cooperative',
      description: 'A savings and credit cooperative for smallholder farmers in Kiambu County.',
      county: 'Kiambu',
      contributionAmount: 2000,
      frequency: 'MONTHLY' as const,
    },
    {
      name: 'Limuru Agri-Coop',
      description: 'Agricultural cooperative supporting tea and vegetable farmers in Limuru.',
      county: 'Kiambu',
      contributionAmount: 5000,
      frequency: 'MONTHLY' as const,
    },
    {
      name: 'Nakuru Growers SACCO',
      description: 'Cooperative for flower and vegetable growers in the Nakuru region.',
      county: 'Nakuru',
      contributionAmount: 3000,
      frequency: 'MONTHLY' as const,
    },
    {
      name: 'Mombasa Traders Union',
      description: 'Trade and savings union for produce traders in Mombasa.',
      county: 'Mombasa',
      contributionAmount: 1500,
      frequency: 'MONTHLY' as const,
    },
    {
      name: 'Kisumu Farmers Network',
      description: 'Network of farmers in Kisumu County focused on rice and fish farming.',
      county: 'Kisumu',
      contributionAmount: 2500,
      frequency: 'MONTHLY' as const,
    },
  ];

  let count = 0;
  for (const group of groups) {
    try {
      await prisma.saccoGroup.upsert({
        where: { id: group.name }, // Will fail on first run, caught below
        update: {},
        create: group,
      });
      count++;
    } catch {
      // If upsert fails (no unique on name), try create
      try {
        const existing = await (prisma.saccoGroup as any).findFirst({
          where: { name: group.name },
        });
        if (!existing) {
          await prisma.saccoGroup.create({ data: group });
          count++;
        } else {
          count++;
        }
      } catch (innerErr) {
        console.warn(`Failed to seed group ${group.name}:`, innerErr);
      }
    }
  }

  console.log(`Seeded ${count} SACCO groups`);
}

/**
 * Seed completed transactions to populate history, revenue, ratings.
 * Uses existing users and listings from the DB — not hardcoded IDs.
 */
async function seedCompletedTransactions(): Promise<void> {
  console.log('Seeding completed transactions...');

  // Find a farmer with listings
  const farmer = await prisma.user.findFirst({
    where: { role: 'FARMER', listings: { some: { status: 'ACTIVE' } } },
    include: { listings: { where: { status: 'ACTIVE' }, take: 5 } },
  });
  if (!farmer || farmer.listings.length === 0) {
    console.warn('No farmer with active listings found — skipping transactions');
    return;
  }

  // Find buyers
  const buyers = await prisma.user.findMany({
    where: { role: 'BUYER' },
    take: 3,
  });
  if (buyers.length === 0) {
    console.warn('No buyers found — skipping transactions');
    return;
  }

  // Find a transporter
  const transporter = await prisma.user.findFirst({
    where: { role: 'TRANSPORTER' },
  });

  // First: complete any existing ACCEPTED transactions
  const existingAccepted = await prisma.transaction.findMany({
    where: { status: 'ACCEPTED' },
    include: { listing: true },
  });

  const completedTxnIds: string[] = [];
  const ratings = [4.5, 5.0, 4.0, 4.8, 4.2]; // Realistic rating spread
  let ratingIdx = 0;

  for (const txn of existingAccepted) {
    const now = new Date();
    const paidAt = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000); // 5 days ago
    const deliveredAt = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000); // 3 days ago
    const completedAt = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000); // 2 days ago

    await prisma.transaction.update({
      where: { id: txn.id },
      data: {
        status: 'COMPLETED',
        paymentMethod: 'MPESA',
        paymentRef: `MPESA${Date.now().toString(36).toUpperCase()}${ratingIdx}`,
        paidAt,
        transporterId: transporter?.id || null,
        pickupDate: paidAt,
        deliveredAt,
        completedAt,
      },
    });

    // Mark listing as SOLD
    await prisma.produceListing.update({
      where: { id: txn.listingId },
      data: { status: 'SOLD' },
    });

    completedTxnIds.push(txn.id);
    ratingIdx++;
  }

  console.log(`  Completed ${existingAccepted.length} existing ACCEPTED transactions`);

  // Create new completed transactions from different buyers on remaining active listings
  const remainingListings = await prisma.produceListing.findMany({
    where: { farmerId: farmer.id, status: 'ACTIVE' },
    take: 3 - existingAccepted.length, // Fill up to 3 total
  });

  for (let i = 0; i < remainingListings.length; i++) {
    const listing = remainingListings[i];
    const buyer = buyers[i % buyers.length];
    const daysAgo = 10 + i * 5; // Spread across time: 10, 15, 20 days ago
    const createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
    const paidAt = new Date(createdAt.getTime() + 1 * 24 * 60 * 60 * 1000);
    const deliveredAt = new Date(createdAt.getTime() + 3 * 24 * 60 * 60 * 1000);
    const completedAt = new Date(createdAt.getTime() + 4 * 24 * 60 * 60 * 1000);

    // Negotiate slightly below asking price
    const agreedPrice = Math.round(listing.priceAmount * 0.95);

    const txn = await prisma.transaction.create({
      data: {
        listingId: listing.id,
        buyerId: buyer.id,
        quantity: listing.quantity,
        unit: listing.unit,
        agreedPrice,
        currency: 'KES',
        status: 'COMPLETED',
        paymentMethod: 'MPESA',
        paymentRef: `MPESA${Date.now().toString(36).toUpperCase()}${i}`,
        paidAt,
        transporterId: transporter?.id || null,
        pickupDate: paidAt,
        deliveredAt,
        completedAt,
        createdAt,
      },
    });

    // Mark listing as SOLD
    await prisma.produceListing.update({
      where: { id: listing.id },
      data: { status: 'SOLD' },
    });

    completedTxnIds.push(txn.id);
    ratingIdx++;
  }

  console.log(`  Created ${remainingListings.length} new completed transactions`);

  // Update farmer's rating based on completed transactions
  const totalCompleted = completedTxnIds.length + (farmer.totalRatings || 0);
  const usedRatings = ratings.slice(0, completedTxnIds.length);
  const avgRating = usedRatings.reduce((sum, r) => sum + r, 0) / usedRatings.length;

  // Blend with any existing rating
  const blendedRating = farmer.totalRatings > 0
    ? ((farmer.rating || 0) * farmer.totalRatings + avgRating * completedTxnIds.length) / totalCompleted
    : avgRating;

  await prisma.user.update({
    where: { id: farmer.id },
    data: {
      rating: Math.round(blendedRating * 10) / 10,
      totalRatings: totalCompleted,
    },
  });

  console.log(`  Updated ${farmer.name}'s rating to ${Math.round(blendedRating * 10) / 10} (${totalCompleted} ratings)`);

  // Create notifications for the completed transactions
  for (let i = 0; i < completedTxnIds.length; i++) {
    const txnId = completedTxnIds[i];
    const buyer = buyers[i % buyers.length];

    await prisma.notification.createMany({
      data: [
        {
          userId: farmer.id,
          type: 'payment_confirmed',
          title: 'Payment Received',
          message: `Payment of KSh ${ratings[i] ? Math.round(farmer.listings[i]?.priceAmount || 100) : 100} confirmed via M-Pesa`,
          data: { transactionId: txnId },
          isRead: true,
          createdAt: new Date(Date.now() - (10 - i) * 24 * 60 * 60 * 1000),
        },
        {
          userId: farmer.id,
          type: 'transaction_completed',
          title: 'Transaction Complete',
          message: `Transaction with ${buyer.name} completed successfully`,
          data: { transactionId: txnId },
          isRead: i < 2, // Older ones read, recent ones unread
          createdAt: new Date(Date.now() - (8 - i) * 24 * 60 * 60 * 1000),
        },
      ],
    });
  }

  console.log(`  Created ${completedTxnIds.length * 2} notifications`);
}

/**
 * Seed SACCO membership and contributions for the primary farmer.
 */
async function seedSaccoData(): Promise<void> {
  console.log('Seeding SACCO membership and contributions...');

  const farmer = await prisma.user.findFirst({
    where: { role: 'FARMER' },
  });
  if (!farmer) return;

  const saccoGroup = await prisma.saccoGroup.findFirst();
  if (!saccoGroup) return;

  // Check if already a member
  let membership = await prisma.saccoMembership.findUnique({
    where: { userId_groupId: { userId: farmer.id, groupId: saccoGroup.id } },
  });

  if (!membership) {
    membership = await prisma.saccoMembership.create({
      data: {
        userId: farmer.id,
        groupId: saccoGroup.id,
        role: 'MEMBER',
        savings: 0,
        joinedAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 3 months ago
      },
    });

    // Update group member count
    await prisma.saccoGroup.update({
      where: { id: saccoGroup.id },
      data: { memberCount: { increment: 1 } },
    });
  }

  // Add 3 monthly contributions
  const existingContribs = await prisma.saccoContribution.count({
    where: { membershipId: membership.id },
  });

  if (existingContribs === 0) {
    let totalSaved = 0;
    for (let i = 0; i < 3; i++) {
      const amount = saccoGroup.contributionAmount;
      totalSaved += amount;

      await prisma.saccoContribution.create({
        data: {
          membershipId: membership.id,
          amount,
          paymentRef: `MPESASACCO${Date.now().toString(36).toUpperCase()}${i}`,
          paymentMethod: 'MPESA',
          status: 'CONFIRMED',
          createdAt: new Date(Date.now() - (90 - i * 30) * 24 * 60 * 60 * 1000),
        },
      });
    }

    // Update savings balance
    await prisma.saccoMembership.update({
      where: { id: membership.id },
      data: { savings: totalSaved },
    });

    // Update group total balance
    await prisma.saccoGroup.update({
      where: { id: saccoGroup.id },
      data: { totalBalance: { increment: totalSaved } },
    });

    console.log(`  Added 3 contributions (KSh ${totalSaved} total) for ${farmer.name}`);
  } else {
    console.log(`  ${farmer.name} already has ${existingContribs} contributions — skipping`);
  }
}

async function main(): Promise<void> {
  console.log('=== SunHarvest Connect Database Seed ===\n');
  const start = Date.now();

  try {
    // 1. Historical price data (2 years across 5 markets x 13 crops)
    await generateHistoricalPriceData();

    // 2. Historical weather data (2 years across 15 counties)
    await generateHistoricalWeatherData();

    // 3. Sample listing sale data (500 records for success prediction training)
    await generateListingSaleData();

    // 4. Current MarketPrice snapshots
    await seedMarketPriceSnapshots();

    // 5. SACCO groups
    await seedSaccoGroups();

    // 6. Completed transactions (3-5 with full lifecycle)
    await seedCompletedTransactions();

    // 7. SACCO membership + contributions
    await seedSaccoData();

    // 8. Sync today's real weather from Open-Meteo (free API, no key needed)
    try {
      await syncRealWeatherData();
    } catch (err) {
      console.warn('Skipping real weather sync (network unavailable):', err);
    }

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`\n=== Seed complete in ${elapsed}s ===`);
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
