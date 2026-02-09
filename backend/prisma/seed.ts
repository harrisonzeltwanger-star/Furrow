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

  console.log('Seed complete!');
  console.log('');
  console.log('Test accounts:');
  console.log(`  Buyer admin:  admin@demofeedlot.com / admin123`);
  console.log(`  Grower admin: admin@smithfarms.com / admin123`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
