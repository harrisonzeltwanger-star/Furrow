import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import prisma from '../config/database';
import { config } from '../config/env';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/permissions';
import { parsePagination, paginationMeta } from '../utils/pagination';
import { sendInviteEmail } from '../services/emailService';

const router = Router();

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// --- Validation Schemas ---

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['FARM_ADMIN', 'MANAGER', 'VIEWER']),
  type: z.enum(['admin', 'team']),
});

const acceptInviteTeamSchema = z.object({
  token: z.string().uuid(),
  name: z.string().min(1),
  password: z.string().min(8),
  phone: z.string().optional(),
});

const acceptInviteAdminSchema = acceptInviteTeamSchema.extend({
  orgName: z.string().min(1),
});

function generateTokens(payload: { userId: string; email: string; role: string; organizationId: string }) {
  const token = jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
  const refreshToken = jwt.sign(payload, config.jwtRefreshSecret, { expiresIn: config.jwtRefreshExpiresIn });
  return { token, refreshToken };
}

// GET /users/team — List users in caller's org
router.get('/team', authenticate, requireRole('FARM_ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const where = { organizationId: req.user!.organizationId };

    const [users, totalItems] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          lastLogin: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    res.json({ users, pagination: paginationMeta(page, limit, totalItems) });
  } catch (error) {
    console.error('List team error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to list team' } });
  }
});

// GET /users/invites — List pending invites (FARM_ADMIN only)
router.get('/invites', authenticate, requireRole('FARM_ADMIN'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const where = {
      invitedById: req.user!.userId,
      status: 'pending',
    };

    const [invites, totalItems] = await Promise.all([
      prisma.invite.findMany({
        where,
        select: {
          id: true,
          email: true,
          role: true,
          type: true,
          expiresAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.invite.count({ where }),
    ]);

    res.json({ invites, pagination: paginationMeta(page, limit, totalItems) });
  } catch (error) {
    console.error('List invites error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to list invites' } });
  }
});

// POST /users/invite — Create invite (FARM_ADMIN only)
router.post('/invite', authenticate, requireRole('FARM_ADMIN'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = inviteSchema.parse(req.body);

    // Validate type + role combo
    if (data.type === 'admin' && data.role !== 'FARM_ADMIN') {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Admin invites must use FARM_ADMIN role' },
      });
      return;
    }

    if (data.type === 'team' && data.role === 'FARM_ADMIN') {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Team invites cannot use FARM_ADMIN role' },
      });
      return;
    }

    // Check for existing pending invite with same email
    const existingInvite = await prisma.invite.findFirst({
      where: { email: data.email, status: 'pending' },
    });
    if (existingInvite) {
      res.status(409).json({
        error: { code: 'CONFLICT', message: 'A pending invite already exists for this email' },
      });
      return;
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email: data.email } });
    if (existingUser) {
      res.status(409).json({
        error: { code: 'CONFLICT', message: 'A user with this email already exists' },
      });
      return;
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const inviter = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: { organization: true },
    });

    const invite = await prisma.invite.create({
      data: {
        email: data.email,
        role: data.role,
        type: data.type,
        organizationId: data.type === 'team' ? req.user!.organizationId : null,
        invitedById: req.user!.userId,
        expiresAt,
      },
    });

    const acceptLink = `${FRONTEND_URL}/accept-invite?token=${invite.token}`;

    // Send invite email (non-blocking — don't fail the request if email fails)
    sendInviteEmail({
      recipientEmail: invite.email,
      inviterName: inviter?.name || 'A team member',
      organizationName: inviter?.organization?.name || 'an organization',
      role: invite.role,
      acceptLink,
    }).catch((err) => console.error('Failed to send invite email:', err));

    res.status(201).json({
      invite: {
        id: invite.id,
        email: invite.email,
        role: invite.role,
        type: invite.type,
        expiresAt: invite.expiresAt,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: error.errors },
      });
      return;
    }
    console.error('Create invite error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to create invite' } });
  }
});

// GET /users/invite/:token — Get invite details (PUBLIC)
router.get('/invite/:token', async (req: Request, res: Response): Promise<void> => {
  try {
    const invite = await prisma.invite.findUnique({
      where: { token: req.params.token as string },
      include: { organization: { select: { name: true } } },
    });

    if (!invite) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Invite not found' } });
      return;
    }

    if (invite.status !== 'pending') {
      res.status(400).json({ error: { code: 'INVALID', message: 'This invite has already been used' } });
      return;
    }

    if (new Date() > invite.expiresAt) {
      res.status(400).json({ error: { code: 'EXPIRED', message: 'This invite has expired' } });
      return;
    }

    res.json({
      invite: {
        email: invite.email,
        role: invite.role,
        type: invite.type,
        organizationName: invite.organization?.name ?? null,
      },
    });
  } catch (error) {
    console.error('Get invite error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to get invite' } });
  }
});

