const { PrismaClient } = require('@prisma/client');

async function fix() {
  const prisma = new PrismaClient({
    datasources: { db: { url: "postgresql://postgres.zllvamstmtpjdbwtsfod:bFeNqSlYFSO3NnD1@aws-1-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require" } }
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
