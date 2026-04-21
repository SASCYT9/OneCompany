#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const prismaClientDir = path.join(process.cwd(), 'node_modules', '.prisma', 'client');
const TEMP_ENGINE_PATTERN = /^(?:lib)?query_engine.*\.tmp\d+$/i;

function formatMegabytes(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

if (!fs.existsSync(prismaClientDir)) {
  console.log('[SKIP] Prisma client directory not found; nothing to clean.');
  process.exit(0);
}

let removedCount = 0;
let removedBytes = 0;

for (const entry of fs.readdirSync(prismaClientDir, { withFileTypes: true })) {
  if (!entry.isFile() || !TEMP_ENGINE_PATTERN.test(entry.name)) {
    continue;
  }

  const targetPath = path.join(prismaClientDir, entry.name);
  const size = fs.statSync(targetPath).size;
  fs.rmSync(targetPath, { force: true });
  removedCount += 1;
  removedBytes += size;
}

if (!removedCount) {
  console.log('[OK] No Prisma temp engine files found.');
  process.exit(0);
}

console.log(
  `[OK] Removed ${removedCount} Prisma temp engine file(s) from node_modules/.prisma/client (${formatMegabytes(removedBytes)}).`
);
