/**
 * M-Pesa Routes — STK Push + Callback
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { initiateSTKPush, querySTKStatus } from '../services/mpesaService';
import { notifyUser } from '../services/notificationService';

const router = Router();
const prisma = new PrismaClient();

// Validation
const stkPushSchema = z.object({
  transactionId: z.string().uuid(),
  phone: z.string().min(9).max(15),
});

// POST /mpesa/stkpush — Initiate STK Push for a transaction
router.post('/stkpush', requireAuth, async (req: Request, res: Response) => {
  try {
    const parsed = stkPushSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message },
      });
    }

    const { transactionId, phone } = parsed.data;
    const userId = (req as AuthenticatedRequest).user.userId;

    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { listing: { select: { cropType: true, farmerId: true } } },
    });

    if (!transaction) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Transaction not found' } });
    }

    if (transaction.buyerId !== userId) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'You are not the buyer for this transaction' } });
    }

    if (transaction.status !== 'ACCEPTED') {
      return res.status(400).json({ success: false, error: { code: 'INVALID_STATUS', message: `Transaction status is ${transaction.status}, expected ACCEPTED` } });
    }

    const stkResponse = await initiateSTKPush({
      phone,
      amount: transaction.agreedPrice * transaction.quantity,
      accountRef: `SH-${transactionId.slice(0, 8)}`,
      description: `Payment for ${transaction.listing.cropType}`,
    });

    if (stkResponse.ResponseCode !== '0') {
      return res.status(400).json({
        success: false,
        error: { code: 'STK_FAILED', message: stkResponse.ResponseDescription },
      });
    }

    // Update transaction with checkout request ID and set status to PAYMENT_PENDING
    await prisma.transaction.update({
      where: { id: transactionId },
      data: {
        status: 'PAYMENT_PENDING',
        checkoutRequestId: stkResponse.CheckoutRequestID,
        paymentMethod: 'MPESA',
      },
    });

    res.json({
      success: true,
      data: {
        checkoutRequestId: stkResponse.CheckoutRequestID,
        customerMessage: stkResponse.CustomerMessage,
      },
    });
  } catch (error) {
    console.error('Error initiating STK push:', error);
    res.status(500).json({ success: false, error: { code: 'STK_ERROR', message: 'Failed to initiate M-Pesa payment' } });
  }
});

// POST /mpesa/callback — Safaricom callback (NO auth)
router.post('/callback', async (req: Request, res: Response) => {
  try {
    const { Body } = req.body;
    const { stkCallback } = Body;
    const { ResultCode, CheckoutRequestID, CallbackMetadata } = stkCallback;

    const transaction = await prisma.transaction.findFirst({
      where: { checkoutRequestId: CheckoutRequestID },
      include: {
        listing: { select: { cropType: true, farmerId: true } },
        buyer: { select: { name: true } },
      },
    });

    if (!transaction) {
      // Respond OK to Safaricom even if we can't find the transaction
      return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }

    if (ResultCode === 0) {
      // Payment successful
      let mpesaReceiptNumber: string | undefined;
      if (CallbackMetadata?.Item) {
        const receipt = CallbackMetadata.Item.find(
          (item: any) => item.Name === 'MpesaReceiptNumber'
        );
        if (receipt) mpesaReceiptNumber = receipt.Value;
      }

      await prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          status: 'PAID',
          paymentRef: mpesaReceiptNumber || `MPESA-${CheckoutRequestID}`,
          paidAt: new Date(),
        },
      });

      // Notify farmer: payment received
      await notifyUser(
        transaction.listing.farmerId,
        'payment_confirmed',
        'Payment Received',
        `Payment received for ${transaction.listing.cropType} from ${transaction.buyer.name}`,
        { transactionId: transaction.id }
      );

      // Notify buyer: payment confirmed
      await notifyUser(
        transaction.buyerId,
        'payment_confirmed',
        'Payment Confirmed',
        `Your M-Pesa payment for ${transaction.listing.cropType} has been confirmed`,
        { transactionId: transaction.id, mpesaReceiptNumber }
      );
    } else {
      // Payment failed — revert to ACCEPTED
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          status: 'ACCEPTED',
          checkoutRequestId: null,
        },
      });

      // Notify buyer: payment failed
      await notifyUser(
        transaction.buyerId,
        'payment_failed',
        'Payment Failed',
        `M-Pesa payment for ${transaction.listing.cropType} failed. Please try again.`,
        { transactionId: transaction.id }
      );
    }

    // Always respond OK to Safaricom
    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (error) {
    console.error('Error processing M-Pesa callback:', error);
    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  }
});

// GET /mpesa/status/:checkoutRequestId — Poll payment status
router.get('/status/:checkoutRequestId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { checkoutRequestId } = req.params;

    // First check our database
    const transaction = await prisma.transaction.findFirst({
      where: { checkoutRequestId },
      select: { id: true, status: true, paymentRef: true, paidAt: true },
    });

    if (!transaction) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Transaction not found' } });
    }

    // If already updated via callback, return immediately
    if (transaction.status === 'PAID' || transaction.status === 'ACCEPTED') {
      return res.json({
        success: true,
        data: {
          status: transaction.status,
          paymentRef: transaction.paymentRef,
          paidAt: transaction.paidAt,
        },
      });
    }

    // Otherwise query Safaricom
    try {
      const stkStatus = await querySTKStatus(checkoutRequestId);
      return res.json({
        success: true,
        data: {
          status: transaction.status,
          stkResultCode: stkStatus.ResultCode,
          stkResultDesc: stkStatus.ResultDesc,
        },
      });
    } catch {
      // If query fails, return current DB status
      return res.json({
        success: true,
        data: { status: transaction.status },
      });
    }
  } catch (error) {
    console.error('Error checking payment status:', error);
    res.status(500).json({ success: false, error: { code: 'STATUS_ERROR', message: 'Failed to check payment status' } });
  }
});

export { router as mpesaRouter };
