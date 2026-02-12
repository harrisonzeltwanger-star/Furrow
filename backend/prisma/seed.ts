import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const passwordHash = await bcrypt.hash('admin123', 12);

  // Create buyer organization + admin
  const buyerOrg = await prisma.organization.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Demo Feedlot',
      type: 'BUYER',
      invoiceEmail: 'billing@demofeedlot.com',
      billingContactName: 'Admin User',
    },
  });

  const buyerAdmin = await prisma.user.upsert({
    where: { email: 'admin@demofeedlot.com' },
    update: {},
    create: {
      email: 'admin@demofeedlot.com',
      passwordHash,
      name: 'Admin User',
      phone: '555-0100',
      organizationId: buyerOrg.id,
      role: 'FARM_ADMIN',
    },
  });

  // Create grower organization + admin
  const growerOrg = await prisma.organization.upsert({
    where: { id: '00000000-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      name: 'Smith Farms',
      type: 'GROWER',
      invoiceEmail: 'billing@smithfarms.com',
      billingContactName: 'John Smith',
    },
  });

  const growerAdmin = await prisma.user.upsert({
    where: { email: 'admin@smithfarms.com' },
    update: {},
    create: {
      email: 'admin@smithfarms.com',
      passwordHash,
      name: 'John Smith',
      phone: '555-0200',
      organizationId: growerOrg.id,
      role: 'FARM_ADMIN',
    },
  });

  // --- Farm Locations for grower ---
  const farmLoc1 = await prisma.farmLocation.upsert({
    where: { id: '00000000-0000-0000-0000-000000000010' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000010',
      organizationId: growerOrg.id,
      name: 'North 40',
      address: '1234 County Road 100, Garden City, KS',
      state: 'KS',
      latitude: 37.9717,
      longitude: -100.8727,
    },
  });

  const farmLoc2 = await prisma.farmLocation.upsert({
    where: { id: '00000000-0000-0000-0000-000000000011' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000011',
      organizationId: growerOrg.id,
      name: 'South Section',
      address: '5678 State Hwy 23, Dodge City, KS',
      state: 'KS',
      latitude: 37.7528,
      longitude: -100.0171,
    },
  });

  const farmLoc3 = await prisma.farmLocation.upsert({
    where: { id: '00000000-0000-0000-0000-000000000012' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000012',
      organizationId: growerOrg.id,
      name: 'River Bottom',
      address: '9101 River Rd, Liberal, KS',
      state: 'KS',
      latitude: 37.0439,
      longitude: -100.9209,
    },
  });

  // --- Buyer Site ---
  const buyerSite = await prisma.buyerSite.upsert({
    where: { id: '00000000-0000-0000-0000-000000000020' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000020',
      organizationId: buyerOrg.id,
      siteName: 'Main Feedlot',
      siteCode: 'DEMO-MAIN',
      address: '4500 Feed Yard Rd, Dodge City, KS',
      latitude: 37.7528,
      longitude: -100.0171,
    },
  });

  // --- Listings ---
  const listing1 = await prisma.listing.upsert({
    where: { stackId: '100001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000030',
      organizationId: growerOrg.id,
      farmLocationId: farmLoc1.id,
      stackId: '100001',
      productType: 'Alfalfa Hay',
      baleType: 'Large Square',
      pricePerTon: 230,
      estimatedTons: 500,
      baleCount: 800,
      moisturePercent: 12,
      status: 'under_contract',
      firmPrice: false,
    },
  });

  const listing2 = await prisma.listing.upsert({
    where: { stackId: '100002' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000031',
      organizationId: growerOrg.id,
      farmLocationId: farmLoc2.id,
      stackId: '100002',
      productType: 'Bermuda Hay',
      baleType: 'Round Bale',
      pricePerTon: 180,
      estimatedTons: 300,
      baleCount: 450,
      moisturePercent: 10,
      status: 'under_contract',
      firmPrice: true,
    },
  });

  const listing3 = await prisma.listing.upsert({
    where: { stackId: '100003' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000032',
      organizationId: growerOrg.id,
      farmLocationId: farmLoc3.id,
      stackId: '100003',
      productType: 'Prairie Hay',
      baleType: 'Large Square',
      pricePerTon: 150,
      estimatedTons: 400,
      baleCount: 650,
      moisturePercent: 11,
      status: 'under_contract',
      firmPrice: false,
    },
  });

  const listing4 = await prisma.listing.upsert({
    where: { stackId: '100004' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000033',
      organizationId: growerOrg.id,
      farmLocationId: farmLoc1.id,
      stackId: '100004',
      productType: 'Alfalfa Hay',
      baleType: 'Small Square',
      pricePerTon: 260,
      estimatedTons: 200,
      baleCount: 1200,
      moisturePercent: 11.5,
      status: 'available',
      firmPrice: false,
    },
  });

  const listing5 = await prisma.listing.upsert({
    where: { stackId: '100005' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000034',
      organizationId: growerOrg.id,
      farmLocationId: farmLoc2.id,
      stackId: '100005',
      productType: 'Timothy Hay',
      baleType: 'Large Square',
      pricePerTon: 210,
      estimatedTons: 350,
      baleCount: 560,
      moisturePercent: 9.5,
      status: 'available',
      firmPrice: false,
    },
  });

  // --- Completed POs ---
  const po1 = await prisma.purchaseOrder.upsert({
    where: { poNumber: 'PO-10001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000040',
      poNumber: 'PO-10001',
      buyerOrgId: buyerOrg.id,
      growerOrgId: growerOrg.id,
      destinationSiteId: buyerSite.id,
      contractedTons: 500,
      pricePerTon: 230,
      deliveredTons: 500,
      deliveryStartDate: new Date('2025-09-01'),
      deliveryEndDate: new Date('2025-12-15'),
      maxMoisturePercent: 14,
      qualityNotes: 'Premium alfalfa, dairy quality',
      status: 'COMPLETED',
      center: 'Center A',
      hayClass: 'Premium',
      createdById: buyerAdmin.id,
      signedByBuyerId: buyerAdmin.id,
      signedByGrowerId: growerAdmin.id,
      signedAt: new Date('2025-09-01'),
      completedAt: new Date('2025-12-10'),
    },
  });

  const po2 = await prisma.purchaseOrder.upsert({
    where: { poNumber: 'PO-10002' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000041',
      poNumber: 'PO-10002',
      buyerOrgId: buyerOrg.id,
      growerOrgId: growerOrg.id,
      destinationSiteId: buyerSite.id,
      contractedTons: 300,
      pricePerTon: 180,
      deliveredTons: 300,
      deliveryStartDate: new Date('2025-10-01'),
      deliveryEndDate: new Date('2026-01-15'),
      maxMoisturePercent: 12,
      qualityNotes: 'Standard bermuda',
      status: 'COMPLETED',
      center: 'Center B',
      hayClass: 'Standard',
      createdById: buyerAdmin.id,
      signedByBuyerId: buyerAdmin.id,
      signedByGrowerId: growerAdmin.id,
      signedAt: new Date('2025-10-01'),
      completedAt: new Date('2026-01-10'),
    },
  });

  const po3 = await prisma.purchaseOrder.upsert({
    where: { poNumber: 'PO-10003' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000042',
      poNumber: 'PO-10003',
      buyerOrgId: buyerOrg.id,
      growerOrgId: growerOrg.id,
      destinationSiteId: buyerSite.id,
      contractedTons: 400,
      pricePerTon: 150,
      deliveredTons: 400,
      deliveryStartDate: new Date('2025-08-15'),
      deliveryEndDate: new Date('2025-11-30'),
      status: 'COMPLETED',
      center: 'Center A',
      hayClass: 'Economy',
      createdById: buyerAdmin.id,
      signedByBuyerId: buyerAdmin.id,
      signedByGrowerId: growerAdmin.id,
      signedAt: new Date('2025-08-15'),
      completedAt: new Date('2025-11-28'),
    },
  });

  // --- Active PO ---
  const po4 = await prisma.purchaseOrder.upsert({
    where: { poNumber: 'PO-10004' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000043',
      poNumber: 'PO-10004',
      buyerOrgId: buyerOrg.id,
      growerOrgId: growerOrg.id,
      destinationSiteId: buyerSite.id,
      contractedTons: 200,
      pricePerTon: 260,
      deliveredTons: 75,
      deliveryStartDate: new Date('2026-01-01'),
      deliveryEndDate: new Date('2026-04-30'),
      maxMoisturePercent: 13,
      qualityNotes: 'Small square alfalfa for dairy',
      status: 'ACTIVE',
      center: 'Center A',
      hayClass: 'Premium',
      createdById: buyerAdmin.id,
      signedByBuyerId: buyerAdmin.id,
      signedByGrowerId: growerAdmin.id,
      signedAt: new Date('2026-01-01'),
    },
  });

  // --- PO Stacks (link POs to listings) ---
  for (const [poId, listingId, tons] of [
    [po1.id, listing1.id, 500],
    [po2.id, listing2.id, 300],
    [po3.id, listing3.id, 400],
    [po4.id, listing4.id, 200],
  ] as [string, string, number][]) {
    await prisma.pOStack.upsert({
      where: { poId_listingId: { poId, listingId } },
      update: {},
      create: { poId, listingId, allocatedTons: tons },
    });
  }

  // --- Loads / Deliveries for completed POs ---
  const loadData: Array<{
    id: string; loadNumber: string; poId: string; listingId: string;
    gross: number; tare: number; bales: number; wet: number;
    date: Date; enteredById: string;
  }> = [
    // PO-10001: 5 loads totaling ~500 tons
    { id: '00000000-0000-0000-0000-000000000050', loadNumber: 'LD-1001', poId: po1.id, listingId: listing1.id, gross: 52000, tare: 16000, bales: 24, wet: 0, date: new Date('2025-09-15'), enteredById: buyerAdmin.id },
    { id: '00000000-0000-0000-0000-000000000051', loadNumber: 'LD-1002', poId: po1.id, listingId: listing1.id, gross: 51500, tare: 15800, bales: 24, wet: 1, date: new Date('2025-09-25'), enteredById: buyerAdmin.id },
    { id: '00000000-0000-0000-0000-000000000052', loadNumber: 'LD-1003', poId: po1.id, listingId: listing1.id, gross: 53000, tare: 16200, bales: 25, wet: 0, date: new Date('2025-10-10'), enteredById: buyerAdmin.id },
    { id: '00000000-0000-0000-0000-000000000053', loadNumber: 'LD-1004', poId: po1.id, listingId: listing1.id, gross: 50500, tare: 15500, bales: 23, wet: 2, date: new Date('2025-11-01'), enteredById: buyerAdmin.id },
    { id: '00000000-0000-0000-0000-000000000054', loadNumber: 'LD-1005', poId: po1.id, listingId: listing1.id, gross: 52500, tare: 16100, bales: 24, wet: 0, date: new Date('2025-12-05'), enteredById: buyerAdmin.id },
    // PO-10002: 3 loads
    { id: '00000000-0000-0000-0000-000000000055', loadNumber: 'LD-1006', poId: po2.id, listingId: listing2.id, gross: 48000, tare: 15000, bales: 22, wet: 0, date: new Date('2025-10-20'), enteredById: buyerAdmin.id },
    { id: '00000000-0000-0000-0000-000000000056', loadNumber: 'LD-1007', poId: po2.id, listingId: listing2.id, gross: 49000, tare: 15200, bales: 23, wet: 1, date: new Date('2025-11-15'), enteredById: buyerAdmin.id },
    { id: '00000000-0000-0000-0000-000000000057', loadNumber: 'LD-1008', poId: po2.id, listingId: listing2.id, gross: 47500, tare: 14800, bales: 22, wet: 0, date: new Date('2025-12-20'), enteredById: buyerAdmin.id },
    // PO-10003: 4 loads
    { id: '00000000-0000-0000-0000-000000000058', loadNumber: 'LD-1009', poId: po3.id, listingId: listing3.id, gross: 50000, tare: 15500, bales: 24, wet: 0, date: new Date('2025-08-25'), enteredById: buyerAdmin.id },
    { id: '00000000-0000-0000-0000-000000000059', loadNumber: 'LD-1010', poId: po3.id, listingId: listing3.id, gross: 51000, tare: 15700, bales: 24, wet: 3, date: new Date('2025-09-10'), enteredById: buyerAdmin.id },
    { id: '00000000-0000-0000-0000-00000000005a', loadNumber: 'LD-1011', poId: po3.id, listingId: listing3.id, gross: 49500, tare: 15300, bales: 23, wet: 0, date: new Date('2025-10-05'), enteredById: buyerAdmin.id },
    { id: '00000000-0000-0000-0000-00000000005b', loadNumber: 'LD-1012', poId: po3.id, listingId: listing3.id, gross: 52000, tare: 16000, bales: 25, wet: 1, date: new Date('2025-11-20'), enteredById: buyerAdmin.id },
    // PO-10004 (active): 2 loads so far
    { id: '00000000-0000-0000-0000-00000000005c', loadNumber: 'LD-1013', poId: po4.id, listingId: listing4.id, gross: 48000, tare: 15000, bales: 120, wet: 0, date: new Date('2026-01-20'), enteredById: buyerAdmin.id },
    { id: '00000000-0000-0000-0000-00000000005d', loadNumber: 'LD-1014', poId: po4.id, listingId: listing4.id, gross: 47000, tare: 14500, bales: 115, wet: 2, date: new Date('2026-02-05'), enteredById: buyerAdmin.id },
  ];

  for (const ld of loadData) {
    await prisma.load.upsert({
      where: { loadNumber: ld.loadNumber },
      update: {},
      create: {
        id: ld.id,
        loadNumber: ld.loadNumber,
        poId: ld.poId,
        listingId: ld.listingId,
        grossWeight: ld.gross,
        tareWeight: ld.tare,
        totalBaleCount: ld.bales,
        wetBalesCount: ld.wet,
        deliveryDatetime: ld.date,
        enteredById: ld.enteredById,
        status: 'CONFIRMED',
      },
    });
  }

  // --- Audit logs for signatures (needed for contract PDF) ---
  for (const po of [po1, po2, po3, po4]) {
    // Buyer signature
    await prisma.auditLog.create({
      data: {
        userId: buyerAdmin.id,
        action: 'ACCEPT_LISTING_AND_SIGN',
        entityType: 'PurchaseOrder',
        entityId: po.id,
        newValues: {
          typedName: 'Admin User',
          signatureImage: null,
          side: 'buyer',
        },
        createdAt: po.signedAt ?? po.createdAt,
      },
    });

    // Grower signature
    await prisma.auditLog.create({
      data: {
        userId: growerAdmin.id,
        action: 'SIGN_PO',
        entityType: 'PurchaseOrder',
        entityId: po.id,
        newValues: {
          typedName: 'John Smith',
          signatureImage: null,
          side: 'grower',
          bothSigned: true,
        },
        createdAt: po.signedAt ?? po.createdAt,
      },
    });
  }

  // --- Negotiations ---
  // Thread 1: Buyer offers on listing4 (Alfalfa Small Square $260/ton) at $240 — pending, waiting for grower
  const neg1 = await prisma.negotiation.upsert({
    where: { id: '00000000-0000-0000-0000-000000000060' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000060',
      listingId: listing4.id,
      buyerOrgId: buyerOrg.id,
      growerOrgId: growerOrg.id,
      status: 'pending',
      offeredPricePerTon: 240,
      offeredTons: 200,
      message: 'We can take the full 200 tons at $240/ton. Interested?',
      offeredByOrgId: buyerOrg.id,
      offeredByUserId: buyerAdmin.id,
      parentId: null,
      createdAt: new Date('2026-02-05T10:00:00Z'),
    },
  });

  // Thread 2: Buyer offers on listing5 (Timothy Hay $210/ton) at $190, grower counters at $205
  const neg2root = await prisma.negotiation.upsert({
    where: { id: '00000000-0000-0000-0000-000000000061' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000061',
      listingId: listing5.id,
      buyerOrgId: buyerOrg.id,
      growerOrgId: growerOrg.id,
      status: 'countered',
      offeredPricePerTon: 190,
      offeredTons: 350,
      message: 'Would you take $190/ton for the full lot?',
      offeredByOrgId: buyerOrg.id,
      offeredByUserId: buyerAdmin.id,
      parentId: null,
      createdAt: new Date('2026-02-03T14:00:00Z'),
    },
  });

  const neg2counter = await prisma.negotiation.upsert({
    where: { id: '00000000-0000-0000-0000-000000000062' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000062',
      listingId: listing5.id,
      buyerOrgId: buyerOrg.id,
      growerOrgId: growerOrg.id,
      status: 'pending',
      offeredPricePerTon: 205,
      offeredTons: 350,
      message: 'I can meet you at $205/ton — it tested well this year.',
      offeredByOrgId: growerOrg.id,
      offeredByUserId: growerAdmin.id,
      parentId: neg2root.id,
      createdAt: new Date('2026-02-04T09:30:00Z'),
    },
  });

  console.log('Seed complete!');
  console.log('');
  console.log('Test accounts:');
  console.log('  Buyer admin:  admin@demofeedlot.com / admin123');
  console.log('  Grower admin: admin@smithfarms.com / admin123');
  console.log('');
  console.log('Seeded data:');
  console.log('  3 farm locations (Smith Farms)');
  console.log('  5 listings (3 under contract, 2 available)');
  console.log('  3 completed POs with delivery history');
  console.log('  1 active PO with 2 deliveries');
  console.log('  1 buyer site (Demo Feedlot)');
  console.log('  2 negotiation threads (1 pending, 1 with counter-offer)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
