import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { createRequire } from 'module';
import { runShopCsvImport } from '@/lib/shopAdminImports';

dotenv.config({ path: '.env.local' });

const require = createRequire(import.meta.url);
const { PrismaClient } = require('@prisma/client') as typeof import('@prisma/client');
const prisma = new PrismaClient();

function resolveArgPath(value: string) {
  if (!value) return value;
  return path.isAbsolute(value) ? value : path.join(process.cwd(), value);
}

async function main() {
  const csvPathArg = process.argv[2] || 'products_export_urban.csv';
  const actionArg = String(process.argv[3] || 'commit').trim().toLowerCase();
  const conflictMode = (process.argv[4] || 'UPDATE').toString();

  const csvPath = resolveArgPath(csvPathArg);
  const csvText = fs.readFileSync(csvPath, 'utf8');
  if (!csvText.trim()) {
    throw new Error(`CSV is empty: ${csvPath}`);
  }

  const session = {
    email: 'local-dev@onecompany.local',
    name: 'Local Dev',
    permissions: ['*'],
    issuedAt: Date.now(),
    nonce: 'local',
  };

  const result = await runShopCsvImport(prisma, session, {
    csvText,
    action: actionArg === 'dry-run' ? 'dry-run' : 'commit',
    supplierName: 'local',
    sourceFilename: path.basename(csvPath),
    templateId: null,
    conflictMode,
  });

  // eslint-disable-next-line no-console
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

