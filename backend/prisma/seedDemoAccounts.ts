/**
 * Seed realistic data for buyer and transporter demo accounts.
 * Run: npx ts-node prisma/seedDemoAccounts.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Unsplash crop images (free, no auth needed, reliable CDN)
const CROP_IMAGES: Record<string, string> = {
  TOMATOES: 'https://images.unsplash.com/photo-1546470427-0d4db154ceb8?w=400&h=300&fit=crop',
  MANGOES: 'https://images.unsplash.com/photo-1553279768-865429fa0078?w=400&h=300&fit=crop',
  ONIONS: 'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=400&h=300&fit=crop',
  POTATOES: 'https://images.unsplash.com/photo-1518977676601-b53f82ber0?w=400&h=300&fit=crop',
  CABBAGE: 'https://images.unsplash.com/photo-1594282486552-05b4d80fbb9f?w=400&h=300&fit=crop',
  KALE: 'https://images.unsplash.com/photo-1524179091875-bf99a9a6af57?w=400&h=300&fit=crop',
  SPINACH: 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=400&h=300&fit=crop',
  AVOCADO: 'https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?w=400&h=300&fit=crop',
  BANANAS: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=400&h=300&fit=crop',
  ORANGES: 'https://images.unsplash.com/photo-1547514701-42782101795e?w=400&h=300&fit=crop',
  PEPPERS: 'https://images.unsplash.com/photo-1563565375-f3fdfdbefa83?w=400&h=300&fit=crop',
  CARROTS: 'https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=400&h=300&fit=crop',
  OTHER: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=400&h=300&fit=crop',
};

async function run() {
  console.log('=== Seeding demo account data ===\n');

  // ── 1. Fix buyer (Sarah Ochieng) ──
  const buyer = await prisma.user.findFirst({ where: { phone: '+254723456789' } });
  if (!buyer) { console.log('Buyer not found'); return; }
  console.log(`Buyer: ${buyer.name} (${buyer.id})`);

  // Check existing buyer transactions
  const existingBuyerTxns = await prisma.transaction.findMany({
    where: { buyerId: buyer.id },
    include: { listing: true },
  });
  console.log(`  Existing transactions: ${existingBuyerTxns.length}`);

  // Create 3 more completed purchases from various farmers
  const otherListings = await prisma.produceListing.findMany({
    where: {
      status: 'ACTIVE',
      farmer: { NOT: { phone: '+254712345678' } }, // Not from John
    },
    take: 3,
  });

  const transporter = await prisma.user.findFirst({ where: { phone: '+254734567890' } });
  const buyerRatings = [4.7, 5.0, 4.5];
  const newBuyerTxns: string[] = [];

  for (let i = 0; i < otherListings.length; i++) {
    const listing = otherListings[i];
    const daysAgo = 7 + i * 6; // 7, 13, 19 days ago
    const createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
    const paidAt = new Date(createdAt.getTime() + 4 * 60 * 60 * 1000); // 4 hours later
    const deliveredAt = new Date(createdAt.getTime() + 2 * 24 * 60 * 60 * 1000);
    const completedAt = new Date(createdAt.getTime() + 3 * 24 * 60 * 60 * 1000);
    const agreedPrice = Math.round(listing.priceAmount * 0.92);

    const txn = await prisma.transaction.create({
      data: {
        listingId: listing.id,
        buyerId: buyer.id,
        quantity: Math.round(listing.quantity * 0.3), // Buy 30% of stock
        unit: listing.unit,
        agreedPrice,
        currency: 'KES',
        status: 'COMPLETED',
        paymentMethod: 'MPESA',
        paymentRef: `MPESABUY${Date.now().toString(36).toUpperCase()}${i}`,
        paidAt,
        transporterId: transporter?.id || null,
        pickupDate: paidAt,
        deliveredAt,
        completedAt,
        createdAt,
      },
    });
    newBuyerTxns.push(txn.id);
  }
  console.log(`  Created ${newBuyerTxns.length} new purchase transactions`);

  // Fix buyer rating (realistic based on actual transactions)
  const totalBuyerTxns = existingBuyerTxns.length + newBuyerTxns.length;
  const avgBuyerRating = buyerRatings.slice(0, newBuyerTxns.length).reduce((s, r) => s + r, 0) / Math.max(newBuyerTxns.length, 1);
  await prisma.user.update({
    where: { id: buyer.id },
    data: {
      rating: Math.round(avgBuyerRating * 10) / 10,
      totalRatings: totalBuyerTxns,
    },
  });
  console.log(`  Updated rating to ${Math.round(avgBuyerRating * 10) / 10} (${totalBuyerTxns} ratings)`);

  // Add buyer notifications
  const buyerNotifCount = await prisma.notification.count({ where: { userId: buyer.id } });
  if (buyerNotifCount < 3) {
    await prisma.notification.createMany({
      data: [
        {
          userId: buyer.id,
          type: 'offer_accepted',
          title: 'Offer Accepted',
          message: 'Your offer for Carrots has been accepted by the farmer',
          data: {},
          isRead: true,
          createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
        {
          userId: buyer.id,
          type: 'delivery_started',
          title: 'Delivery In Progress',
          message: 'Your order of Spinach is on the way!',
          data: {},
          isRead: true,
          createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        },
        {
          userId: buyer.id,
          type: 'transaction_completed',
          title: 'Order Delivered',
          message: 'Your order of Mangoes has been delivered successfully',
          data: {},
          isRead: false,
          createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        },
        {
          userId: buyer.id,
          type: 'price_alert',
          title: 'Price Drop Alert',
          message: 'Avocado prices dropped 12% in Nairobi markets — good time to stock up',
          data: {},
          isRead: false,
          createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        },
      ],
    });
    console.log('  Created 4 notifications');
  }

  // ── 2. Fix transporter (James Kiprop) ──
  if (!transporter) { console.log('Transporter not found'); return; }
  console.log(`\nTransporter: ${transporter.name} (${transporter.id})`);

  // Fix transporter rating
  const transporterDeliveries = await prisma.transaction.count({ where: { transporterId: transporter.id, status: 'COMPLETED' } });
  await prisma.user.update({
    where: { id: transporter.id },
    data: {
      rating: 4.6,
      totalRatings: Math.max(transporterDeliveries, 3),
    },
  });
  console.log(`  Updated rating to 4.6 (${Math.max(transporterDeliveries, 3)} ratings)`);

  // Add transporter notifications
  const transporterNotifCount = await prisma.notification.count({ where: { userId: transporter.id } });
  if (transporterNotifCount < 2) {
    await prisma.notification.createMany({
      data: [
        {
          userId: transporter.id,
          type: 'delivery_assigned',
          title: 'New Delivery Job',
          message: 'You have been assigned a delivery from Kiambu to Nairobi',
          data: {},
          isRead: true,
          createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        },
        {
          userId: transporter.id,
          type: 'delivery_completed',
          title: 'Delivery Confirmed',
          message: 'Delivery to Nairobi Wakulima Market confirmed. Great job!',
          data: {},
          isRead: true,
          createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        },
        {
          userId: transporter.id,
          type: 'rating_received',
          title: 'New Rating',
          message: 'You received a 5-star rating from Sarah Ochieng',
          data: {},
          isRead: false,
          createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        },
      ],
    });
    console.log('  Created 3 notifications');
  }

  // ── 3. Add SACCO membership for buyer ──
  const saccoGroup = await prisma.saccoGroup.findFirst({ where: { county: 'Kiambu' } });
  if (saccoGroup) {
    const existingMembership = await prisma.saccoMembership.findUnique({
      where: { userId_groupId: { userId: buyer.id, groupId: saccoGroup.id } },
    });
    if (!existingMembership) {
      const membership = await prisma.saccoMembership.create({
        data: {
          userId: buyer.id,
          groupId: saccoGroup.id,
          role: 'MEMBER',
          savings: saccoGroup.contributionAmount * 2,
          joinedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
        },
      });
      // 2 contributions
      for (let i = 0; i < 2; i++) {
        await prisma.saccoContribution.create({
          data: {
            membershipId: membership.id,
            amount: saccoGroup.contributionAmount,
            paymentRef: `MPESASACCOB${Date.now().toString(36).toUpperCase()}${i}`,
            paymentMethod: 'MPESA',
            status: 'CONFIRMED',
            createdAt: new Date(Date.now() - (60 - i * 30) * 24 * 60 * 60 * 1000),
          },
        });
      }
      await prisma.saccoGroup.update({
        where: { id: saccoGroup.id },
        data: { memberCount: { increment: 1 }, totalBalance: { increment: saccoGroup.contributionAmount * 2 } },
      });
      console.log(`  Added buyer SACCO membership (KSh ${saccoGroup.contributionAmount * 2} saved)`);
    }
  }

  // ── 4. Add images to ALL listings ──
  console.log('\nAdding images to listings...');
  const allListings = await prisma.produceListing.findMany({
    where: { images: { isEmpty: true } },
    select: { id: true, cropType: true },
  });

  let imgCount = 0;
  for (const listing of allListings) {
    const imageUrl = CROP_IMAGES[listing.cropType] || CROP_IMAGES.OTHER;
    await prisma.produceListing.update({
      where: { id: listing.id },
      data: { images: [imageUrl] },
    });
    imgCount++;
  }
  console.log(`  Added images to ${imgCount} listings`);

  console.log('\n=== Done! ===');
  await prisma.$disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
