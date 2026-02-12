import { Router, Response } from 'express';
import prisma from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/permissions';
import { parsePagination, paginationMeta } from '../utils/pagination';
import { sendInvoice } from '../services/invoiceService';

const router = Router();

router.use(authenticate);

const invoiceIncludes = {
  po: { select: { id: true, poNumber: true, status: true, contractedTons: true } },
  buyerOrg: { select: { id: true, name: true } },
  growerOrg: { select: { id: true, name: true } },
  approvedBy: { select: { id: true, name: true } },
};

// --- GET / — Paginated list, filterable by paymentStatus ---

router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user!.organizationId;
    const { page, limit, skip } = parsePagination(req.query);
    const paymentStatus = req.query.paymentStatus as string | undefined;

    const where: Record<string, unknown> = {
      OR: [{ buyerOrgId: orgId }, { growerOrgId: orgId }],
    };
    if (paymentStatus) {
      where.paymentStatus = paymentStatus;
    }

    const [invoices, totalItems] = await Promise.all([
      prisma.invoice.findMany({
        where: where as any,
        include: invoiceIncludes,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.invoice.count({ where: where as any }),
    ]);

    res.json({ invoices, pagination: paginationMeta(page, limit, totalItems) });
  } catch (error) {
    console.error('List invoices error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to list invoices' } });
  }
});

// --- GET /:id — Invoice detail ---

router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user!.organizationId;

    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id as string },
      include: invoiceIncludes,
    });

    if (!invoice) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Invoice not found' } });
      return;
    }

    if (invoice.buyerOrgId !== orgId && invoice.growerOrgId !== orgId) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
      return;
    }

    res.json(invoice);
  } catch (error) {
    console.error('Get invoice error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to get invoice' } });
  }
});

// --- POST /:id/approve — Buyer FARM_ADMIN approves (PENDING → APPROVED) ---

router.post('/:id/approve', requireRole('FARM_ADMIN'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user!.organizationId;
    const userId = req.user!.userId;

    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id as string },
    });

    if (!invoice) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Invoice not found' } });
      return;
    }

    if (invoice.buyerOrgId !== orgId) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Only the buyer organization can approve invoices' } });
      return;
    }

    if (invoice.paymentStatus !== 'PENDING') {
      res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Can only approve PENDING invoices' } });
      return;
    }

    const updated = await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        paymentStatus: 'APPROVED',
        approvedById: userId,
        approvedAt: new Date(),
      },
      include: invoiceIncludes,
    });

    res.json(updated);
  } catch (error) {
    console.error('Approve invoice error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to approve invoice' } });
  }
});

// --- POST /:id/send — Email the invoice ---

router.post('/:id/send', requireRole('FARM_ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user!.organizationId;

    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id as string },
    });

    if (!invoice) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Invoice not found' } });
      return;
    }

    if (invoice.buyerOrgId !== orgId && invoice.growerOrgId !== orgId) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
      return;
    }

    const updated = await sendInvoice(invoice.id);
    res.json(updated);
  } catch (error) {
    console.error('Send invoice error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to send invoice' } });
  }
});

export default router;
