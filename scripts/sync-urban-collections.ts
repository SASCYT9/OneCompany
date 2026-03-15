import { PrismaClient } from '@prisma/client';
import { syncUrbanCollectionAssignments } from '../src/lib/shopAdminCollections';

async function main() {
  const prisma = new PrismaClient();

  try {
    const result = await syncUrbanCollectionAssignments(prisma);
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Failed to sync Urban collections');
  console.error(error);
  process.exit(1);
});
