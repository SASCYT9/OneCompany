import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function addAdmin(telegramId: bigint, name: string, role: string = 'admin') {
  try {
    const admin = await prisma.telegramAdmin.upsert({
      where: { telegramId },
      update: { 
        isActive: true,
        role,
        updatedAt: new Date(),
      },
      create: {
        telegramId,
        name,
        role,
        permissions: ['messages', 'users', 'settings', 'analytics'],
        isActive: true,
      },
    });
    
    console.log('✅ Адмін додано/оновлено:', {
      id: admin.id,
      telegramId: admin.telegramId.toString(),
      name: admin.name,
      role: admin.role,
      permissions: admin.permissions,
    });
    
    return admin;
  } catch (error) {
    console.error('❌ Помилка:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Додаємо першого superadmin
addAdmin(BigInt(478891619), 'Owner', 'superadmin')
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
