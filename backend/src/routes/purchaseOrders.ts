import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/permissions';

const router = Router();

router.use(authenticate);

// --- Validation schemas ---

const updateTermsSchema = z.object({
  deliveryStartDate: z.string().datetime().optional(),
  deliveryEndDate: z.string().datetime().optional(),
  maxMoisturePercent: z.number().min(0).max(100).optional(),
  qualityNotes: z.string().optional(),
});

const setCenterSchema = z.object({
  center: z.string().min(1, 'Center is required').max(100).optional(),
  hayClass: z.string().max(100).optional(),
});

const signSchema = z.object({
  typedName: z.string().min(2, 'Name must be at least 2 characters'),
  signatureImage: z.string().optional(),
});

const acceptListingSchema = z.object({
  listingId: z.string().uuid(),
  typedName: z.string().min(2, 'Name must be at least 2 characters'),
  signatureImage: z.string().optional(),
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

const LOAD_NUMBER_START = 1001;

async function generateLoadNumber(): Promise<string> {
  const last = await prisma.load.findFirst({
    orderBy: { loadNumber: 'desc' },
    select: { loadNumber: true },
  });
  if (!last) return `LD-${LOAD_NUMBER_START}`;
  const num = parseInt(last.loadNumber.replace('LD-', ''), 10);
  return `LD-${isNaN(num) ? LOAD_NUMBER_START : num + 1}`;
}

const logDeliverySchema = z.object({
  totalBaleCount: z.number().int().positive(),
  wetBalesCount: z.number().int().min(0),
  grossWeight: z.number().positive(),
  tareWeight: z.number().positive(),
  location: z.string().optional(),
});

// --- Shared includes ---

const poIncludes = {
  buyerOrg: { select: { id: true, name: true } },
  growerOrg: { select: { id: true, name: true } },
  destinationSite: { select: { id: true, siteName: true } },
  createdBy: { select: { id: true, name: true } },
  signedByBuyer: { select: { id: true, name: true } },
  signedByGrower: { select: { id: true, name: true } },
  poStacks: {
    include: {
      listing: {
        select: { id: true, stackId: true, productType: true, baleType: true },
      },
    },
  },
};

// Redact poNumber unless both parties have signed
function redactPoNumber(po: Record<string, unknown>): Record<string, unknown> {
  const bothSigned = po.signedByBuyerId && po.signedByGrowerId;
  if (!bothSigned) {
    return { ...po, poNumber: null };
  }
  return po;
}

// --- GET /dashboard-stats — Real-time KPIs ---

router.get('/dashboard-stats', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user!.organizationId;
    const centerParam = req.query.center as string | undefined;
    const orgFilter: Record<string, unknown> = { OR: [{ buyerOrgId: orgId }, { growerOrgId: orgId }] };
    if (centerParam) orgFilter.center = centerParam;

    // Parse optional date range (for filtering loads/tons/prices)
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : (() => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d; })();
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();
    endDate.setHours(23, 59, 59, 999);

    const dateFilter = { gte: startDate, lte: endDate };

    // Active POs count (always current, not date-filtered)
    const activePOs = await prisma.purchaseOrder.count({
      where: { ...orgFilter, status: 'ACTIVE' } as any,
    });

    // Open negotiations count (always current)
    const openNegotiations = await prisma.negotiation.count({
      where: {
        OR: [{ buyerOrgId: orgId }, { growerOrgId: orgId }],
        status: { in: ['pending', 'countered'] },
      },
    });

    // Today's loads (always today)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const todaysLoads = await prisma.load.count({
      where: {
        po: orgFilter as any,
        deliveryDatetime: { gte: todayStart, lte: todayEnd },
      },
    });

    // Period loads + tons (date-filtered)
    const periodLoads = await prisma.load.findMany({
      where: {
        po: orgFilter as any,
        deliveryDatetime: dateFilter,
      },
      select: { grossWeight: true, tareWeight: true },
    });

    const periodTons = periodLoads.reduce((sum, l) => {
      const net = (l.grossWeight ?? 0) - (l.tareWeight ?? 0);
      return sum + net / 2000;
    }, 0);

    // Average price per ton by product type (from POs created in date range)
    const posInRange = await prisma.purchaseOrder.findMany({
      where: {
        ...orgFilter,
        status: { in: ['ACTIVE', 'COMPLETED'] },
        createdAt: dateFilter,
      } as any,
      select: {
        pricePerTon: true,
        contractedTons: true,
        poStacks: {
          select: {
            listing: { select: { productType: true } },
          },
        },
      },
    });

    // Group by product type, compute weighted average
    const priceMap: Record<string, { totalValue: number; totalTons: number }> = {};
    for (const po of posInRange) {
      const productType = po.poStacks[0]?.listing?.productType || 'Other';
      if (!priceMap[productType]) priceMap[productType] = { totalValue: 0, totalTons: 0 };
      priceMap[productType].totalValue += po.pricePerTon * po.contractedTons;
      priceMap[productType].totalTons += po.contractedTons;
    }

    const avgPriceByProduct = Object.entries(priceMap).map(([productType, data]) => ({
      productType,
      avgPricePerTon: data.totalTons > 0 ? Math.round((data.totalValue / data.totalTons) * 100) / 100 : 0,
      totalTons: Math.round(data.totalTons * 100) / 100,
      poCount: posInRange.filter((p) => (p.poStacks[0]?.listing?.productType || 'Other') === productType).length,
    })).sort((a, b) => b.totalTons - a.totalTons);

    // Get all distinct centers for filter dropdown (unfiltered by center)
    const allPOsForCenters = await prisma.purchaseOrder.findMany({
      where: { OR: [{ buyerOrgId: orgId }, { growerOrgId: orgId }], center: { not: null } },
      select: { center: true },
      distinct: ['center'],
    });
    const centers = allPOsForCenters.map(p => p.center).filter(Boolean).sort();

    res.json({
      activePOs,
      openNegotiations,
      todaysLoads,
      periodTons: Math.round(periodTons * 100) / 100,
      periodLoadsCount: periodLoads.length,
      avgPriceByProduct,
      centers,
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to get dashboard stats' } });
  }
});

