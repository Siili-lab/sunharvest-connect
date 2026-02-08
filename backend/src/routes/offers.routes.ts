import { Router, Request, Response } from 'express';
import { PrismaClient, TransactionStatus } from '@prisma/client';
import { requireAuth, requireBuyer, requireFarmer, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { requireSelfOrAdmin, requireTransactionParty } from '../middleware/ownership';

const router = Router();
const prisma = new PrismaClient();

// POST /offers - Create new offer (buyer only, use token userId)
router.post('/', requireAuth, requireBuyer, async (req: Request, res: Response) => {
  try {
    const buyerId = (req as AuthenticatedRequest).user.userId;
    const { listingId, quantity, price, message } = req.body;

    if (!listingId || !quantity || !price) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['listingId', 'quantity', 'price'],
      });
    }

    // Get the listing to verify it exists and is active
    const listing = await prisma.produceListing.findUnique({
      where: { id: listingId },
      include: {
        farmer: { select: { name: true, phone: true } },
      },
    });

    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    if (listing.status !== 'ACTIVE') {
      return res.status(400).json({ error: 'Listing is no longer available' });
    }

    if (quantity > listing.quantity) {
      return res.status(400).json({
        error: `Requested quantity exceeds available (${listing.quantity} ${listing.unit})`,
      });
    }

    // Create the transaction/offer
    const offer = await prisma.transaction.create({
      data: {
        listingId,
        buyerId,
        quantity: parseFloat(quantity),
        unit: listing.unit,
        agreedPrice: parseFloat(price),
        status: 'PENDING',
      },
      include: {
        listing: {
          include: {
            farmer: { select: { name: true } },
          },
        },
        buyer: { select: { name: true, phone: true } },
      },
    });

    // Update listing status to reserved if full quantity
    if (quantity >= listing.quantity) {
      await prisma.produceListing.update({
        where: { id: listingId },
        data: { status: 'RESERVED' },
      });
    }

    res.status(201).json({
      success: true,
      offer: {
        id: offer.id,
        listingId: offer.listingId,
        crop: offer.listing.cropType,
        quantity: offer.quantity,
        price: offer.agreedPrice,
        total: offer.quantity * offer.agreedPrice,
        status: offer.status,
        farmer: offer.listing.farmer.name,
        buyer: offer.buyer.name,
        createdAt: offer.createdAt,
      },
    });
  } catch (error) {
    console.error('Error creating offer:', error);
    res.status(500).json({ error: 'Failed to create offer' });
  }
});

