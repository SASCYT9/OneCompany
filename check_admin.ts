import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const admins = await prisma.adminUser.findMany({
    select: { id: true, email: true, isActive: true }
  });
  console.log("Admin Users in DB:", admins);
}

main().catch(console.error).finally(() => prisma.$disconnect());
