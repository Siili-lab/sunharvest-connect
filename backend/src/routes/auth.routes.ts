import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { hashPin, verifyPin, generateToken } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// Account lockout: track failed login attempts per phone number
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 30 * 60 * 1000; // 30 minutes
const loginAttempts = new Map<string, { count: number; lockedUntil: number | null }>();

function checkAccountLock(phone: string): { locked: boolean; minutesRemaining?: number } {
  const entry = loginAttempts.get(phone);
  if (!entry) return { locked: false };

  if (entry.lockedUntil && Date.now() < entry.lockedUntil) {
    const minutesRemaining = Math.ceil((entry.lockedUntil - Date.now()) / 60000);
    return { locked: true, minutesRemaining };
  }

  // Lockout expired — reset
  if (entry.lockedUntil && Date.now() >= entry.lockedUntil) {
    loginAttempts.delete(phone);
    return { locked: false };
  }

  return { locked: false };
}

function recordFailedAttempt(phone: string): { locked: boolean; attemptsRemaining: number } {
  const entry = loginAttempts.get(phone) || { count: 0, lockedUntil: null };
  entry.count += 1;

  if (entry.count >= MAX_LOGIN_ATTEMPTS) {
    entry.lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
    loginAttempts.set(phone, entry);
    return { locked: true, attemptsRemaining: 0 };
  }

  loginAttempts.set(phone, entry);
  return { locked: false, attemptsRemaining: MAX_LOGIN_ATTEMPTS - entry.count };
}

function clearFailedAttempts(phone: string): void {
  loginAttempts.delete(phone);
}

const registerSchema = z.object({
  phone: z.string().min(10).max(15),
  name: z.string().min(2).max(100),
  pin: z.string().length(4),
  userType: z.enum(['farmer', 'buyer', 'transporter']),
  location: z.string().optional(),
  consentGiven: z.boolean().optional(),
});

const loginSchema = z.object({
  phone: z.string().min(10),
  pin: z.string().length(4),
});

// POST /api/v1/auth/register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const data = registerSchema.parse(req.body);

    // Check if user already exists
    const existing = await prisma.user.findUnique({
      where: { phone: data.phone },
    });

    if (existing) {
      res.status(409).json({
        success: false,
        error: { code: 'USER_EXISTS', message: 'Phone number already registered' },
      });
      return;
    }

    // Hash PIN
    const hashedPin = await hashPin(data.pin);

    // Map userType to role enum
    const roleMap: Record<string, 'FARMER' | 'BUYER' | 'TRANSPORTER'> = {
      farmer: 'FARMER',
      buyer: 'BUYER',
      transporter: 'TRANSPORTER',
    };

    // Create user
    const user = await prisma.user.create({
      data: {
        phone: data.phone,
        name: data.name,
        pin: hashedPin,
        role: roleMap[data.userType],
        county: data.location,
        consentGivenAt: data.consentGiven ? new Date() : null,
        consentVersion: data.consentGiven ? '1.0' : null,
      },
    });

    // Generate token
    const token = generateToken({
      userId: user.id,
      role: user.role,
    });

    res.status(201).json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          name: user.name,
          phone: user.phone,
          userType: data.userType,
          location: user.county || '',
          createdAt: user.createdAt.toISOString(),
        },
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: err.errors[0].message },
      });
      return;
    }
    console.error('Register error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Registration failed' },
    });
  }
});

// POST /api/v1/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const data = loginSchema.parse(req.body);

    // Check account lockout BEFORE any database queries
    const lockStatus = checkAccountLock(data.phone);
    if (lockStatus.locked) {
      res.status(423).json({
        success: false,
        error: {
          code: 'ACCOUNT_LOCKED',
          message: `Account temporarily locked due to too many failed attempts. Try again in ${lockStatus.minutesRemaining} minutes.`,
        },
      });
      return;
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { phone: data.phone },
    });

    if (!user) {
      // Record failed attempt even for non-existent users (prevent enumeration)
      recordFailedAttempt(data.phone);
      res.status(401).json({
        success: false,
        error: { code: 'AUTH_FAILED', message: 'Invalid phone or PIN' },
      });
      return;
    }

    // Verify PIN
    const valid = await verifyPin(data.pin, user.pin);
    if (!valid) {
      const result = recordFailedAttempt(data.phone);
      const message = result.locked
        ? 'Account locked due to too many failed attempts. Try again in 30 minutes.'
        : `Invalid phone or PIN. ${result.attemptsRemaining} attempts remaining.`;
      res.status(result.locked ? 423 : 401).json({
        success: false,
        error: { code: result.locked ? 'ACCOUNT_LOCKED' : 'AUTH_FAILED', message },
      });
      return;
    }

    // Successful login — clear any failed attempts
    clearFailedAttempts(data.phone);

    // Check if account is active
    if (!user.isActive) {
      res.status(403).json({
        success: false,
        error: { code: 'ACCOUNT_DISABLED', message: 'Account is disabled' },
      });
      return;
    }

    // Generate token
    const token = generateToken({
      userId: user.id,
      role: user.role,
    });

    // Map role back to userType
    const userTypeMap: Record<string, string> = {
      FARMER: 'farmer',
      BUYER: 'buyer',
      TRANSPORTER: 'transporter',
      ADMIN: 'admin',
    };

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          name: user.name,
          phone: user.phone,
          userType: userTypeMap[user.role],
          location: user.county || '',
          createdAt: user.createdAt.toISOString(),
        },
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: err.errors[0].message },
      });
      return;
    }
    console.error('Login error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Login failed' },
    });
  }
});

// GET /api/v1/auth/me - Get current user
router.get('/me', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'No token provided' },
    });
    return;
  }

  const token = authHeader.split(' ')[1];
  const { verifyToken } = await import('../middleware/auth');
  const payload = verifyToken(token);

  if (!payload) {
    res.status(401).json({
      success: false,
      error: { code: 'INVALID_TOKEN', message: 'Invalid or expired token' },
    });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
  });

  if (!user) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'User not found' },
    });
    return;
  }

  const userTypeMap: Record<string, string> = {
    FARMER: 'farmer',
    BUYER: 'buyer',
    TRANSPORTER: 'transporter',
    ADMIN: 'admin',
  };

  res.json({
    success: true,
    data: {
      id: user.id,
      name: user.name,
      phone: user.phone,
      userType: userTypeMap[user.role],
      location: user.county || '',
      createdAt: user.createdAt.toISOString(),
    },
  });
});

export { router as authRouter };