// --- GET /loads — All loads across all POs for the caller's org ---

router.get('/loads', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user!.organizationId;

    const loads = await prisma.load.findMany({
      where: {
        po: {
          OR: [{ buyerOrgId: orgId }, { growerOrgId: orgId }],
        },
      },
      include: {
        po: {
          select: {
            id: true,
            poNumber: true,
            pricePerTon: true,
            center: true,
            buyerOrg: { select: { id: true, name: true } },
            growerOrg: { select: { id: true, name: true } },
          },
        },
        listing: {
          select: {
            id: true,
            stackId: true,
            productType: true,
            baleType: true,
            organization: { select: { id: true, name: true } },
          },
        },
        barn: { select: { id: true, name: true } },
        feedPad: { select: { id: true, name: true } },
        enteredBy: { select: { id: true, name: true } },
      },
      orderBy: { deliveryDatetime: 'desc' },
    });

    const enriched = loads.map((l) => {
      const netWeight = (l.grossWeight ?? 0) - (l.tareWeight ?? 0);
      const avgBaleWeight = l.totalBaleCount && l.totalBaleCount > 0 ? netWeight / l.totalBaleCount : 0;
      return {
        ...l,
        netWeight: Math.round(netWeight * 100) / 100,
        avgBaleWeight: Math.round(avgBaleWeight * 100) / 100,
      };
    });

    res.json({ loads: enriched });
  } catch (error) {
    console.error('List all loads error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to list loads' } });
  }
});

// --- POST /accept-listing — Accept listing at listed price, create PO, and sign in one step ---

