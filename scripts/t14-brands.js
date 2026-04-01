const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.$queryRaw`SELECT brand, COUNT(*)::int as cnt FROM turn14_catalog_items GROUP BY brand ORDER BY cnt DESC`
  .then(r => r.forEach(b => console.log(b.cnt + 'x\t' + b.brand)))
  .finally(() => p.$disconnect());