// POST /users/accept-invite — Accept invite (PUBLIC)
router.post('/accept-invite', async (req: Request, res: Response): Promise<void> => {
  try {
    const invite = await prisma.invite.findUnique({
      where: { token: req.body.token },
      include: { organization: true },
    });

    if (!invite) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Invite not found' } });
      return;
    }

    if (invite.status !== 'pending') {
      res.status(400).json({ error: { code: 'INVALID', message: 'This invite has already been used' } });
      return;
    }

    if (new Date() > invite.expiresAt) {
      await prisma.invite.update({ where: { id: invite.id }, data: { status: 'expired' } });
      res.status(400).json({ error: { code: 'EXPIRED', message: 'This invite has expired' } });
      return;
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email: invite.email } });
    if (existingUser) {
      res.status(409).json({ error: { code: 'CONFLICT', message: 'A user with this email already exists' } });
      return;
    }

    let data;
    if (invite.type === 'admin') {
      data = acceptInviteAdminSchema.parse(req.body);
    } else {
      data = acceptInviteTeamSchema.parse(req.body);
    }

    const passwordHash = await bcrypt.hash(data.password, 12);

    const result = await prisma.$transaction(async (tx) => {
      let org;

      if (invite.type === 'admin') {
        const adminData = data as z.infer<typeof acceptInviteAdminSchema>;
        org = await tx.organization.create({
          data: {
            name: adminData.orgName,
          },
        });
      } else {
        org = invite.organization!;
      }

      const user = await tx.user.create({
        data: {
          email: invite.email,
          passwordHash,
          name: data.name,
          phone: data.phone,
          organizationId: org.id,
          role: invite.role,
          createdById: invite.invitedById,
        },
      });

      await tx.invite.update({
        where: { id: invite.id },
        data: { status: 'accepted', acceptedAt: new Date() },
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
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        role: result.user.role,
        organizationId: result.user.organizationId,
        organizationName: result.org.name,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: error.errors },
      });
      return;
    }
    console.error('Accept invite error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to accept invite' } });
  }
});

// PATCH /users/:id/deactivate — Deactivate user (FARM_ADMIN only)
router.patch('/:id/deactivate', authenticate, requireRole('FARM_ADMIN'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.params.id as string;
    const targetUser = await prisma.user.findUnique({ where: { id: userId } });

    if (!targetUser) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found' } });
      return;
    }

    if (targetUser.organizationId !== req.user!.organizationId) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Cannot modify users in other organizations' } });
      return;
    }

    if (targetUser.id === req.user!.userId) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Cannot deactivate yourself' } });
      return;
    }

    if (targetUser.role === 'FARM_ADMIN') {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Cannot deactivate another FARM_ADMIN' } });
      return;
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
    });

    res.json({ user: { id: updated.id, isActive: updated.isActive } });
  } catch (error) {
    console.error('Deactivate user error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to deactivate user' } });
  }
});

// PATCH /users/:id/activate — Reactivate user (FARM_ADMIN only)
router.patch('/:id/activate', authenticate, requireRole('FARM_ADMIN'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.params.id as string;
    const targetUser = await prisma.user.findUnique({ where: { id: userId } });

    if (!targetUser) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found' } });
      return;
    }

    if (targetUser.organizationId !== req.user!.organizationId) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Cannot modify users in other organizations' } });
      return;
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { isActive: true },
    });

    res.json({ user: { id: updated.id, isActive: updated.isActive } });
  } catch (error) {
    console.error('Activate user error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to activate user' } });
  }
});

// DELETE /users/:id — Delete user from org (FARM_ADMIN only)
router.delete('/:id', authenticate, requireRole('FARM_ADMIN'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.params.id as string;
    const targetUser = await prisma.user.findUnique({ where: { id: userId } });

    if (!targetUser) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found' } });
      return;
    }

    if (targetUser.organizationId !== req.user!.organizationId) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Cannot delete users in other organizations' } });
      return;
    }

    if (targetUser.id === req.user!.userId) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Cannot delete yourself' } });
      return;
    }

    if (targetUser.role === 'FARM_ADMIN') {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Cannot delete another FARM_ADMIN' } });
      return;
    }

    await prisma.user.delete({ where: { id: userId } });

    res.json({ message: 'User deleted' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to delete user' } });
  }
});

// DELETE /users/invites/:id — Cancel a pending invite (FARM_ADMIN only)
router.delete('/invites/:id', authenticate, requireRole('FARM_ADMIN'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const inviteId = req.params.id as string;
    const invite = await prisma.invite.findUnique({ where: { id: inviteId } });

    if (!invite) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Invite not found' } });
      return;
    }

    if (invite.invitedById !== req.user!.userId) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You can only cancel your own invites' } });
      return;
    }

    if (invite.status !== 'pending') {
      res.status(400).json({ error: { code: 'INVALID', message: 'Can only cancel pending invites' } });
      return;
    }

    await prisma.invite.delete({ where: { id: inviteId } });

    res.json({ message: 'Invite cancelled' });
  } catch (error) {
    console.error('Cancel invite error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to cancel invite' } });
  }
});

// PATCH /users/organization/address - update org home address
const orgAddressSchema = z.object({
  address: z.string().min(1),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

router.patch('/organization/address', authenticate, requireRole('FARM_ADMIN'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = orgAddressSchema.parse(req.body);

    const org = await prisma.organization.update({
      where: { id: req.user!.organizationId },
      data: {
        address: data.address,
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
      },
    });

    res.json({
      address: org.address,
      latitude: org.latitude,
      longitude: org.longitude,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: error.errors } });
      return;
    }
    console.error('Update org address error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to update address' } });
  }
});

export default router;
