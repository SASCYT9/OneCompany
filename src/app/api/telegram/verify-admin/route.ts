// Telegram Admin Verification API
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { verifyInitData } from '@/lib/telegram-auth';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const { initData } = await request.json();
    
    if (!initData) {
      return NextResponse.json({ isAdmin: false, error: 'No initData provided' });
    }
    
    const { isValid, userId } = verifyInitData(initData);
    
    if (!isValid || !userId) {
      return NextResponse.json({ isAdmin: false, error: 'Invalid initData' });
    }
    
    // Check if user is admin in database
    const telegramId = BigInt(userId);
    
    const admin = await prisma.telegramAdmin.findUnique({
      where: { telegramId, isActive: true },
    });
    
    if (admin) {
      return NextResponse.json({
        isAdmin: true,
        user: {
          id: userId,
          name: admin.name,
          role: admin.role,
          permissions: admin.permissions,
        },
      });
    }
    
    // Also check TelegramUser.isAdmin flag
    const user = await prisma.telegramUser.findUnique({
      where: { telegramId },
    });
    
    if (user?.isAdmin) {
      return NextResponse.json({
        isAdmin: true,
        user: {
          id: userId,
          name: user.firstName || user.username || 'Admin',
          role: 'admin',
        },
      });
    }
    
    // Check against hardcoded admin IDs (fallback)
    const adminIds = (process.env.TELEGRAM_ADMIN_IDS || '')
      .split(',')
      .map(id => id.trim())
      .filter(Boolean);
    
    if (adminIds.includes(String(userId))) {
      return NextResponse.json({
        isAdmin: true,
        user: {
          id: userId,
          name: 'Admin',
          role: 'admin',
        },
      });
    }
    
    return NextResponse.json({ isAdmin: false });
    
  } catch (error) {
    console.error('Admin verification error:', error);
    return NextResponse.json({ isAdmin: false, error: 'Internal error' });
  }
}
