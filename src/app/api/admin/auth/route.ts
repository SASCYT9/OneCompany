import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { ADMIN_SESSION_COOKIE, adminSessionCookieOptions, createSessionToken } from '@/lib/adminAuth';
import { ensureAdminBootstrap } from '@/lib/adminRbac';

// Trim any whitespace/newline characters from environment variable
const ADMIN_PASSWORD = (process.env.ADMIN_PASSWORD || 'admin123').trim();
const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();

    if (password === ADMIN_PASSWORD) {
      const admin = await ensureAdminBootstrap(prisma);
      const response = NextResponse.json({ success: true });
      response.cookies.set(
        ADMIN_SESSION_COOKIE,
        createSessionToken({
          email: admin.email,
          name: admin.name,
          permissions: admin.permissions,
        }),
        adminSessionCookieOptions
      );
      return response;
    } else {
      return NextResponse.json(
        { error: 'Invalid password' },
        { status: 401 }
      );
    }
  } catch {
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
