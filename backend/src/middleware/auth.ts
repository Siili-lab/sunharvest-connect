/**
 * Authentication Middleware
 *
 * JWT-based authentication for API endpoints.
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { config } from '../config';

const prisma = new PrismaClient();

// ===== Types =====

export interface JWTPayload {
  userId: string;
  role: 'FARMER' | 'BUYER' | 'TRANSPORTER' | 'ADMIN';
  iat?: number;
  exp?: number;
}

export interface AuthenticatedRequest extends Request {
  user: JWTPayload;
}

// ===== Configuration =====

const JWT_SECRET = config.jwtSecret;
const JWT_EXPIRES_IN = config.jwtExpiresIn;
const SALT_ROUNDS = 10;

// ===== Token Management =====

/**
 * Generate JWT token for user
 */
export function generateToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN as string,
  } as jwt.SignOptions);
}

/**
 * Verify and decode JWT token
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch (error) {
    return null;
  }
}

/**
 * Generate refresh token (longer lived)
 */
export function generateRefreshToken(userId: string): string {
  return jwt.sign({ userId, type: 'refresh' }, JWT_SECRET, {
    expiresIn: '30d',
  });
}

// ===== Password/PIN Hashing =====

/**
 * Hash a PIN for storage
 */
export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, SALT_ROUNDS);
}

/**
 * Verify PIN against hash
 */
export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pin, hash);
}

// ===== Middleware =====

/**
 * Require authentication - extracts user from JWT
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required. Please provide a valid token.',
      },
    });
    return;
  }

  const token = authHeader.split(' ')[1];
  const payload = verifyToken(token);

  if (!payload) {
    res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid or expired token. Please log in again.',
      },
    });
    return;
  }

  // Check if account is still active
  try {
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { isActive: true },
    });
    if (!user || !user.isActive) {
      res.status(403).json({
        success: false,
        error: {
          code: 'ACCOUNT_DISABLED',
          message: 'Account is disabled or deleted.',
        },
      });
      return;
    }
  } catch {
    // If DB check fails, allow through (don't break auth on DB issues)
  }

  // Attach user to request
  (req as AuthenticatedRequest).user = payload;
  next();
}

/**
 * Optional authentication - doesn't fail if no token
 */
export function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    const payload = verifyToken(token);

    if (payload) {
      (req as AuthenticatedRequest).user = payload;
    }
  }

  next();
}

/**
 * Require specific role(s)
 */
export function requireRole(...roles: JWTPayload['role'][]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as AuthenticatedRequest).user;

    if (!user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required.',
        },
      });
      return;
    }

    if (!roles.includes(user.role)) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to access this resource.',
        },
      });
      return;
    }

    next();
  };
}

/**
 * Require admin role
 */
export const requireAdmin = requireRole('ADMIN');

/**
 * Require farmer role
 */
export const requireFarmer = requireRole('FARMER');

/**
 * Require buyer role
 */
export const requireBuyer = requireRole('BUYER');

// ===== Validation Schemas =====

export const loginSchema = z.object({
  phone: z.string().min(9).max(15),
  pin: z.string().length(4),
});

export const registerSchema = z.object({
  phone: z.string().min(9).max(15),
  pin: z.string().length(4),
  name: z.string().min(2).max(100),
  role: z.enum(['FARMER', 'BUYER', 'TRANSPORTER']),
  language: z.enum(['EN', 'SW']).optional().default('EN'),
  county: z.string().optional(),
});
