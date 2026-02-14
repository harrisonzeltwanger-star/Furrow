import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding dummy listings across the US...');

  const passwordHash = await bcrypt.hash('grower123', 12);

  const growers = [
    { id: 'a0000000-0000-0000-0000-000000000001', name: 'High Plains Hay Co', email: 'admin@highplainshay.com', contact: 'Jake Turner' },
    { id: 'a0000000-0000-0000-0000-000000000002', name: 'Big Sky Forage', email: 'admin@bigskyforage.com', contact: 'Sarah Mitchell' },
    { id: 'a0000000-0000-0000-0000-000000000003', name: 'Valley Green Farms', email: 'admin@valleygreen.com', contact: 'Carlos Reyes' },
    { id: 'a0000000-0000-0000-0000-000000000004', name: 'Heartland Hay & Grain', email: 'admin@heartlandhay.com', contact: 'Mike Davis' },
    { id: 'a0000000-0000-0000-0000-000000000005', name: 'Bluegrass Bales', email: 'admin@bluegrassbales.com', contact: 'Tom Wheeler' },
    { id: 'a0000000-0000-0000-0000-000000000006', name: 'Desert Sun Hay', email: 'admin@desertsunhay.com', contact: 'Maria Lopez' },
    { id: 'a0000000-0000-0000-0000-000000000007', name: 'Cascade Forage LLC', email: 'admin@cascadeforage.com', contact: 'Ben Harper' },
    { id: 'a0000000-0000-0000-0000-000000000008', name: 'Ozark Hay Supply', email: 'admin@ozarkhay.com', contact: 'Dale Crawford' },
    { id: 'a0000000-0000-0000-0000-000000000009', name: 'Peach State Hay', email: 'admin@peachstatehay.com', contact: 'Lena Brooks' },
    { id: 'a0000000-0000-0000-0000-000000000010', name: 'Cornhusker Forage', email: 'admin@cornhuskerforage.com', contact: 'Steve Olsen' },
  ];

  const farmLocations = [
    // Texas
    { id: 'b0000000-0000-0000-0000-000000000001', orgIdx: 0, name: 'Panhandle North', address: '2100 Ranch Rd, Amarillo, TX', state: 'TX', lat: 35.2220, lng: -101.8313 },
    { id: 'b0000000-0000-0000-0000-000000000002', orgIdx: 0, name: 'Lubbock Field', address: '4400 Farm Rd 1585, Lubbock, TX', state: 'TX', lat: 33.5779, lng: -101.8552 },
    // Montana
    { id: 'b0000000-0000-0000-0000-000000000003', orgIdx: 1, name: 'Yellowstone Valley', address: '780 Hwy 12, Billings, MT', state: 'MT', lat: 45.7833, lng: -108.5007 },
    { id: 'b0000000-0000-0000-0000-000000000004', orgIdx: 1, name: 'Flathead Ranch', address: '1200 Hwy 93, Kalispell, MT', state: 'MT', lat: 48.1920, lng: -114.3168 },
    // California
    { id: 'b0000000-0000-0000-0000-000000000005', orgIdx: 2, name: 'Central Valley', address: '6700 Hwy 99, Fresno, CA', state: 'CA', lat: 36.7378, lng: -119.7871 },
    { id: 'b0000000-0000-0000-0000-000000000006', orgIdx: 2, name: 'Imperial Valley', address: '300 E Cole Blvd, El Centro, CA', state: 'CA', lat: 32.7920, lng: -115.5631 },
    // Nebraska
    { id: 'b0000000-0000-0000-0000-000000000007', orgIdx: 3, name: 'Platte River Bottom', address: '1500 Platte Rd, Kearney, NE', state: 'NE', lat: 40.6994, lng: -99.0832 },
    { id: 'b0000000-0000-0000-0000-000000000008', orgIdx: 3, name: 'Sandhills Meadow', address: '900 Hwy 2, Valentine, NE', state: 'NE', lat: 42.8728, lng: -100.5510 },
    // Kentucky
    { id: 'b0000000-0000-0000-0000-000000000009', orgIdx: 4, name: 'Bourbon County', address: '200 Paris Pike, Lexington, KY', state: 'KY', lat: 38.0406, lng: -84.5037 },
    // Arizona
    { id: 'b0000000-0000-0000-0000-000000000010', orgIdx: 5, name: 'Yuma Fields', address: '3200 S Ave 3E, Yuma, AZ', state: 'AZ', lat: 32.6927, lng: -114.6277 },
    // Washington
    { id: 'b0000000-0000-0000-0000-000000000011', orgIdx: 6, name: 'Ellensburg Valley', address: '1800 Vantage Hwy, Ellensburg, WA', state: 'WA', lat: 46.9965, lng: -120.5478 },
    { id: 'b0000000-0000-0000-0000-000000000012', orgIdx: 6, name: 'Moses Lake Farm', address: '4500 Rd 7 NE, Moses Lake, WA', state: 'WA', lat: 47.1301, lng: -119.2781 },
    // Missouri
    { id: 'b0000000-0000-0000-0000-000000000013', orgIdx: 7, name: 'Ozark Hollow', address: '700 State Hwy 76, Branson, MO', state: 'MO', lat: 36.6437, lng: -93.2185 },
    // Georgia
    { id: 'b0000000-0000-0000-0000-000000000014', orgIdx: 8, name: 'Piedmont Fields', address: '1100 Hwy 441, Madison, GA', state: 'GA', lat: 33.5960, lng: -83.4680 },
    // Iowa
    { id: 'b0000000-0000-0000-0000-000000000015', orgIdx: 9, name: 'Cedar Rapids East', address: '3300 Hwy 30, Cedar Rapids, IA', state: 'IA', lat: 41.9779, lng: -91.6656 },
    { id: 'b0000000-0000-0000-0000-000000000016', orgIdx: 9, name: 'Des Moines South', address: '800 SE Connector, Des Moines, IA', state: 'IA', lat: 41.5868, lng: -93.6250 },
  ];

  const listings = [
    // Texas - High Plains Hay Co
    { flIdx: 0, product: 'Alfalfa Hay', bale: 'Large Square', price: 245, tons: 600, moisture: 10.5, firm: false, notes: 'Premium 3rd cutting, dairy quality, RFV 190+' },
    { flIdx: 0, product: 'Bermuda Hay', bale: 'Round Bale', price: 165, tons: 800, moisture: 11.2, firm: true, notes: 'Clean coastal bermuda, no weeds, barn stored' },
    { flIdx: 1, product: 'Sudan Grass', bale: 'Large Square', price: 140, tons: 450, moisture: 9.8, firm: false, notes: 'Sorghum-sudan, great feed value for beef cattle' },
    { flIdx: 1, product: 'Oat Hay', bale: 'Round Bale', price: 155, tons: 300, moisture: 10.0, firm: false, notes: 'Cut at boot stage, good protein' },
    // Montana - Big Sky Forage
    { flIdx: 2, product: 'Timothy Hay', bale: 'Small Square', price: 280, tons: 200, moisture: 12.0, firm: true, notes: 'Horse-quality timothy, no dust, bright green' },
    { flIdx: 2, product: 'Grass Mix', bale: 'Large Square', price: 175, tons: 550, moisture: 11.5, firm: false, notes: 'Timothy-brome mix, good for cattle' },
    { flIdx: 3, product: 'Alfalfa Hay', bale: 'Large Square', price: 230, tons: 400, moisture: 11.0, firm: false, notes: '2nd cutting alfalfa, well-cured' },
    // California - Valley Green Farms
    { flIdx: 4, product: 'Alfalfa Hay', bale: 'Large Square', price: 295, tons: 1000, moisture: 9.5, firm: true, notes: 'Export-grade alfalfa, lab tested, supreme quality' },
    { flIdx: 4, product: 'Orchard Grass', bale: 'Small Square', price: 310, tons: 150, moisture: 10.2, firm: true, notes: 'Pure orchard grass, horse quality, no fescue' },
    { flIdx: 5, product: 'Bermuda Hay', bale: 'Large Square', price: 185, tons: 700, moisture: 10.8, firm: false, notes: 'Imperial Valley bermuda, irrigated, clean' },
    // Nebraska - Heartland Hay & Grain
    { flIdx: 6, product: 'Prairie Hay', bale: 'Round Bale', price: 130, tons: 900, moisture: 11.5, firm: false, notes: 'Native prairie hay, good for wintering cows' },
    { flIdx: 6, product: 'Alfalfa Hay', bale: 'Large Square', price: 220, tons: 500, moisture: 12.2, firm: false, notes: '1st cutting alfalfa, some grass mixed in' },
    { flIdx: 7, product: 'Grass Mix', bale: 'Round Bale', price: 120, tons: 600, moisture: 13.0, firm: false, notes: 'Sandhills meadow hay, native grasses' },
    // Kentucky - Bluegrass Bales
    { flIdx: 8, product: 'Fescue Hay', bale: 'Round Bale', price: 145, tons: 350, moisture: 12.5, firm: false, notes: 'Endophyte-free fescue, good for horses' },
    { flIdx: 8, product: 'Orchard Grass', bale: 'Small Square', price: 260, tons: 180, moisture: 11.0, firm: true, notes: 'Premium orchard grass, barn stored, no rain' },
    // Arizona - Desert Sun Hay
    { flIdx: 9, product: 'Alfalfa Hay', bale: 'Large Square', price: 275, tons: 850, moisture: 9.0, firm: true, notes: 'Desert-grown alfalfa, sun cured, low moisture' },
    { flIdx: 9, product: 'Bermuda Hay', bale: 'Large Square', price: 190, tons: 500, moisture: 9.5, firm: false, notes: 'Yuma bermuda, 5 cuttings/year' },
    // Washington - Cascade Forage
    { flIdx: 10, product: 'Timothy Hay', bale: 'Large Square', price: 265, tons: 350, moisture: 11.8, firm: false, notes: 'Pacific NW timothy, bright color, horse quality' },
    { flIdx: 11, product: 'Alfalfa Hay', bale: 'Large Square', price: 235, tons: 600, moisture: 10.5, firm: false, notes: 'Columbia Basin alfalfa, irrigated, consistent' },
    { flIdx: 11, product: 'Grass Mix', bale: 'Round Bale', price: 150, tons: 400, moisture: 12.0, firm: false, notes: 'Orchard-timothy-rye mix, cattle feed' },
    // Missouri - Ozark Hay Supply
    { flIdx: 12, product: 'Fescue Hay', bale: 'Round Bale', price: 135, tons: 500, moisture: 13.0, firm: false, notes: 'Ozark fescue, good for cow-calf operations' },
    { flIdx: 12, product: 'Prairie Hay', bale: 'Round Bale', price: 125, tons: 400, moisture: 12.5, firm: false, notes: 'Native warm-season mix, late summer cut' },
    // Georgia - Peach State Hay
    { flIdx: 13, product: 'Bermuda Hay', bale: 'Round Bale', price: 170, tons: 600, moisture: 11.5, firm: false, notes: 'Tifton 85 bermuda, fertilized, good protein' },
    { flIdx: 13, product: 'Bermuda Hay', bale: 'Small Square', price: 195, tons: 200, moisture: 11.0, firm: true, notes: 'Horse-quality bermuda, small bales, barn stored' },
    // Iowa - Cornhusker Forage
    { flIdx: 14, product: 'Alfalfa Hay', bale: 'Large Square', price: 215, tons: 450, moisture: 12.0, firm: false, notes: 'Iowa alfalfa, 2nd cutting, good leaf content' },
    { flIdx: 14, product: 'Grass Mix', bale: 'Round Bale', price: 140, tons: 350, moisture: 12.8, firm: false, notes: 'Brome-alfalfa mix, tested at 14% protein' },
    { flIdx: 15, product: 'Oat Hay', bale: 'Large Square', price: 160, tons: 300, moisture: 10.5, firm: false, notes: 'Fall oat hay, excellent energy content' },
  ];

  // Create orgs + admins
  for (const g of growers) {
    await prisma.organization.upsert({
      where: { id: g.id },
      update: {},
      create: { id: g.id, name: g.name, billingContactName: g.contact },
    });
    await prisma.user.upsert({
      where: { email: g.email },
      update: {},
      create: { email: g.email, passwordHash, name: g.contact, organizationId: g.id, role: 'FARM_ADMIN' },
    });
  }

  // Create farm locations
  for (const fl of farmLocations) {
    await prisma.farmLocation.upsert({
      where: { id: fl.id },
      update: {},
      create: { id: fl.id, organizationId: growers[fl.orgIdx].id, name: fl.name, address: fl.address, state: fl.state, latitude: fl.lat, longitude: fl.lng },
    });
  }

  // Create listings
  let stackNum = 200001;
  for (const l of listings) {
    const fl = farmLocations[l.flIdx];
    const baleCount = Math.floor(l.tons * (l.bale === 'Small Square' ? 6 : l.bale === 'Round Bale' ? 1.5 : 1.6));
    await prisma.listing.create({
      data: {
        organizationId: growers[fl.orgIdx].id,
        farmLocationId: fl.id,
        stackId: String(stackNum++),
        productType: l.product,
        baleType: l.bale,
        pricePerTon: l.price,
        estimatedTons: l.tons,
        baleCount: baleCount,
        moisturePercent: l.moisture,
        status: 'available',
        firmPrice: l.firm,
        notes: l.notes,
      },
    });
  }

  console.log(`Created ${growers.length} grower organizations`);
  console.log(`Created ${farmLocations.length} farm locations across ${new Set(farmLocations.map(f => f.state)).size} states`);
  console.log(`Created ${listings.length} available listings`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
