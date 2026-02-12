import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding dummy Active POs...');

  // Get existing orgs and users
  const buyerOrg = await prisma.organization.findFirst({ where: { type: 'BUYER' } });
  const growerOrg = await prisma.organization.findFirst({ where: { type: 'GROWER' } });

  if (!buyerOrg || !growerOrg) {
    console.error('Run the base seed first — need buyer and grower orgs.');
    process.exit(1);
  }

  const buyerAdmin = await prisma.user.findFirst({ where: { organizationId: buyerOrg.id, role: 'FARM_ADMIN' } });
  const growerAdmin = await prisma.user.findFirst({ where: { organizationId: growerOrg.id, role: 'FARM_ADMIN' } });

  if (!buyerAdmin || !growerAdmin) {
    console.error('Run the base seed first — need buyer and grower admin users.');
    process.exit(1);
  }

  // Create a farm location for the grower (if none exists)
  let farmLocation = await prisma.farmLocation.findFirst({ where: { organizationId: growerOrg.id } });
  if (!farmLocation) {
    farmLocation = await prisma.farmLocation.create({
      data: {
        organizationId: growerOrg.id,
        name: 'Smith North Field',
        address: '1234 County Road 5, Hays, KS 67601',
        state: 'KS',
        latitude: 38.879,
        longitude: -99.327,
      },
    });
  }

  // Create a buyer site (if none exists)
  let buyerSite = await prisma.buyerSite.findFirst({ where: { organizationId: buyerOrg.id } });
  if (!buyerSite) {
    buyerSite = await prisma.buyerSite.create({
      data: {
        organizationId: buyerOrg.id,
        siteName: 'Main Feedlot',
        siteCode: 'DEMO-MAIN',
        address: '5678 Feedlot Rd, Dodge City, KS 67801',
        latitude: 37.753,
        longitude: -100.017,
      },
    });
  }

  // Dummy PO data
  const dummyPOs = [
    {
      stackId: 'STK-1001',
      productType: 'Alfalfa',
      baleType: 'Large Square',
      pricePerTon: 185.00,
      estimatedTons: 120,
      moisturePercent: 12.5,
      poNumber: 'PO-10001',
      qualityNotes: 'Premium dairy-quality alfalfa, 3rd cutting',
    },
    {
      stackId: 'STK-1002',
      productType: 'Grass Hay',
      baleType: 'Round',
      pricePerTon: 135.00,
      estimatedTons: 80,
      moisturePercent: 14.0,
      poNumber: 'PO-10002',
      qualityNotes: 'Mixed grass, good color',
    },
    {
      stackId: 'STK-1003',
      productType: 'Oat Hay',
      baleType: 'Large Square',
      pricePerTon: 155.00,
      estimatedTons: 200,
      moisturePercent: 11.0,
      poNumber: 'PO-10003',
      qualityNotes: 'Oat hay, cut at boot stage',
    },
    {
      stackId: 'STK-1004',
      productType: 'Alfalfa/Grass Mix',
      baleType: 'Small Square',
      pricePerTon: 165.00,
      estimatedTons: 50,
      moisturePercent: 13.0,
      poNumber: 'PO-10004',
      qualityNotes: null,
    },
  ];

  for (const item of dummyPOs) {
    // Skip if PO number already exists
    const existing = await prisma.purchaseOrder.findUnique({ where: { poNumber: item.poNumber } });
    if (existing) {
      console.log(`  Skipping ${item.poNumber} — already exists`);
      continue;
    }

    // Skip if stackId already exists
    const existingListing = await prisma.listing.findUnique({ where: { stackId: item.stackId } });
    if (existingListing) {
      console.log(`  Skipping listing ${item.stackId} — already exists`);
      continue;
    }

    // Create listing
    const listing = await prisma.listing.create({
      data: {
        organizationId: growerOrg.id,
        farmLocationId: farmLocation.id,
        stackId: item.stackId,
        productType: item.productType,
        baleType: item.baleType,
        pricePerTon: item.pricePerTon,
        estimatedTons: item.estimatedTons,
        moisturePercent: item.moisturePercent,
        status: 'under_contract',
        firmPrice: true,
        isDeliveredPrice: false,
        truckingCoordinatedBy: 'buyer',
      },
    });

    // Create PO — both parties signed, ACTIVE
    const po = await prisma.purchaseOrder.create({
      data: {
        poNumber: item.poNumber,
        buyerOrgId: buyerOrg.id,
        growerOrgId: growerOrg.id,
        destinationSiteId: buyerSite.id,
        contractedTons: item.estimatedTons,
        pricePerTon: item.pricePerTon,
        deliveryStartDate: new Date('2026-02-15'),
        deliveryEndDate: new Date('2026-04-15'),
        maxMoisturePercent: item.moisturePercent ? item.moisturePercent + 2 : 16,
        qualityNotes: item.qualityNotes,
        status: 'ACTIVE',
        deliveredTons: 0,
        signedByBuyerId: buyerAdmin.id,
        signedByGrowerId: growerAdmin.id,
        signedAt: new Date(),
        createdById: buyerAdmin.id,
      },
    });

    // Link listing to PO
    await prisma.pOStack.create({
      data: {
        poId: po.id,
        listingId: listing.id,
        allocatedTons: item.estimatedTons,
      },
    });

    console.log(`  Created ${item.poNumber}: ${item.productType} — ${item.estimatedTons}T @ $${item.pricePerTon}/ton`);
  }

  console.log('');
  console.log('Done! 4 ACTIVE POs ready for delivery logging.');
  console.log('Log in as admin@demofeedlot.com or admin@smithfarms.com to see them.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
