import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding dummy contracts + 50 loads...\n');

  // Get existing buyer org and admin
  const buyerOrg = await prisma.organization.findFirst({ where: { type: 'BUYER' } });
  if (!buyerOrg) { console.error('Run the base seed first.'); process.exit(1); }
  const buyerAdmin = await prisma.user.findFirst({ where: { organizationId: buyerOrg.id, role: 'FARM_ADMIN' } });
  if (!buyerAdmin) { console.error('Run the base seed first.'); process.exit(1); }

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

  // --- Create additional grower organizations ---
  const growerDefs = [
    { name: 'Johnson Ranch', email: 'admin@johnsonranch.com', state: 'KS', lat: 38.45, lng: -99.75, address: '234 Ranch Rd, Russell, KS 67665' },
    { name: 'Miller Hay Co', email: 'admin@millerhay.com', state: 'NE', lat: 40.82, lng: -96.70, address: '567 Prairie Ln, Lincoln, NE 68501' },
    { name: 'Thompson AgriSupply', email: 'admin@thompsonagri.com', state: 'OK', lat: 36.72, lng: -97.43, address: '890 Farm Hwy, Enid, OK 73701' },
    { name: 'Davis Prairie Farms', email: 'admin@davisprairie.com', state: 'TX', lat: 34.23, lng: -101.84, address: '1122 Grassland Dr, Lubbock, TX 79401' },
  ];

  const passwordHash = await bcrypt.hash('admin123', 10);
  const growers: Array<{ orgId: string; adminId: string; farmLocId: string; name: string }> = [];

  // Include existing Smith Farms grower
  const smithOrg = await prisma.organization.findFirst({ where: { type: 'GROWER' } });
  if (smithOrg) {
    const smithAdmin = await prisma.user.findFirst({ where: { organizationId: smithOrg.id, role: 'FARM_ADMIN' } });
    let smithLoc = await prisma.farmLocation.findFirst({ where: { organizationId: smithOrg.id } });
    if (!smithLoc) {
      smithLoc = await prisma.farmLocation.create({
        data: { organizationId: smithOrg.id, name: 'Smith North Field', address: '1234 County Road 5, Hays, KS 67601', state: 'KS', latitude: 38.879, longitude: -99.327 },
      });
    }
    if (smithAdmin) {
      growers.push({ orgId: smithOrg.id, adminId: smithAdmin.id, farmLocId: smithLoc.id, name: 'Smith Farms' });
    }
  }

  for (const g of growerDefs) {
    let org = await prisma.organization.findFirst({ where: { name: g.name } });
    if (!org) {
      org = await prisma.organization.create({ data: { name: g.name, type: 'GROWER' } });
      console.log(`  Created org: ${g.name}`);
    }

    let admin = await prisma.user.findFirst({ where: { email: g.email } });
    if (!admin) {
      admin = await prisma.user.create({
        data: { email: g.email, passwordHash, name: g.name.split(' ')[0] + ' Admin', organizationId: org.id, role: 'FARM_ADMIN' },
      });
      console.log(`  Created user: ${g.email}`);
    }

    let farmLoc = await prisma.farmLocation.findFirst({ where: { organizationId: org.id } });
    if (!farmLoc) {
      farmLoc = await prisma.farmLocation.create({
        data: { organizationId: org.id, name: `${g.name} Main`, address: g.address, state: g.state, latitude: g.lat, longitude: g.lng },
      });
    }

    growers.push({ orgId: org.id, adminId: admin.id, farmLocId: farmLoc.id, name: g.name });
  }

  console.log(`\n  ${growers.length} grower orgs ready.\n`);

  // --- Create ACTIVE POs with signatures (for Contracts tab) ---
  const contractDefs = [
    { growerIdx: 0, stackId: 'CTR-2001', productType: 'Alfalfa', baleType: 'Large Square', price: 190, tons: 150, moisture: 12, notes: 'Premium dairy alfalfa, 3rd cutting' },
    { growerIdx: 1, stackId: 'CTR-2002', productType: 'Grass Hay', baleType: 'Round', price: 130, tons: 100, moisture: 14, notes: 'Native grass mix, clean bales' },
    { growerIdx: 2, stackId: 'CTR-2003', productType: 'Timothy Hay', baleType: 'Large Square', price: 210, tons: 80, moisture: 11, notes: 'Horse-quality timothy' },
    { growerIdx: 3, stackId: 'CTR-2004', productType: 'Bermuda Grass', baleType: 'Small Square', price: 145, tons: 60, moisture: 13, notes: 'Coastal bermuda, 2nd cutting' },
    { growerIdx: 4, stackId: 'CTR-2005', productType: 'Oat Hay', baleType: 'Large Square', price: 155, tons: 200, moisture: 10, notes: 'Clean oat hay, boot stage' },
    { growerIdx: 0, stackId: 'CTR-2006', productType: 'Alfalfa/Grass Mix', baleType: 'Round', price: 170, tons: 90, moisture: 13, notes: '60/40 alfalfa-grass blend' },
    { growerIdx: 1, stackId: 'CTR-2007', productType: 'Alfalfa', baleType: 'Small Square', price: 200, tons: 40, moisture: 11, notes: 'Ranch-quality alfalfa bales' },
    { growerIdx: 2, stackId: 'CTR-2008', productType: 'Grass Hay', baleType: 'Large Square', price: 125, tons: 120, moisture: 15, notes: 'Mixed grass, cattle feed quality' },
  ];

  const createdPOs: Array<{ poId: string; listingId: string; tons: number; growerIdx: number }> = [];

  // Also collect existing active POs for load seeding
  const existingActivePOs = await prisma.purchaseOrder.findMany({
    where: { status: 'ACTIVE', buyerOrgId: buyerOrg.id },
    include: { poStacks: true },
  });
  for (const po of existingActivePOs) {
    const listingId = po.poStacks[0]?.listingId;
    if (listingId) {
      createdPOs.push({ poId: po.id, listingId, tons: po.contractedTons, growerIdx: -1 });
    }
  }

  let poCounter = 20001;
  for (const c of contractDefs) {
    const grower = growers[c.growerIdx];
    if (!grower) continue;

    const existingListing = await prisma.listing.findUnique({ where: { stackId: c.stackId } });
    if (existingListing) {
      console.log(`  Skipping ${c.stackId} — already exists`);
      // Still add to createdPOs if there's an active PO
      const po = await prisma.purchaseOrder.findFirst({ where: { status: 'ACTIVE', poStacks: { some: { listingId: existingListing.id } } } });
      if (po) createdPOs.push({ poId: po.id, listingId: existingListing.id, tons: po.contractedTons, growerIdx: c.growerIdx });
      continue;
    }

    const listing = await prisma.listing.create({
      data: {
        organizationId: grower.orgId,
        farmLocationId: grower.farmLocId,
        stackId: c.stackId,
        productType: c.productType,
        baleType: c.baleType,
        pricePerTon: c.price,
        estimatedTons: c.tons,
        moisturePercent: c.moisture,
        status: 'under_contract',
        firmPrice: true,
        isDeliveredPrice: false,
        truckingCoordinatedBy: 'buyer',
      },
    });

    const poNumber = `PO-${poCounter++}`;
    const existingPO = await prisma.purchaseOrder.findUnique({ where: { poNumber } });
    if (existingPO) continue;

    const signedDate = new Date(Date.now() - Math.random() * 30 * 24 * 3600 * 1000); // random date within last 30 days

    const po = await prisma.purchaseOrder.create({
      data: {
        poNumber,
        buyerOrgId: buyerOrg.id,
        growerOrgId: grower.orgId,
        destinationSiteId: buyerSite.id,
        contractedTons: c.tons,
        pricePerTon: c.price,
        deliveryStartDate: new Date('2026-01-15'),
        deliveryEndDate: new Date('2026-04-30'),
        maxMoisturePercent: c.moisture + 2,
        qualityNotes: c.notes,
        status: 'ACTIVE',
        deliveredTons: 0,
        signedByBuyerId: buyerAdmin.id,
        signedByGrowerId: grower.adminId,
        signedAt: signedDate,
        createdById: buyerAdmin.id,
      },
    });

    await prisma.pOStack.create({
      data: { poId: po.id, listingId: listing.id, allocatedTons: c.tons },
    });

    // Create signature audit logs (so contracts tab shows signatures)
    await prisma.auditLog.create({
      data: {
        userId: buyerAdmin.id,
        action: 'SIGN_PO',
        entityType: 'PurchaseOrder',
        entityId: po.id,
        newValues: { typedName: buyerAdmin.name, signatureImage: null, side: 'buyer', bothSigned: false },
        createdAt: new Date(signedDate.getTime() - 3600 * 1000), // 1 hour before final
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: grower.adminId,
        action: 'SIGN_PO',
        entityType: 'PurchaseOrder',
        entityId: po.id,
        newValues: { typedName: grower.name + ' Admin', signatureImage: null, side: 'grower', bothSigned: true },
        createdAt: signedDate,
      },
    });

    createdPOs.push({ poId: po.id, listingId: listing.id, tons: c.tons, growerIdx: c.growerIdx });
    console.log(`  Created contract ${poNumber}: ${c.productType} from ${grower.name} — ${c.tons}T @ $${c.price}/ton`);
  }

  // Also add audit logs for existing seed-active-pos POs that don't have them
  for (const existing of existingActivePOs) {
    const hasLogs = await prisma.auditLog.count({
      where: { entityType: 'PurchaseOrder', entityId: existing.id, action: 'SIGN_PO' },
    });
    if (hasLogs === 0) {
      const growerAdmin = await prisma.user.findFirst({ where: { organizationId: existing.growerOrgId, role: 'FARM_ADMIN' } });
      if (growerAdmin) {
        await prisma.auditLog.create({
          data: {
            userId: buyerAdmin.id,
            action: 'SIGN_PO',
            entityType: 'PurchaseOrder',
            entityId: existing.id,
            newValues: { typedName: buyerAdmin.name, signatureImage: null, side: 'buyer', bothSigned: false },
            createdAt: new Date(Date.now() - 7 * 24 * 3600 * 1000),
          },
        });
        await prisma.auditLog.create({
          data: {
            userId: growerAdmin.id,
            action: 'SIGN_PO',
            entityType: 'PurchaseOrder',
            entityId: existing.id,
            newValues: { typedName: growerAdmin.name, signatureImage: null, side: 'grower', bothSigned: true },
            createdAt: new Date(Date.now() - 7 * 24 * 3600 * 1000 + 3600 * 1000),
          },
        });
        console.log(`  Added signature logs for existing ${existing.poNumber}`);
      }
    }
  }

  console.log(`\n  ${createdPOs.length} POs available for load seeding.\n`);

  // --- Create 50 dummy loads spread across POs ---
  if (createdPOs.length === 0) {
    console.log('  No POs to seed loads against — skipping.');
    return;
  }

  const existingLoadCount = await prisma.load.count();
  let loadNum = 2001 + existingLoadCount;

  for (let i = 0; i < 50; i++) {
    const poData = createdPOs[i % createdPOs.length];
    const loadNumber = `LD-${loadNum++}`;

    const existing = await prisma.load.findUnique({ where: { loadNumber } });
    if (existing) { loadNum++; continue; }

    // Random realistic weights
    const baleCount = 20 + Math.floor(Math.random() * 30); // 20-49 bales
    const avgBaleWeight = 900 + Math.floor(Math.random() * 600); // 900-1500 lbs per bale
    const netWeight = baleCount * avgBaleWeight;
    const tareWeight = 25000 + Math.floor(Math.random() * 10000); // 25k-35k lbs
    const grossWeight = netWeight + tareWeight;
    const wetBales = Math.random() < 0.15 ? Math.floor(Math.random() * 3) : 0; // 15% chance of 1-2 wet bales
    const netTons = netWeight / 2000;

    // Random delivery date within last 45 days
    const daysAgo = Math.floor(Math.random() * 45);
    const deliveryDate = new Date(Date.now() - daysAgo * 24 * 3600 * 1000);

    const grower = poData.growerIdx >= 0 ? growers[poData.growerIdx] : growers[0];
    const enteredById = grower ? grower.adminId : buyerAdmin.id;

    await prisma.load.create({
      data: {
        loadNumber,
        poId: poData.poId,
        listingId: poData.listingId,
        grossWeight,
        tareWeight,
        totalBaleCount: baleCount,
        wetBalesCount: wetBales,
        deliveryDatetime: deliveryDate,
        enteredById,
        status: 'CONFIRMED',
        manualWeightEntry: true,
      },
    });

    // Update delivered tons
    await prisma.purchaseOrder.update({
      where: { id: poData.poId },
      data: { deliveredTons: { increment: netTons } },
    });
  }

  console.log('  Created 50 dummy loads across all POs.');
  console.log('\nDone! Check the Contracts tab and Loads tab.');
  console.log('Login: admin@demofeedlot.com / admin123');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