router.post('/accept-listing', requireRole('FARM_ADMIN'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = acceptListingSchema.parse(req.body);
    const orgId = req.user!.organizationId;
    const userId = req.user!.userId;

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

    if (listing.organizationId === orgId) {
      res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Cannot accept your own listing' } });
      return;
    }

    const contractedTons = listing.estimatedTons ?? 0;
    const poNumber = await generatePoNumber();

    const result = await prisma.$transaction(async (tx) => {
      // Create negotiation at listed price
      const negotiation = await tx.negotiation.create({
        data: {
          listingId: listing.id,
          buyerOrgId: orgId,
          growerOrgId: listing.organizationId,
          offeredPricePerTon: listing.pricePerTon,
          offeredTons: contractedTons || undefined,
          message: 'Accepted at listed price.',
          offeredByOrgId: orgId,
          offeredByUserId: userId,
          status: 'accepted',
        },
      });

      // Create PO
      const po = await tx.purchaseOrder.create({
        data: {
          poNumber,
          buyerOrgId: orgId,
          growerOrgId: listing.organizationId,
          contractedTons,
          pricePerTon: listing.pricePerTon,
          status: 'DRAFT',
          createdById: userId,
          signedByBuyerId: userId,
        },
      });

      // Link PO to listing via POStack
      await tx.pOStack.create({
        data: {
          poId: po.id,
          listingId: listing.id,
          allocatedTons: contractedTons,
        },
      });

      // Update negotiation with PO reference
      await tx.negotiation.update({
        where: { id: negotiation.id },
        data: { purchaseOrderId: po.id },
      });

      // Update listing status
      await tx.listing.update({
        where: { id: listing.id },
        data: { status: 'under_contract' },
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          userId,
          action: 'ACCEPT_LISTING_AND_SIGN',
          entityType: 'PurchaseOrder',
          entityId: po.id,
          newValues: {
            typedName: data.typedName,
            signatureImage: data.signatureImage || null,
            side: 'buyer',
            listingId: listing.id,
          },
        },
      });

      // Return PO with full includes
      return tx.purchaseOrder.findUnique({
        where: { id: po.id },
        include: poIncludes,
      });
    });

    res.status(201).json(redactPoNumber(result as unknown as Record<string, unknown>));
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: error.errors } });
      return;
    }
    console.error('Accept listing error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to accept listing' } });
  }
});

// --- GET / — List POs for caller's org ---

router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user!.organizationId;

    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where: {
        OR: [{ buyerOrgId: orgId }, { growerOrgId: orgId }],
      },
      include: poIncludes,
      orderBy: { createdAt: 'desc' },
    });

    const redacted = purchaseOrders.map((po) => redactPoNumber(po as unknown as Record<string, unknown>));

    res.json({ purchaseOrders: redacted });
  } catch (error) {
    console.error('List purchase orders error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to list purchase orders' } });
  }
});

// --- GET /:id — Single PO detail ---

router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user!.organizationId;

    const po = await prisma.purchaseOrder.findUnique({
      where: { id: req.params.id as string },
      include: poIncludes,
    });

    if (!po) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Purchase order not found' } });
      return;
    }

    if (po.buyerOrgId !== orgId && po.growerOrgId !== orgId) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
      return;
    }

    res.json(redactPoNumber(po as unknown as Record<string, unknown>));
  } catch (error) {
    console.error('Get purchase order error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to get purchase order' } });
  }
});

// --- PATCH /:id/terms — Update contract terms (FARM_ADMIN or MANAGER) ---

router.patch('/:id/terms', requireRole('FARM_ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = updateTermsSchema.parse(req.body);
    const orgId = req.user!.organizationId;

    const po = await prisma.purchaseOrder.findUnique({
      where: { id: req.params.id as string },
    });

    if (!po) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Purchase order not found' } });
      return;
    }

    if (po.buyerOrgId !== orgId && po.growerOrgId !== orgId) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
      return;
    }

    if (po.status !== 'DRAFT') {
      res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Can only edit terms on DRAFT purchase orders' } });
      return;
    }

    if (po.signedByBuyerId || po.signedByGrowerId) {
      res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Cannot change terms after a party has signed' } });
      return;
    }

    const updateData: Record<string, unknown> = {};
    if (data.deliveryStartDate !== undefined) updateData.deliveryStartDate = new Date(data.deliveryStartDate);
    if (data.deliveryEndDate !== undefined) updateData.deliveryEndDate = new Date(data.deliveryEndDate);
    if (data.maxMoisturePercent !== undefined) updateData.maxMoisturePercent = data.maxMoisturePercent;
    if (data.qualityNotes !== undefined) updateData.qualityNotes = data.qualityNotes;

    const [updated] = await prisma.$transaction([
      prisma.purchaseOrder.update({
        where: { id: po.id },
        data: updateData,
        include: poIncludes,
      }),
      prisma.auditLog.create({
        data: {
          userId: req.user!.userId,
          action: 'UPDATE_PO_TERMS',
          entityType: 'PurchaseOrder',
          entityId: po.id,
          oldValues: {
            deliveryStartDate: po.deliveryStartDate,
            deliveryEndDate: po.deliveryEndDate,
            maxMoisturePercent: po.maxMoisturePercent,
            qualityNotes: po.qualityNotes,
          },
          newValues: updateData as Record<string, string | number | null>,
        },
      }),
    ]);

    res.json(redactPoNumber(updated as unknown as Record<string, unknown>));
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: error.errors } });
      return;
    }
    console.error('Update PO terms error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to update terms' } });
  }
});

