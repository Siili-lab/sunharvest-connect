/**
 * Ownership Middleware
 *
 * Reusable middleware for verifying resource ownership.
 */

import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from './auth';

const prisma = new PrismaClient();

/**
 * Verify the authenticated user matches the given route param, or is an ADMIN.
 */
export function requireSelfOrAdmin(paramName: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as AuthenticatedRequest).user;

    if (!user) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required.' },
      });
      return;
    }

    const paramValue = req.params[paramName];

    if (user.userId !== paramValue && user.role !== 'ADMIN') {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You can only access your own resources.' },
      });
      return;
    }

    next();
  };
}

/**
 * Verify the authenticated user owns the listing identified by req.params.id.
 * Attaches the listing to req.listing for downstream use.
 */
export async function requireListingOwnership(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const user = (req as AuthenticatedRequest).user;

  if (!user) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication required.' },
    });
    return;
  }

  const listingId = req.params.id;

  const listing = await prisma.produceListing.findUnique({
    where: { id: listingId },
  });

  if (!listing) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Listing not found.' },
    });
    return;
  }

  if (listing.farmerId !== user.userId && user.role !== 'ADMIN') {
    res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'You do not own this listing.' },
    });
    return;
  }

  (req as any).listing = listing;
  next();
}

/**
 * Verify the authenticated user is a party to the transaction (buyer, farmer, or transporter).
 * Works with req.params.id or req.params.transactionId.
 * Attaches the transaction to req.transaction for downstream use.
 */
export async function requireTransactionParty(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const user = (req as AuthenticatedRequest).user;

  if (!user) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication required.' },
    });
    return;
  }

  const transactionId = req.params.id || req.params.transactionId;

  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: {
      listing: { select: { farmerId: true } },
    },
  });

  if (!transaction) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Transaction not found.' },
    });
    return;
  }

  const isBuyer = transaction.buyerId === user.userId;
  const isFarmer = transaction.listing.farmerId === user.userId;
  const isTransporter = transaction.transporterId === user.userId;
  const isAdmin = user.role === 'ADMIN';

  if (!isBuyer && !isFarmer && !isTransporter && !isAdmin) {
    res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'You are not a party to this transaction.' },
    });
    return;
  }

  (req as any).transaction = transaction;
  next();
}
