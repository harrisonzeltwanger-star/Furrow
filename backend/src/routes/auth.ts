import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import prisma from '../config/database';
import { config } from '../config/env';
import { authenticate, AuthRequest } from '../middleware/auth';
import { sendPasswordResetEmail } from '../services/emailService';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

const router = Router();

// Validation schemas
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  phone: z.string().optional(),
  organizationName: z.string().min(1),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

function generateTokens(payload: { userId: string; email: string; role: string; organizationId: string }) {
  const token = jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
  const refreshToken = jwt.sign(payload, config.jwtRefreshSecret, { expiresIn: config.jwtRefreshExpiresIn });
  return { token, refreshToken };
}

function userResponse(user: { id: string; email: string; name: string; phone?: string | null; role: string; organizationId: string; lastLogin?: Date | null; organization: { name: string; address?: string | null; latitude?: number | null; longitude?: number | null } }) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    ...(user.phone !== undefined && { phone: user.phone }),
    role: user.role,
    organizationId: user.organizationId,
    organizationName: user.organization.name,
    organizationAddress: user.organization.address ?? null,
    organizationLatitude: user.organization.latitude ?? null,
    organizationLongitude: user.organization.longitude ?? null,
    ...(user.lastLogin !== undefined && { lastLogin: user.lastLogin }),
  };
}

// POST /auth/register
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const data = registerSchema.parse(req.body);

    // Check if email already exists
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      res.status(409).json({
        error: { code: 'CONFLICT', message: 'Email already registered' },
      });
      return;
    }

    const passwordHash = await bcrypt.hash(data.password, 12);

    // Create organization and user in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: data.organizationName,
        },
      });

      const user = await tx.user.create({
        data: {
          email: data.email,
          passwordHash,
          name: data.name,
          phone: data.phone,
          organizationId: org.id,
          role: 'FARM_ADMIN',
        },
      });

      return { org, user };
    });

    const tokens = generateTokens({
      userId: result.user.id,
      email: result.user.email,
      role: result.user.role,
      organizationId: result.user.organizationId,
    });

    res.status(201).json({
      ...tokens,
      user: userResponse({ ...result.user, organization: result.org }),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input',
          details: error.errors,
        },
      });
      return;
    }
    console.error('Register error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Registration failed' },
    });
  }
});

// POST /auth/login
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const data = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email: data.email },
      include: { organization: true },
    });

    if (!user || !user.isActive) {
      res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Invalid email or password' },
      });
      return;
    }

    const validPassword = await bcrypt.compare(data.password, user.passwordHash);
    if (!validPassword) {
      res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Invalid email or password' },
      });
      return;
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    const tokens = generateTokens({
      userId: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
    });

    res.json({
      ...tokens,
      user: userResponse(user),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input',
          details: error.errors,
        },
      });
      return;
    }
    console.error('Login error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Login failed' },
    });
  }
});

// POST /auth/refresh
router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Refresh token required' },
      });
      return;
    }

    const payload = jwt.verify(refreshToken, config.jwtRefreshSecret) as {
      userId: string;
      email: string;
      role: string;
      organizationId: string;
    };

    // Verify user still exists and is active
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: { organization: true },
    });

    if (!user || !user.isActive) {
      res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'User no longer active' },
      });
      return;
    }

    const tokens = generateTokens({
      userId: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
    });

    res.json({
      ...tokens,
      user: userResponse(user),
    });
  } catch {
    res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Invalid refresh token' },
    });
  }
});

// GET /auth/me - Get current user info
router.get('/me', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: { organization: true },
    });

    if (!user) {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'User not found' },
      });
      return;
    }

    res.json({
      user: userResponse(user),
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch user' },
    });
  }
});

// POST /auth/forgot-password
const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

router.post('/forgot-password', async (req: Request, res: Response): Promise<void> => {
  try {
    const data = forgotPasswordSchema.parse(req.body);

    // Always return success to avoid leaking whether the email exists
    const user = await prisma.user.findUnique({ where: { email: data.email } });

    if (user && user.isActive) {
      const resetRecord = await prisma.passwordReset.create({
        data: {
          email: data.email,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
        },
      });

      await sendPasswordResetEmail({
        recipientEmail: data.email,
        resetLink: `${FRONTEND_URL}/reset-password?token=${resetRecord.token}`,
      });
    }

    res.json({ message: 'If an account with that email exists, a password reset link has been sent.' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input',
          details: error.errors,
        },
      });
      return;
    }
    console.error('Forgot password error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to process request' },
    });
  }
});

// POST /auth/reset-password
const resetPasswordSchema = z.object({
  token: z.string().uuid(),
  password: z.string().min(8),
});

router.post('/reset-password', async (req: Request, res: Response): Promise<void> => {
  try {
    const data = resetPasswordSchema.parse(req.body);

    const resetRecord = await prisma.passwordReset.findUnique({
      where: { token: data.token },
    });

    if (!resetRecord || resetRecord.used || resetRecord.expiresAt < new Date()) {
      res.status(400).json({
        error: { code: 'INVALID_TOKEN', message: 'This reset link is invalid or has expired.' },
      });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email: resetRecord.email } });

    if (!user) {
      res.status(400).json({
        error: { code: 'INVALID_TOKEN', message: 'This reset link is invalid or has expired.' },
      });
      return;
    }

    const passwordHash = await bcrypt.hash(data.password, 12);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      }),
      prisma.passwordReset.update({
        where: { id: resetRecord.id },
        data: { used: true },
      }),
    ]);

    res.json({ message: 'Password has been reset successfully.' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input',
          details: error.errors,
        },
      });
      return;
    }
    console.error('Reset password error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to reset password' },
    });
  }
});

export default router;
