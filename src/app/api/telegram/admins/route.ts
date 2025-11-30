// Admin Management API
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Secret for initial setup (use ADMIN_API_SECRET from env)
const SETUP_SECRET = process.env.ADMIN_API_SECRET || process.env.TELEGRAM_BOT_TOKEN?.slice(-20);

// GET - List admins or add first admin
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');
  const action = searchParams.get('action');
  const telegramId = searchParams.get('id');
  const name = searchParams.get('name');
  
  if (secret !== SETUP_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // List all admins
  if (action === 'list') {
    const admins = await prisma.telegramAdmin.findMany({
      where: { isActive: true },
      select: {
        id: true,
        telegramId: true,
        username: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });
    
    return NextResponse.json({
      admins: admins.map(a => ({
        ...a,
        telegramId: a.telegramId.toString(),
      })),
    });
  }
  
  // Add admin
  if (action === 'add' && telegramId) {
    const role = searchParams.get('role') || 'admin';
    const isSuperadmin = role === 'superadmin';
    
    const admin = await prisma.telegramAdmin.upsert({
      where: { telegramId: BigInt(telegramId) },
      update: {
        name: name || 'Admin',
        role: role,
        permissions: isSuperadmin ? ['messages', 'users', 'settings', 'analytics'] : ['messages'],
        isActive: true,
      },
      create: {
        telegramId: BigInt(telegramId),
        name: name || 'Admin',
        role: role,
        permissions: isSuperadmin ? ['messages', 'users', 'settings', 'analytics'] : ['messages'],
      },
    });
    
    // Also mark user as admin
    await prisma.telegramUser.updateMany({
      where: { telegramId: BigInt(telegramId) },
      data: { isAdmin: true },
    });
    
    return NextResponse.json({
      success: true,
      admin: {
        id: admin.id,
        telegramId: admin.telegramId.toString(),
        name: admin.name,
        role: admin.role,
      },
    });
  }
  
  // Remove admin
  if (action === 'remove' && telegramId) {
    await prisma.telegramAdmin.updateMany({
      where: { telegramId: BigInt(telegramId) },
      data: { isActive: false },
    });
    
    await prisma.telegramUser.updateMany({
      where: { telegramId: BigInt(telegramId) },
      data: { isAdmin: false },
    });
    
    return NextResponse.json({ success: true, removed: telegramId });
  }
  
  return NextResponse.json({
    message: 'Admin Management API',
    usage: {
      list: '?action=list&secret=YOUR_SECRET',
      add: '?action=add&id=TELEGRAM_ID&name=NAME&role=admin|superadmin&secret=YOUR_SECRET',
      remove: '?action=remove&id=TELEGRAM_ID&secret=YOUR_SECRET',
    },
    tip: 'Your Telegram ID: send /start to @userinfobot',
  });
}
