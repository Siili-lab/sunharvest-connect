/**
 * Seed completed transactions, SACCO data, and notifications.
 * Run: npx ts-node prisma/seedTransactions.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  console.log('=== Seeding transactions & SACCO data ===\n');

  // --- COMPLETED TRANSACTIONS ---
  console.log('Seeding completed transactions...');

  const farmer = await prisma.user.findFirst({
    where: { role: 'FARMER', listings: { some: { status: 'ACTIVE' } } },
    include: { listings: { where: { status: 'ACTIVE' }, take: 5 } },
  });
  if (!farmer) {
    console.log('No farmer with active listings found');
    return;
  }

  const buyers = await prisma.user.findMany({ where: { role: 'BUYER' }, take: 3 });
  const transporter = await prisma.user.findFirst({ where: { role: 'TRANSPORTER' } });

  // Complete existing ACCEPTED transactions
  const existingAccepted = await prisma.transaction.findMany({
    where: { status: 'ACCEPTED' },
    include: { listing: true },
  });

  const completedTxnIds: string[] = [];
  const ratings = [4.5, 5.0, 4.0, 4.8, 4.2];
  let ratingIdx = 0;

  for (const txn of existingAccepted) {
    const now = new Date();
    const paidAt = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
    const deliveredAt = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    const completedAt = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

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

    await prisma.produceListing.update({
      where: { id: txn.listingId },
      data: { status: 'SOLD' },
    });

    completedTxnIds.push(txn.id);
    ratingIdx++;
  }
  console.log(`  Completed ${existingAccepted.length} existing ACCEPTED transactions`);

  // Create new completed transactions from different buyers
  const remainingListings = await prisma.produceListing.findMany({
    where: { farmerId: farmer.id, status: 'ACTIVE' },
    take: Math.max(0, 3 - existingAccepted.length),
  });

  for (let i = 0; i < remainingListings.length; i++) {
    const listing = remainingListings[i];
    const buyer = buyers[i % buyers.length];
    const daysAgo = 10 + i * 5;
    const createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
    const paidAt = new Date(createdAt.getTime() + 1 * 24 * 60 * 60 * 1000);
    const deliveredAt = new Date(createdAt.getTime() + 3 * 24 * 60 * 60 * 1000);
    const completedAt = new Date(createdAt.getTime() + 4 * 24 * 60 * 60 * 1000);
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
        paymentRef: `MPESA${Date.now().toString(36).toUpperCase()}${i + 10}`,
        paidAt,
        transporterId: transporter?.id || null,
        pickupDate: paidAt,
        deliveredAt,
        completedAt,
        createdAt,
      },
    });

    await prisma.produceListing.update({
      where: { id: listing.id },
      data: { status: 'SOLD' },
    });

    completedTxnIds.push(txn.id);
    ratingIdx++;
  }
  console.log(`  Created ${remainingListings.length} new completed transactions`);

  // Update farmer rating based on completed transactions
  const usedRatings = ratings.slice(0, completedTxnIds.length);
  const avgRating = usedRatings.reduce((sum, r) => sum + r, 0) / usedRatings.length;
  await prisma.user.update({
    where: { id: farmer.id },
    data: {
      rating: Math.round(avgRating * 10) / 10,
      totalRatings: completedTxnIds.length,
    },
  });
  console.log(`  Updated ${farmer.name}'s rating to ${Math.round(avgRating * 10) / 10} (${completedTxnIds.length} ratings)`);

  // Create notifications for completed transactions
  for (let i = 0; i < completedTxnIds.length; i++) {
    const buyer = buyers[i % buyers.length];
    await prisma.notification.createMany({
      data: [
        {
          userId: farmer.id,
          type: 'payment_confirmed',
          title: 'Payment Received',
          message: 'Payment confirmed via M-Pesa',
          data: { transactionId: completedTxnIds[i] },
          isRead: true,
          createdAt: new Date(Date.now() - (10 - i) * 24 * 60 * 60 * 1000),
        },
        {
          userId: farmer.id,
          type: 'transaction_completed',
          title: 'Transaction Complete',
          message: `Transaction with ${buyer.name} completed successfully`,
          data: { transactionId: completedTxnIds[i] },
          isRead: i < 2,
          createdAt: new Date(Date.now() - (8 - i) * 24 * 60 * 60 * 1000),
        },
      ],
    });
  }
  console.log(`  Created ${completedTxnIds.length * 2} notifications`);

  // --- SACCO DATA ---
  console.log('\nSeeding SACCO data...');
  const saccoGroup = await prisma.saccoGroup.findFirst();
  if (!saccoGroup) {
    console.log('No SACCO group found');
    await prisma.$disconnect();
    return;
  }

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
        joinedAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
      },
    });
    await prisma.saccoGroup.update({
      where: { id: saccoGroup.id },
      data: { memberCount: { increment: 1 } },
    });
  }

  const existingContribs = await prisma.saccoContribution.count({
    where: { membershipId: membership.id },
  });

  if (existingContribs === 0) {
    let totalSaved = 0;
    for (let i = 0; i < 3; i++) {
      totalSaved += saccoGroup.contributionAmount;
      await prisma.saccoContribution.create({
        data: {
          membershipId: membership.id,
          amount: saccoGroup.contributionAmount,
          paymentRef: `MPESASACCO${Date.now().toString(36).toUpperCase()}${i}`,
          paymentMethod: 'MPESA',
          status: 'CONFIRMED',
          createdAt: new Date(Date.now() - (90 - i * 30) * 24 * 60 * 60 * 1000),
        },
      });
    }
    await prisma.saccoMembership.update({
      where: { id: membership.id },
      data: { savings: totalSaved },
    });
    await prisma.saccoGroup.update({
      where: { id: saccoGroup.id },
      data: { totalBalance: { increment: totalSaved } },
    });
    console.log(`  Added 3 contributions (KSh ${totalSaved} total) for ${farmer.name}`);
  } else {
    console.log(`  Already has ${existingContribs} contributions — skipping`);
  }

  console.log('\n=== Done! ===');
  await prisma.$disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
