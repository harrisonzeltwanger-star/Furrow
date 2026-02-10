import { Router, Response } from 'express';
import { z } from 'zod';
import path from 'path';
import multer from 'multer';
import { Prisma } from '@prisma/client';
import prisma from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/permissions';

// Multer config for file uploads
const storage = multer.diskStorage({
  destination: path.join(__dirname, '../../uploads'),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${unique}${ext}`);
  },
});

const photoUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

const docUpload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and image files are allowed'));
    }
  },
});

const router = Router();

router.use(authenticate);

const createSchema = z.object({
  farmLocationId: z.string().uuid(),
  productType: z.string().optional(),
  pricePerTon: z.number().positive(),
  estimatedTons: z.number().positive().optional(),
  baleCount: z.number().int().positive().optional(),
  moisturePercent: z.number().min(0).max(100).optional(),
  notes: z.string().optional(),
  firmPrice: z.boolean().optional(),
  isDeliveredPrice: z.boolean().optional(),
  truckingCoordinatedBy: z.string().optional(),
});

const STACK_ID_START = 100001;

async function generateStackId(): Promise<string> {
  const last = await prisma.listing.findFirst({
    orderBy: { stackId: 'desc' },
    select: { stackId: true },
  });
  if (!last) return String(STACK_ID_START);
  const lastNum = parseInt(last.stackId, 10);
  return String(isNaN(lastNum) ? STACK_ID_START : lastNum + 1);
}

const updateSchema = z.object({
  productType: z.string().optional(),
  pricePerTon: z.number().positive().optional(),
  estimatedTons: z.number().positive().optional(),
  baleCount: z.number().int().positive().optional(),
  moisturePercent: z.number().min(0).max(100).optional(),
  status: z.enum(['available', 'under_contract', 'depleted']).optional(),
  notes: z.string().optional(),
  firmPrice: z.boolean().optional(),
  isDeliveredPrice: z.boolean().optional(),
  truckingCoordinatedBy: z.string().optional(),
});

function qstr(val: unknown): string | undefined {
  if (typeof val === 'string') return val;
  return undefined;
}

// GET /listings - list listings with filters
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const status = qstr(req.query.status);
    const productType = qstr(req.query.productType);
    const minPrice = qstr(req.query.minPrice);
    const maxPrice = qstr(req.query.maxPrice);
    const organizationId = qstr(req.query.organizationId);
    const page = qstr(req.query.page) || '1';
    const limit = qstr(req.query.limit) || '20';

    const where: Prisma.ListingWhereInput = {};

    if (organizationId) where.organizationId = organizationId;
    if (status) where.status = status;
    if (productType) where.productType = productType;
    if (minPrice || maxPrice) {
      where.pricePerTon = {
        ...(minPrice ? { gte: parseFloat(minPrice) } : {}),
        ...(maxPrice ? { lte: parseFloat(maxPrice) } : {}),
      };
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [listings, totalItems] = await Promise.all([
      prisma.listing.findMany({
        where,
        include: {
          farmLocation: true,
          organization: { select: { id: true, name: true, type: true } },
          photos: true,
          documents: true,
          _count: { select: { loads: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.listing.count({ where }),
    ]);

    res.json({
      listings,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(totalItems / limitNum),
        totalItems,
      },
    });
  } catch (error) {
    console.error('List listings error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to list listings' } });
  }
});

// GET /listings/:id - get listing detail
router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const listing = await prisma.listing.findUnique({
      where: { id: req.params.id as string },
      include: {
        farmLocation: true,
        organization: { select: { id: true, name: true, type: true } },
        photos: true,
        documents: true,
        poStacks: { include: { po: { select: { id: true, poNumber: true, status: true } } } },
      },
    });

    if (!listing) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Listing not found' } });
      return;
    }

    res.json(listing);
  } catch (error) {
    console.error('Get listing error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to get listing' } });
  }
});

// POST /listings - create listing (FARM_ADMIN or MANAGER)
router.post('/', requireRole('FARM_ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = createSchema.parse(req.body);

    const farmLocation = await prisma.farmLocation.findFirst({
      where: { id: data.farmLocationId, organizationId: req.user!.organizationId },
    });

    if (!farmLocation) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Farm location not found in your organization' } });
      return;
    }

    const stackId = await generateStackId();

    const listing = await prisma.listing.create({
      data: {
        ...data,
        stackId,
        organizationId: req.user!.organizationId,
      },
      include: {
        farmLocation: true,
        organization: { select: { id: true, name: true, type: true } },
      },
    });

    res.status(201).json(listing);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: error.errors } });
      return;
    }
    console.error('Create listing error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to create listing' } });
  }
});

// PATCH /listings/:id - update listing
router.patch('/:id', requireRole('FARM_ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = updateSchema.parse(req.body);

    const existing = await prisma.listing.findFirst({
      where: { id: req.params.id as string, organizationId: req.user!.organizationId },
    });

    if (!existing) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Listing not found' } });
      return;
    }

    const listing = await prisma.listing.update({
      where: { id: req.params.id as string },
      data,
      include: {
        farmLocation: true,
        organization: { select: { id: true, name: true, type: true } },
      },
    });

    res.json(listing);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: error.errors } });
      return;
    }
    console.error('Update listing error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to update listing' } });
  }
});

// POST /listings/:id/photos - upload photos
router.post('/:id/photos', requireRole('FARM_ADMIN', 'MANAGER'), photoUpload.array('photos', 10), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const listing = await prisma.listing.findFirst({
      where: { id: req.params.id as string, organizationId: req.user!.organizationId },
    });
    if (!listing) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Listing not found' } });
      return;
    }

    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      res.status(400).json({ error: { code: 'NO_FILES', message: 'No photo files provided' } });
      return;
    }

    const photos = await Promise.all(
      files.map((file) =>
        prisma.listingPhoto.create({
          data: {
            listingId: listing.id,
            fileUrl: `/uploads/${file.filename}`,
          },
        })
      )
    );

    res.status(201).json({ photos });
  } catch (error) {
    console.error('Upload photos error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to upload photos' } });
  }
});

// POST /listings/:id/documents - upload documents (PDFs)
router.post('/:id/documents', requireRole('FARM_ADMIN', 'MANAGER'), docUpload.array('documents', 5), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const listing = await prisma.listing.findFirst({
      where: { id: req.params.id as string, organizationId: req.user!.organizationId },
    });
    if (!listing) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Listing not found' } });
      return;
    }

    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      res.status(400).json({ error: { code: 'NO_FILES', message: 'No document files provided' } });
      return;
    }

    const documents = await Promise.all(
      files.map((file) =>
        prisma.listingDocument.create({
          data: {
            listingId: listing.id,
            documentType: file.mimetype === 'application/pdf' ? 'PDF' : 'IMAGE',
            fileUrl: `/uploads/${file.filename}`,
          },
        })
      )
    );

    res.status(201).json({ documents });
  } catch (error) {
    console.error('Upload documents error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to upload documents' } });
  }
});

export default router;
