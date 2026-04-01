const { PrismaClient } = require('@prisma/client');

async function fix() {
  const prisma = new PrismaClient({
    datasources: { db: { url: process.env.DATABASE_URL } }
  });
  
  try {
    const res = await prisma.$executeRawUnsafe(`
      SELECT pg_terminate_backend(pid) 
      FROM pg_stat_activity 
      WHERE pid <> pg_backend_pid()
        AND usename = current_user;
    `);
    console.log('Killed all backend sessions for current user!', res);
  } catch (e) {
    console.log('Error terminating', e.message);
  } finally {
    await prisma.$disconnect();
  }
}
fix();
