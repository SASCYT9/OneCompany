// Telegram Admin Verification API
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';

// Verify Telegram WebApp initData
function verifyInitData(initData: string): { isValid: boolean; userId?: number } {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    params.delete('hash');
    
    // Sort params alphabetically
    const sortedParams = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');
    
    // Create secret key
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(TELEGRAM_BOT_TOKEN)
      .digest();
    
    // Calculate hash
    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(sortedParams)
      .digest('hex');
    
    if (calculatedHash !== hash) {
      return { isValid: false };
    }
    
    // Extract user data
    const userDataStr = params.get('user');
    if (userDataStr) {
      const userData = JSON.parse(userDataStr);
      return { isValid: true, userId: userData.id };
    }
    
    return { isValid: false };
  } catch (error) {
    console.error('InitData verification error:', error);
    return { isValid: false };
  }
}

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
