import { prisma } from './src/lib/prisma';
prisma.shopProduct.findFirst().then(console.log).catch(console.error).finally(()=>process.exit(0));
