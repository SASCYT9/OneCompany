#!/usr/bin/env node
import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { runUrbanGpPortalSync } from '@/lib/urbanGpPortalSync';

config({ path: '.env.local' });
config({ path: '.env' });

const args = new Set(process.argv.slice(2));
const commit = args.has('--commit');
const dryRun = args.has('--dry-run') || !commit;

async function main() {
  const prisma = new PrismaClient();

  try {
    const result = await runUrbanGpPortalSync(prisma, {
      commit,
    });

    console.log(
      JSON.stringify(
        {
          mode: commit ? 'commit' : dryRun ? 'dry-run' : 'unknown',
          handlesCount: result.handlesCount,
          pagesCrawled: result.pagesCrawled,
          candidateHandles: result.candidateHandles,
          validatedUrbanProducts: result.validatedUrbanProducts,
          retryCount: result.retryCount,
          sourceCount: result.sourceCount,
          importableCount: result.importableItems.length,
          skippedCount: result.skippedItems.length,
          blockersCount: result.blockers.length,
          unmappedVehicleBrands: result.unmappedVehicleBrands,
          unmappedVehicleModels: result.unmappedVehicleModels,
          unmappedCategories: result.unmappedCategories,
          committed: result.committed,
          archivedCount: result.archivedCount,
          upsertedCount: result.upsertedCount,
          backupPath: result.backupPath,
          blockers: result.blockers,
        },
        null,
        2
      )
    );

    if (result.blockers.length) {
      process.exitCode = 1;
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