// --- POST /:id/sign — E-sign the contract (FARM_ADMIN only) ---

router.post('/:id/sign', requireRole('FARM_ADMIN'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = signSchema.parse(req.body);
    const orgId = req.user!.organizationId;
    const userId = req.user!.userId;

    const po = await prisma.purchaseOrder.findUnique({
      where: { id: req.params.id as string },
    });

    if (!po) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Purchase order not found' } });
      return;
    }

    if (po.buyerOrgId !== orgId && po.growerOrgId !== orgId) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
      return;
    }

    if (po.status !== 'DRAFT') {
      res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Can only sign DRAFT purchase orders' } });
      return;
    }

    // Determine caller's side
    const isBuyer = po.buyerOrgId === orgId;
    const isGrower = po.growerOrgId === orgId;

    if (isBuyer && po.signedByBuyerId) {
      res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Buyer has already signed this contract' } });
      return;
    }

    if (isGrower && po.signedByGrowerId) {
      res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Grower has already signed this contract' } });
      return;
    }

    const side = isBuyer ? 'buyer' : 'grower';
    const otherSideSigned = isBuyer ? !!po.signedByGrowerId : !!po.signedByBuyerId;
    const bothSigned = otherSideSigned; // After this signing, both will have signed

    const updateData: Record<string, unknown> = {};
    if (isBuyer) {
      updateData.signedByBuyerId = userId;
    } else {
      updateData.signedByGrowerId = userId;
    }

    if (bothSigned) {
      updateData.status = 'ACTIVE';
      updateData.signedAt = new Date();
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.purchaseOrder.update({
        where: { id: po.id },
        data: updateData,
        include: poIncludes,
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'SIGN_PO',
          entityType: 'PurchaseOrder',
          entityId: po.id,
          newValues: {
            typedName: data.typedName,
            signatureImage: data.signatureImage || null,
            side,
            bothSigned,
          },
        },
      });

      return result;
    });

    res.json(redactPoNumber(updated as unknown as Record<string, unknown>));
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: error.errors } });
      return;
    }
    console.error('Sign PO error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to sign contract' } });
  }
});

// --- POST /:id/close — Close a contract (mark 100% delivered, COMPLETED) ---

router.post('/:id/close', requireRole('FARM_ADMIN'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user!.organizationId;
    const userId = req.user!.userId;

    const po = await prisma.purchaseOrder.findUnique({
      where: { id: req.params.id as string },
    });

    if (!po) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Purchase order not found' } });
      return;
    }

    if (po.buyerOrgId !== orgId && po.growerOrgId !== orgId) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
      return;
    }

    if (po.status !== 'ACTIVE') {
      res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Can only close ACTIVE purchase orders' } });
      return;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.purchaseOrder.update({
        where: { id: po.id },
        data: {
          deliveredTons: po.contractedTons,
          status: 'COMPLETED',
          completedAt: new Date(),
        },
        include: poIncludes,
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'CLOSE_CONTRACT',
          entityType: 'PurchaseOrder',
          entityId: po.id,
          oldValues: { status: po.status, deliveredTons: po.deliveredTons },
          newValues: { status: 'COMPLETED', deliveredTons: po.contractedTons },
        },
      });

      return result;
    });

    res.json(updated);
  } catch (error) {
    console.error('Close contract error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to close contract' } });
  }
});

// --- PATCH /:id/center — Set the center for a PO ---

