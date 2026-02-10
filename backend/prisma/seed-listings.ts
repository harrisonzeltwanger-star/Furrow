import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Use the grower org (Smith Farms)
  const growerOrg = await prisma.organization.findFirst({ where: { type: 'GROWER' } });
  if (!growerOrg) {
    console.error('No grower org found. Run the main seed first.');
    return;
  }

  const locations = [
    { name: 'Buckeye South Field', address: 'Buckeye, AZ 85326', latitude: 33.3703, longitude: -112.5838 },
    { name: 'Eloy Irrigated Parcel', address: 'Eloy, AZ 85131', latitude: 32.7559, longitude: -111.5546 },
    { name: 'Marana River Bottom', address: 'Marana, AZ 85653', latitude: 32.4368, longitude: -111.2253 },
    { name: 'Yuma Valley Ranch', address: 'Yuma, AZ 85364', latitude: 32.6927, longitude: -114.6277 },
    { name: 'Queen Creek Pivot', address: 'Queen Creek, AZ 85142', latitude: 33.2487, longitude: -111.6343 },
  ];

  console.log('Creating farm locations...');
  const createdLocations = [];
  for (const loc of locations) {
    const created = await prisma.farmLocation.create({
      data: { ...loc, organizationId: growerOrg.id },
    });
    createdLocations.push(created);
  }

  const listings = [
    { farmIdx: 0, productType: 'Alfalfa', pricePerTon: 265, estimatedTons: 420, baleCount: 840, moisturePercent: 11.2, notes: 'Premium dairy-quality alfalfa, 3rd cutting' },
    { farmIdx: 0, productType: 'Alfalfa', pricePerTon: 240, estimatedTons: 280, baleCount: 560, moisturePercent: 12.8, notes: '4th cutting, good color and leaf retention' },
    { farmIdx: 1, productType: 'Bermuda', pricePerTon: 195, estimatedTons: 600, baleCount: 1200, moisturePercent: 10.5, notes: 'Clean bermuda grass, no weeds, barn stored' },
    { farmIdx: 2, productType: 'Alfalfa', pricePerTon: 255, estimatedTons: 350, baleCount: 700, moisturePercent: 11.8, notes: '2nd cutting, RFV tested at 185' },
    { farmIdx: 2, productType: 'Sudan Grass', pricePerTon: 165, estimatedTons: 500, baleCount: 1000, moisturePercent: 9.4, notes: 'Sudan grass hay, great for beef cattle' },
    { farmIdx: 3, productType: 'Alfalfa', pricePerTon: 275, estimatedTons: 700, baleCount: 1400, moisturePercent: 10.2, notes: 'Top-grade alfalfa, lab tested, export quality' },
    { farmIdx: 3, productType: 'Timothy/Orchard', pricePerTon: 220, estimatedTons: 200, baleCount: 400, moisturePercent: 12.0, notes: 'Timothy-orchard mix, ideal for horses' },
    { farmIdx: 4, productType: 'Bermuda', pricePerTon: 180, estimatedTons: 450, baleCount: 900, moisturePercent: 11.0, notes: 'Good bermuda, field stored with tarps' },
  ];

  console.log('Creating listings...');
  let stackNum = 100001;
  for (const item of listings) {
    await prisma.listing.create({
      data: {
        organizationId: growerOrg.id,
        farmLocationId: createdLocations[item.farmIdx].id,
        stackId: String(stackNum++),
        productType: item.productType,
        pricePerTon: item.pricePerTon,
        estimatedTons: item.estimatedTons,
        baleCount: item.baleCount,
        moisturePercent: item.moisturePercent,
        notes: item.notes,
        status: 'available',
      },
    });
  }

  console.log(`Seed complete! Created ${createdLocations.length} farm locations and ${listings.length} listings in Arizona.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
