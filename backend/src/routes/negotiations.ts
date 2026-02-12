import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/permissions';
import { parsePagination, paginationMeta } from '../utils/pagination';

const router = Router();

router.use(authenticate);

// --- Validation schemas ---

const createOfferSchema = z.object({
  listingId: z.string().uuid(),
  offeredPricePerTon: z.number().positive(),
  offeredTons: z.number().positive().optional(),
  message: z.string().optional(),
});

const counterSchema = z.object({
  offeredPricePerTon: z.number().positive(),
  offeredTons: z.number().positive().optional(),
  message: z.string().optional(),
});

// --- Helpers ---

const PO_NUMBER_START = 10001;

async function generatePoNumber(): Promise<string> {
  const last = await prisma.purchaseOrder.findFirst({
    orderBy: { poNumber: 'desc' },
    select: { poNumber: true },
  });
  if (!last) return `PO-${PO_NUMBER_START}`;
  const num = parseInt(last.poNumber.replace('PO-', ''), 10);
  return `PO-${isNaN(num) ? PO_NUMBER_START : num + 1}`;
}

function qstr(val: unknown): string | undefined {
  if (typeof val === 'string') return val;
  return undefined;
}

// --- POST /negotiations — create initial offer (Buyer only) ---

router.post('/', requireRole('FARM_ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = createOfferSchema.parse(req.body);

    // Fetch listing to get grower org
    const listing = await prisma.listing.findUnique({
      where: { id: data.listingId },
      include: { organization: { select: { id: true, type: true } } },
    });

    if (!listing) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Listing not found' } });
      return;
    }

    if (listing.status !== 'available') {
      res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Listing is not available' } });
      return;
    }

    // Cannot make offer on own listing
    if (listing.organizationId === req.user!.organizationId) {
      res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Cannot make an offer on your own listing' } });
      return;
    }

    const negotiation = await prisma.negotiation.create({
      data: {
        listingId: data.listingId,
        buyerOrgId: req.user!.organizationId,
        growerOrgId: listing.organizationId,
        offeredPricePerTon: data.offeredPricePerTon,
        offeredTons: data.offeredTons,
        message: data.message,
        offeredByOrgId: req.user!.organizationId,
        offeredByUserId: req.user!.userId,
        status: 'pending',
      },
      include: {
        listing: { select: { id: true, stackId: true, pricePerTon: true, productType: true, baleType: true, isDeliveredPrice: true, truckingCoordinatedBy: true, farmLocation: { select: { name: true } } } },
        buyerOrg: { select: { id: true, name: true } },
        growerOrg: { select: { id: true, name: true } },
        offeredByUser: { select: { id: true, name: true } },
      },
    });

    res.status(201).json(negotiation);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: error.errors } });
      return;
    }
    console.error('Create negotiation error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to create offer' } });
  }
});

// --- GET /negotiations — list negotiations for caller's org ---

router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const status = qstr(req.query.status);
    const orgId = req.user!.organizationId;
    const { page, limit, skip } = parsePagination(req.query);

    const where: Record<string, unknown> = {
      OR: [{ buyerOrgId: orgId }, { growerOrgId: orgId }],
      parentId: null, // only root-level threads
    };

    if (status) {
      delete where.parentId;
      (where as Record<string, unknown>).AND = [
        { OR: [{ buyerOrgId: orgId }, { growerOrgId: orgId }] },
        {
          OR: [
            { parentId: null, status },
            { parentId: null, replies: { some: { status } } },
          ],
        },
      ];
      delete (where as Record<string, unknown>).OR;
    }

    const negotiationIncludes = {
      listing: {
        select: { id: true, stackId: true, pricePerTon: true, productType: true, baleType: true, estimatedTons: true, status: true, isDeliveredPrice: true, truckingCoordinatedBy: true, farmLocation: { select: { name: true } } },
      },
      buyerOrg: { select: { id: true, name: true } },
      growerOrg: { select: { id: true, name: true } },
      offeredByUser: { select: { id: true, name: true } },
      replies: {
        orderBy: { createdAt: 'desc' as const },
        take: 1,
        include: {
          offeredByUser: { select: { id: true, name: true } },
        },
      },
    };

    const [negotiations, totalItems] = await Promise.all([
      prisma.negotiation.findMany({
        where: where as any,
        include: negotiationIncludes,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.negotiation.count({ where: where as any }),
    ]);

    res.json({ negotiations, pagination: paginationMeta(page, limit, totalItems) });
  } catch (error) {
    console.error('List negotiations error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to list negotiations' } });
  }
});

// --- GET /negotiations/:id — get full thread ---

router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user!.organizationId;

    // Find the root negotiation
    const root = await prisma.negotiation.findUnique({
      where: { id: req.params.id as string },
      select: { id: true, buyerOrgId: true, growerOrgId: true, parentId: true },
    });

    if (!root) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Negotiation not found' } });
      return;
    }

    // Check access
    if (root.buyerOrgId !== orgId && root.growerOrgId !== orgId) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
      return;
    }

    // Determine root ID (if this is a child, find the root)
    const rootId = root.parentId ?? root.id;

    // Get all messages in the thread (root + all descendants, flat, ordered)
    const thread = await prisma.negotiation.findMany({
      where: {
        OR: [{ id: rootId }, { parentId: rootId }],
      },
      include: {
        listing: {
          select: { id: true, stackId: true, pricePerTon: true, productType: true, baleType: true, estimatedTons: true, status: true, isDeliveredPrice: true, truckingCoordinatedBy: true, farmLocation: { select: { name: true } } },
        },
        buyerOrg: { select: { id: true, name: true } },
        growerOrg: { select: { id: true, name: true } },
        offeredByUser: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json({ thread });
  } catch (error) {
    console.error('Get negotiation thread error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to get negotiation thread' } });
  }
});