// GET /offers/buyer/:buyerId - Get offers made by a buyer (self or admin)
router.get('/buyer/:buyerId', requireAuth, requireSelfOrAdmin('buyerId'), async (req: Request, res: Response) => {
  try {
    const { buyerId } = req.params;
    const { status } = req.query;

    const where: any = { buyerId };
    if (status) where.status = status;

    const offers = await prisma.transaction.findMany({
      where,
      include: {
        listing: {
          include: {
            farmer: { select: { name: true, phone: true, county: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const response = offers.map((offer) => ({
      id: offer.id,
      crop: offer.listing.cropType,
      quantity: offer.quantity,
      price: offer.agreedPrice,
      total: offer.quantity * offer.agreedPrice,
      status: offer.status,
      farmer: offer.listing.farmer.name,
      farmerPhone: offer.listing.farmer.phone,
      location: offer.listing.farmer.county,
      images: offer.listing.images,
      createdAt: offer.createdAt,
    }));

    res.json(response);
  } catch (error) {
    console.error('Error fetching buyer offers:', error);
    res.status(500).json({ error: 'Failed to fetch offers' });
  }
});

// GET /offers/farmer/:farmerId - Get offers received by a farmer (self or admin)
router.get('/farmer/:farmerId', requireAuth, requireSelfOrAdmin('farmerId'), async (req: Request, res: Response) => {
  try {
    const { farmerId } = req.params;
    const { status } = req.query;

    const where: any = {
      listing: { farmerId },
    };
    if (status) where.status = status;

    const offers = await prisma.transaction.findMany({
      where,
      include: {
        listing: true,
        buyer: { select: { name: true, phone: true, county: true, rating: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const response = offers.map((offer) => ({
      id: offer.id,
      listingId: offer.listingId,
      crop: offer.listing.cropType,
      quantity: offer.quantity,
      price: offer.agreedPrice,
      listingPrice: offer.listing.priceAmount,
      priceDiff: ((offer.agreedPrice - offer.listing.priceAmount) / offer.listing.priceAmount * 100).toFixed(1),
      total: offer.quantity * offer.agreedPrice,
      status: offer.status,
      buyer: offer.buyer.name,
      buyerPhone: offer.buyer.phone,
      buyerRating: offer.buyer.rating,
      createdAt: offer.createdAt,
    }));

    res.json(response);
  } catch (error) {
    console.error('Error fetching farmer offers:', error);
    res.status(500).json({ error: 'Failed to fetch offers' });
  }
});

// PUT /offers/:id/accept - Farmer accepts offer (verify farmer owns listing)
router.put('/:id/accept', requireAuth, requireFarmer, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as AuthenticatedRequest).user.userId;

    // Fetch the offer and verify the farmer owns the listing
    const existingOffer = await prisma.transaction.findUnique({
      where: { id },
      include: { listing: { select: { farmerId: true } } },
    });

    if (!existingOffer) {
      return res.status(404).json({ error: 'Offer not found' });
    }

    if (existingOffer.listing.farmerId !== userId) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You do not own the listing for this offer.' },
      });
    }

    const offer = await prisma.transaction.update({
      where: { id },
      data: { status: 'ACCEPTED' },
      include: {
        listing: true,
        buyer: { select: { name: true, phone: true } },
      },
    });

    // Update listing status
    await prisma.produceListing.update({
      where: { id: offer.listingId },
      data: { status: 'RESERVED' },
    });

    res.json({
      success: true,
      message: 'Offer accepted',
      offer: {
        id: offer.id,
        status: offer.status,
        buyer: offer.buyer.name,
        buyerPhone: offer.buyer.phone,
        total: offer.quantity * offer.agreedPrice,
      },
    });
  } catch (error) {
    console.error('Error accepting offer:', error);
    res.status(500).json({ error: 'Failed to accept offer' });
  }
});

// PUT /offers/:id/decline - Farmer declines offer (verify farmer owns listing)
router.put('/:id/decline', requireAuth, requireFarmer, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as AuthenticatedRequest).user.userId;

    // Fetch the offer and verify the farmer owns the listing
    const existingOffer = await prisma.transaction.findUnique({
      where: { id },
      include: { listing: { select: { farmerId: true } } },
    });

    if (!existingOffer) {
      return res.status(404).json({ error: 'Offer not found' });
    }

    if (existingOffer.listing.farmerId !== userId) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You do not own the listing for this offer.' },
      });
    }

    const offer = await prisma.transaction.update({
      where: { id },
      data: { status: 'CANCELLED' },
      include: { listing: true },
    });

    // Restore listing to active if it was reserved
    if (offer.listing.status === 'RESERVED') {
      await prisma.produceListing.update({
        where: { id: offer.listingId },
        data: { status: 'ACTIVE' },
      });
    }

    res.json({
      success: true,
      message: 'Offer declined',
    });
  } catch (error) {
    console.error('Error declining offer:', error);
    res.status(500).json({ error: 'Failed to decline offer' });
  }
});

