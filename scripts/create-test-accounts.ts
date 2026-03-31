import { PrismaClient } from '@prisma/client';
import { hashShopCustomerPassword } from '../src/lib/shopCustomers';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await hashShopCustomerPassword('12341234');
  
  const b2bCustomer = await prisma.shopCustomer.upsert({
    where: { email: 'b2b@gmail.com' },
    update: { group: 'B2B_APPROVED' },
    create: {
      email: 'b2b@gmail.com',
      firstName: 'Test',
      lastName: 'B2B',
      group: 'B2B_APPROVED',
      account: {
        create: {
          passwordHash,
        }
      }
    }
  });

  const b2cCustomer = await prisma.shopCustomer.upsert({
    where: { email: 'b2c@gmail.com' },
    update: {},
    create: {
      email: 'b2c@gmail.com',
      firstName: 'Test',
      lastName: 'B2C',
      account: {
        create: {
          passwordHash,
        }
      }
    }
  });

  console.log('✅ Created test accounts:');
  console.log('B2B:', b2bCustomer.email);
  console.log('B2C:', b2cCustomer.email);
  console.log('Password for both: 12341234');
  
  await prisma.$disconnect();
}
main().catch(console.error);
