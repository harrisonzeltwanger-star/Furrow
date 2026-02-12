import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth';
import { parsePagination, paginationMeta } from '../utils/pagination';

const router = Router();

// All routes require authentication
router.use(authenticate);

const createSchema = z.object({
  name: z.string().min(1),
  address: z.string().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

// GET /farm-locations - list farm locations for current org
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const where = { organizationId: req.user!.organizationId };

    const [locations, totalItems] = await Promise.all([
      prisma.farmLocation.findMany({
        where,
        include: {
          _count: { select: { listings: true } },
        },
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
      prisma.farmLocation.count({ where }),
    ]);

    res.json({ farmLocations: locations, pagination: paginationMeta(page, limit, totalItems) });
  } catch (error) {
    console.error('List farm locations error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to list farm locations' } });
  }
});

// POST /farm-locations - create farm location
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = createSchema.parse(req.body);

    const location = await prisma.farmLocation.create({
      data: {
        ...data,
        organizationId: req.user!.organizationId,
      },
    });

    res.status(201).json(location);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: error.errors } });
      return;
    }
    console.error('Create farm location error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to create farm location' } });
  }
});

export default router;