router.patch('/:id/center', requireRole('FARM_ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = setCenterSchema.parse(req.body);
    const orgId = req.user!.organizationId;

    const po = await prisma.purchaseOrder.findUnique({
      where: { id: req.params.id as string },
    });

    if (!po) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Purchase order not found' } });
      return;
    }

    if (po.buyerOrgId !== orgId && po.growerOrgId !== orgId) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
      return;
    }

    const updateData: Record<string, unknown> = {};
    if (data.center !== undefined) updateData.center = data.center;
    if (data.hayClass !== undefined) updateData.hayClass = data.hayClass;

    if (Object.keys(updateData).length === 0) {
      res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'No fields provided' } });
      return;
    }

    const updated = await prisma.purchaseOrder.update({
      where: { id: po.id },
      data: updateData,
      include: poIncludes,
    });

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: error.errors } });
      return;
    }
    console.error('Set center error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to update PO details' } });
  }
});

// --- GET /:id/contract — Get contract with signatures ---

router.get('/:id/contract', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user!.organizationId;

    const po = await prisma.purchaseOrder.findUnique({
      where: { id: req.params.id as string },
      include: {
        ...poIncludes,
      },
    });

    if (!po) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Purchase order not found' } });
      return;
    }

    if (po.buyerOrgId !== orgId && po.growerOrgId !== orgId) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
      return;
    }

    // Get signature audit logs for this PO
    const signLogs = await prisma.auditLog.findMany({
      where: {
        entityType: 'PurchaseOrder',
        entityId: po.id,
        action: { in: ['SIGN_PO', 'ACCEPT_LISTING_AND_SIGN'] },
      },
      include: {
        user: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    let buyerSignature: { name: string; signatureImage: string | null; signedAt: string; signedBy: string } | null = null;
    let growerSignature: { name: string; signatureImage: string | null; signedAt: string; signedBy: string } | null = null;

    for (const log of signLogs) {
      const vals = log.newValues as Record<string, unknown> | null;
      if (!vals) continue;
      const side = vals.side as string;
      const entry = {
        name: (vals.typedName as string) || '',
        signatureImage: (vals.signatureImage as string) || null,
        signedAt: log.createdAt.toISOString(),
        signedBy: log.user?.name || '',
      };
      if (side === 'buyer' && !buyerSignature) buyerSignature = entry;
      if (side === 'grower' && !growerSignature) growerSignature = entry;
    }

    res.json({
      ...po,
      buyerSignature,
      growerSignature,
    });
  } catch (error) {
    console.error('Get contract error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to get contract' } });
  }
});

// --- POST /:id/deliveries — Log a delivery against an ACTIVE PO ---

router.post('/:id/deliveries', requireRole('FARM_ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = logDeliverySchema.parse(req.body);
    const orgId = req.user!.organizationId;
    const userId = req.user!.userId;

    const po = await prisma.purchaseOrder.findUnique({
      where: { id: req.params.id as string },
      include: { poStacks: true },
    });

    if (!po) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Purchase order not found' } });
      return;
    }

    if (po.buyerOrgId !== orgId && po.growerOrgId !== orgId) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
      return;
    }

    if (po.status !== 'ACTIVE') {
      res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Can only log deliveries on ACTIVE purchase orders' } });
      return;
    }

    const netWeight = data.grossWeight - data.tareWeight;
    if (netWeight <= 0) {
      res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Gross weight must be greater than tare weight' } });
      return;
    }

    const netTons = netWeight / 2000; // lbs to tons
    const loadNumber = await generateLoadNumber();
    const listingId = po.poStacks[0]?.listingId;

    if (!listingId) {
      res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'PO has no linked listing' } });
      return;
    }

    const load = await prisma.$transaction(async (tx) => {
      const newLoad = await tx.load.create({
        data: {
          loadNumber,
          poId: po.id,
          listingId,
          grossWeight: data.grossWeight,
          tareWeight: data.tareWeight,
          totalBaleCount: data.totalBaleCount,
          wetBalesCount: data.wetBalesCount,
          qualityNotes: data.location || undefined,
          deliveryDatetime: new Date(),
          enteredById: userId,
          status: 'CONFIRMED',
        },
      });

      // Update delivered tons on the PO
      await tx.purchaseOrder.update({
        where: { id: po.id },
        data: { deliveredTons: { increment: netTons } },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'LOG_DELIVERY',
          entityType: 'Load',
          entityId: newLoad.id,
          newValues: {
            loadNumber,
            poId: po.id,
            grossWeight: data.grossWeight,
            tareWeight: data.tareWeight,
            netWeight,
            netTons,
            totalBaleCount: data.totalBaleCount,
            wetBalesCount: data.wetBalesCount,
          },
        },
      });

      return newLoad;
    });

    const avgBaleWeight = data.totalBaleCount > 0 ? netWeight / data.totalBaleCount : 0;

    res.status(201).json({
      ...load,
      netWeight,
      netTons: Math.round(netTons * 100) / 100,
      avgBaleWeight: Math.round(avgBaleWeight * 100) / 100,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: error.errors } });
      return;
    }
    console.error('Log delivery error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to log delivery' } });
  }
});