// PUT /offers/:id/pay - Mark as paid (buyer only, verify buyer owns transaction)
router.put('/:id/pay', requireAuth, requireBuyer, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as AuthenticatedRequest).user.userId;
    const { paymentRef, paymentMethod = 'MPESA' } = req.body;

    // Verify buyer owns this transaction
    const existingOffer = await prisma.transaction.findUnique({
      where: { id },
    });

    if (!existingOffer) {
      return res.status(404).json({ error: 'Offer not found' });
    }

    if (existingOffer.buyerId !== userId) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You are not the buyer for this transaction.' },
      });
    }

    const offer = await prisma.transaction.update({
      where: { id },
      data: {
        status: 'PAID',
        paymentMethod,
        paymentRef,
        paidAt: new Date(),
      },
    });

    res.json({
      success: true,
      message: 'Payment confirmed - funds held in escrow',
      offer: {
        id: offer.id,
        status: offer.status,
        paymentRef: offer.paymentRef,
      },
    });
  } catch (error) {
    console.error('Error processing payment:', error);
    res.status(500).json({ error: 'Failed to process payment' });
  }
});

// PUT /offers/:id/deliver - Mark as delivered (farmer or transporter, verify party)
router.put('/:id/deliver', requireAuth, requireRole('FARMER', 'TRANSPORTER'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as AuthenticatedRequest).user.userId;

    // Verify user is a party to this transaction
    const existingOffer = await prisma.transaction.findUnique({
      where: { id },
      include: { listing: { select: { farmerId: true } } },
    });

    if (!existingOffer) {
      return res.status(404).json({ error: 'Offer not found' });
    }

    const isFarmer = existingOffer.listing.farmerId === userId;
    const isTransporter = existingOffer.transporterId === userId;

    if (!isFarmer && !isTransporter) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You are not authorized to mark this as delivered.' },
      });
    }

    const offer = await prisma.transaction.update({
      where: { id },
      data: {
        status: 'DELIVERED',
        deliveredAt: new Date(),
      },
      include: { listing: true },
    });

    res.json({
      success: true,
      message: 'Marked as delivered',
    });
  } catch (error) {
    console.error('Error marking delivery:', error);
    res.status(500).json({ error: 'Failed to mark delivery' });
  }
});

// PUT /offers/:id/complete - Buyer confirms receipt (verify buyer owns transaction)
router.put('/:id/complete', requireAuth, requireBuyer, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as AuthenticatedRequest).user.userId;
    const { rating, review } = req.body;

    // Verify buyer owns this transaction
    const existingOffer = await prisma.transaction.findUnique({
      where: { id },
    });

    if (!existingOffer) {
      return res.status(404).json({ error: 'Offer not found' });
    }

    if (existingOffer.buyerId !== userId) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You are not the buyer for this transaction.' },
      });
    }

    const offer = await prisma.transaction.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
      include: { listing: true },
    });

    // Update listing as sold
    await prisma.produceListing.update({
      where: { id: offer.listingId },
      data: { status: 'SOLD' },
    });

    res.json({
      success: true,
      message: 'Transaction completed - escrow released to farmer',
    });
  } catch (error) {
    console.error('Error completing transaction:', error);
    res.status(500).json({ error: 'Failed to complete transaction' });
  }
});

// GET /offers/:id - Get single offer details (transaction party only)
router.get('/:id', requireAuth, requireTransactionParty, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const offer = await prisma.transaction.findUnique({
      where: { id },
      include: {
        listing: {
          include: {
            farmer: { select: { name: true, phone: true, county: true, rating: true } },
          },
        },
        buyer: { select: { name: true, phone: true, county: true } },
      },
    });

    if (!offer) {
      return res.status(404).json({ error: 'Offer not found' });
    }

    res.json({
      id: offer.id,
      listing: {
        id: offer.listing.id,
        crop: offer.listing.cropType,
        grade: offer.listing.qualityGrade,
        images: offer.listing.images,
      },
      quantity: offer.quantity,
      price: offer.agreedPrice,
      total: offer.quantity * offer.agreedPrice,
      status: offer.status,
      farmer: offer.listing.farmer,
      buyer: offer.buyer,
      paymentMethod: offer.paymentMethod,
      paymentRef: offer.paymentRef,
      paidAt: offer.paidAt,
      deliveredAt: offer.deliveredAt,
      completedAt: offer.completedAt,
      createdAt: offer.createdAt,
    });
  } catch (error) {
    console.error('Error fetching offer:', error);
    res.status(500).json({ error: 'Failed to fetch offer' });
  }
});

export default router;
