import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_SESSION_COOKIE, adminSessionCookieOptions, createSessionToken } from '@/lib/adminAuth';
import { ensureAdminBootstrap } from '@/lib/adminRbac';
import { prisma } from '@/lib/prisma';
import { getRequiredEnv } from '@/lib/runtimeEnv';

export async function POST(request: NextRequest) {
  try {
    const adminPassword = getRequiredEnv('ADMIN_PASSWORD', 'admin123');
    const { password } = await request.json();

    if (password === adminPassword) {
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