// --- GET /:id/deliveries — List deliveries for a PO ---

router.get('/:id/deliveries', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user!.organizationId;

    const po = await prisma.purchaseOrder.findUnique({
      where: { id: req.params.id as string },
      select: { buyerOrgId: true, growerOrgId: true },
    });

    if (!po) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Purchase order not found' } });
      return;
    }

    if (po.buyerOrgId !== orgId && po.growerOrgId !== orgId) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
      return;
    }

    const loads = await prisma.load.findMany({
      where: { poId: req.params.id as string },
      include: {
        barn: { select: { id: true, name: true } },
        feedPad: { select: { id: true, name: true } },
        enteredBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const enriched = loads.map((l) => {
      const netWeight = (l.grossWeight ?? 0) - (l.tareWeight ?? 0);
      const avgBaleWeight = l.totalBaleCount && l.totalBaleCount > 0 ? netWeight / l.totalBaleCount : 0;
      return {
        ...l,
        netWeight: Math.round(netWeight * 100) / 100,
        avgBaleWeight: Math.round(avgBaleWeight * 100) / 100,
      };
    });

    res.json({ deliveries: enriched });
  } catch (error) {
    console.error('List deliveries error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to list deliveries' } });
  }
});

// --- PATCH /loads/:loadId — Edit a load ---

const editLoadSchema = z.object({
  totalBaleCount: z.number().int().positive().optional(),
  wetBalesCount: z.number().int().min(0).optional(),
  grossWeight: z.number().positive().optional(),
  tareWeight: z.number().positive().optional(),
  location: z.string().optional(),
});

router.patch('/loads/:loadId', requireRole('FARM_ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = editLoadSchema.parse(req.body);
    const orgId = req.user!.organizationId;
    const userId = req.user!.userId;

    const load = await prisma.load.findUnique({
      where: { id: req.params.loadId as string },
      include: { po: { select: { buyerOrgId: true, growerOrgId: true } } },
    });

    if (!load) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Load not found' } });
      return;
    }

    if (load.po.buyerOrgId !== orgId && load.po.growerOrgId !== orgId) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
      return;
    }

    // Build update + track edits
    const updateData: Record<string, unknown> = {};
    const edits: { fieldName: string; oldValue: string | null; newValue: string | null }[] = [];

    if (data.totalBaleCount !== undefined && data.totalBaleCount !== load.totalBaleCount) {
      edits.push({ fieldName: 'totalBaleCount', oldValue: String(load.totalBaleCount), newValue: String(data.totalBaleCount) });
      updateData.totalBaleCount = data.totalBaleCount;
    }
    if (data.wetBalesCount !== undefined && data.wetBalesCount !== load.wetBalesCount) {
      edits.push({ fieldName: 'wetBalesCount', oldValue: String(load.wetBalesCount), newValue: String(data.wetBalesCount) });
      updateData.wetBalesCount = data.wetBalesCount;
    }
    if (data.grossWeight !== undefined && data.grossWeight !== load.grossWeight) {
      edits.push({ fieldName: 'grossWeight', oldValue: String(load.grossWeight), newValue: String(data.grossWeight) });
      updateData.grossWeight = data.grossWeight;
    }
    if (data.tareWeight !== undefined && data.tareWeight !== load.tareWeight) {
      edits.push({ fieldName: 'tareWeight', oldValue: String(load.tareWeight), newValue: String(data.tareWeight) });
      updateData.tareWeight = data.tareWeight;
    }
    if (data.location !== undefined && data.location !== load.qualityNotes) {
      edits.push({ fieldName: 'location', oldValue: load.qualityNotes, newValue: data.location });
      updateData.qualityNotes = data.location;
    }

    if (Object.keys(updateData).length === 0) {
      res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'No changes provided' } });
      return;
    }

    // If weights changed, recalculate delivered tons on the PO
    const oldNet = (load.grossWeight ?? 0) - (load.tareWeight ?? 0);
    const newGross = (data.grossWeight ?? load.grossWeight ?? 0);
    const newTare = (data.tareWeight ?? load.tareWeight ?? 0);
    const newNet = newGross - newTare;

    if (newNet <= 0) {
      res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Gross weight must be greater than tare weight' } });
      return;
    }

    const tonsDiff = (newNet - oldNet) / 2000;

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.load.update({
        where: { id: load.id },
        data: updateData,
      });

      // Record each field edit
      for (const edit of edits) {
        await tx.loadEdit.create({
          data: {
            loadId: load.id,
            editedById: userId,
            fieldName: edit.fieldName,
            oldValue: edit.oldValue,
            newValue: edit.newValue,
          },
        });
      }

      // Adjust delivered tons if weight changed
      if (tonsDiff !== 0) {
        await tx.purchaseOrder.update({
          where: { id: load.poId },
          data: { deliveredTons: { increment: tonsDiff } },
        });
      }

      await tx.auditLog.create({
        data: {
          userId,
          action: 'EDIT_LOAD',
          entityType: 'Load',
          entityId: load.id,
          oldValues: { grossWeight: load.grossWeight, tareWeight: load.tareWeight, totalBaleCount: load.totalBaleCount, wetBalesCount: load.wetBalesCount, location: load.qualityNotes },
          newValues: updateData as Record<string, string | number | null>,
        },
      });

      return result;
    });

    const netWeight = (updated.grossWeight ?? 0) - (updated.tareWeight ?? 0);
    const avgBaleWeight = updated.totalBaleCount && updated.totalBaleCount > 0 ? netWeight / updated.totalBaleCount : 0;

    res.json({
      ...updated,
      netWeight: Math.round(netWeight * 100) / 100,
      avgBaleWeight: Math.round(avgBaleWeight * 100) / 100,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: error.errors } });
      return;
    }
    console.error('Edit load error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to edit load' } });
  }
});