// --- POST /negotiations/:id/counter — counter a pending offer ---

router.post('/:id/counter', requireRole('FARM_ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = counterSchema.parse(req.body);
    const orgId = req.user!.organizationId;

    const negotiation = await prisma.negotiation.findUnique({
      where: { id: req.params.id as string },
    });

    if (!negotiation) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Negotiation not found' } });
      return;
    }

    if (negotiation.status !== 'pending') {
      res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Only pending offers can be countered' } });
      return;
    }

    // Only the RECEIVING org can counter (not the one who made the offer)
    if (negotiation.offeredByOrgId === orgId) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You cannot counter your own offer' } });
      return;
    }

    // Must be part of this negotiation
    if (negotiation.buyerOrgId !== orgId && negotiation.growerOrgId !== orgId) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
      return;
    }

    const rootId = negotiation.parentId ?? negotiation.id;

    const [, counterOffer] = await prisma.$transaction([
      // Mark old offer as countered
      prisma.negotiation.update({
        where: { id: negotiation.id },
        data: { status: 'countered' },
      }),
      // Create new child offer
      prisma.negotiation.create({
        data: {
          listingId: negotiation.listingId,
          buyerOrgId: negotiation.buyerOrgId,
          growerOrgId: negotiation.growerOrgId,
          offeredPricePerTon: data.offeredPricePerTon,
          offeredTons: data.offeredTons,
          message: data.message,
          offeredByOrgId: orgId,
          offeredByUserId: req.user!.userId,
          parentId: rootId,
          status: 'pending',
        },
        include: {
          listing: { select: { id: true, stackId: true, pricePerTon: true, productType: true, baleType: true, isDeliveredPrice: true, truckingCoordinatedBy: true, farmLocation: { select: { name: true } } } },
          buyerOrg: { select: { id: true, name: true } },
          growerOrg: { select: { id: true, name: true } },
          offeredByUser: { select: { id: true, name: true } },
        },
      }),
    ]);

    res.status(201).json(counterOffer);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: error.errors } });
      return;
    }
    console.error('Counter offer error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to counter offer' } });
  }
});

// --- POST /negotiations/:id/accept — accept a pending offer ---

router.post('/:id/accept', requireRole('FARM_ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user!.organizationId;

    const negotiation = await prisma.negotiation.findUnique({
      where: { id: req.params.id as string },
    });

    if (!negotiation) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Negotiation not found' } });
      return;
    }

    if (negotiation.status !== 'pending') {
      res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Only pending offers can be accepted' } });
      return;
    }

    // Only the RECEIVING org can accept
    if (negotiation.offeredByOrgId === orgId) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You cannot accept your own offer' } });
      return;
    }

    if (negotiation.buyerOrgId !== orgId && negotiation.growerOrgId !== orgId) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
      return;
    }

    const listing = await prisma.listing.findUnique({ where: { id: negotiation.listingId } });
    const poNumber = await generatePoNumber();
    const contractedTons = negotiation.offeredTons ?? listing?.estimatedTons ?? 0;

    const result = await prisma.$transaction(async (tx) => {
      // Mark negotiation accepted
      const accepted = await tx.negotiation.update({
        where: { id: negotiation.id },
        data: { status: 'accepted' },
      });

      // Create PurchaseOrder
      const po = await tx.purchaseOrder.create({
        data: {
          poNumber,
          buyerOrgId: negotiation.buyerOrgId,
          growerOrgId: negotiation.growerOrgId,
          contractedTons,
          pricePerTon: negotiation.offeredPricePerTon,
          status: 'DRAFT',
          createdById: req.user!.userId,
        },
      });

      // Link PO → listing via POStack
      await tx.pOStack.create({
        data: {
          poId: po.id,
          listingId: negotiation.listingId,
          allocatedTons: contractedTons,
        },
      });

      // Update negotiation with PO reference
      await tx.negotiation.update({
        where: { id: negotiation.id },
        data: { purchaseOrderId: po.id },
      });

      // Update listing status to under_contract
      await tx.listing.update({
        where: { id: negotiation.listingId },
        data: { status: 'under_contract' },
      });

      return { accepted, po };
    });

    // Hide PO number until both parties have signed the contract
    const { poNumber: _poNumber, ...poWithoutNumber } = result.po;
    const isSigned = result.po.signedByBuyerId && result.po.signedByGrowerId;

    res.json({
      negotiation: result.accepted,
      purchaseOrder: isSigned ? result.po : { ...poWithoutNumber, poNumber: null },
    });
  } catch (error) {
    console.error('Accept offer error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to accept offer' } });
  }
});

// --- POST /negotiations/:id/reject — reject a pending offer ---

router.post('/:id/reject', requireRole('FARM_ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user!.organizationId;

    const negotiation = await prisma.negotiation.findUnique({
      where: { id: req.params.id as string },
    });

    if (!negotiation) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Negotiation not found' } });
      return;
    }

    if (negotiation.status !== 'pending') {
      res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Only pending offers can be rejected' } });
      return;
    }

    // Only the RECEIVING org can reject
    if (negotiation.offeredByOrgId === orgId) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You cannot reject your own offer' } });
      return;
    }

    if (negotiation.buyerOrgId !== orgId && negotiation.growerOrgId !== orgId) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
      return;
    }

    const rejected = await prisma.negotiation.update({
      where: { id: negotiation.id },
      data: { status: 'rejected' },
    });

    res.json(rejected);
  } catch (error) {
    console.error('Reject offer error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to reject offer' } });
  }
});

export default router;