// --- GET /:id/pickup-info — Get pickup & delivery location info for trucking ---

router.get('/:id/pickup-info', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user!.organizationId;

    const po = await prisma.purchaseOrder.findUnique({
      where: { id: req.params.id as string },
      include: {
        buyerOrg: { select: { id: true, name: true } },
        growerOrg: { select: { id: true, name: true } },
        destinationSite: {
          select: {
            id: true, siteName: true, address: true, latitude: true, longitude: true,
          },
        },
        poStacks: {
          include: {
            listing: {
              select: {
                id: true, stackId: true, productType: true, baleType: true,
                estimatedTons: true, baleCount: true,
                farmLocation: {
                  select: { id: true, name: true, address: true, state: true, latitude: true, longitude: true },
                },
              },
            },
          },
        },
      },
    });

    if (!po) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Purchase order not found' } });
      return;
    }

    if (po.buyerOrgId !== orgId && po.growerOrgId !== orgId) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
      return;
    }

    if (po.status !== 'ACTIVE') {
      res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Pickup info only available for ACTIVE purchase orders' } });
      return;
    }

    const listing = po.poStacks[0]?.listing;
    const farmLoc = listing?.farmLocation;

    res.json({
      poNumber: po.poNumber,
      buyerOrg: po.buyerOrg.name,
      growerOrg: po.growerOrg.name,
      contractedTons: po.contractedTons,
      pricePerTon: po.pricePerTon,
      productType: listing?.productType || null,
      baleType: listing?.baleType || null,
      baleCount: listing?.baleCount || null,
      deliveryStartDate: po.deliveryStartDate,
      deliveryEndDate: po.deliveryEndDate,
      pickup: farmLoc ? {
        name: farmLoc.name,
        address: farmLoc.address,
        state: farmLoc.state,
        latitude: farmLoc.latitude,
        longitude: farmLoc.longitude,
      } : null,
      delivery: po.destinationSite ? {
        name: po.destinationSite.siteName,
        address: po.destinationSite.address,
        latitude: po.destinationSite.latitude,
        longitude: po.destinationSite.longitude,
      } : null,
    });
  } catch (error) {
    console.error('Pickup info error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to get pickup info' } });
  }
});

export default router;
