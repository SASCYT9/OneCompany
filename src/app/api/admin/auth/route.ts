import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_SESSION_COOKIE, adminSessionCookieOptions, createSessionToken } from '@/lib/adminAuth';
import { ensureAdminBootstrap } from '@/lib/adminRbac';
import { consumeRateLimit, getRequestIp } from '@/lib/shopPublicRateLimit';
import { prisma } from '@/lib/prisma';

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW_PER_IP = 20;
const MAX_PER_WINDOW_GLOBAL = 200;

function getAdminPasswordOrNull() {
  const configured = (process.env.ADMIN_PASSWORD || '').trim();
  if (configured) return configured;

  const isProd = process.env.NODE_ENV === 'production';
  if (isProd) return null;

  const allowFallback = (process.env.ALLOW_DEV_ADMIN_PASSWORD_FALLBACK || '').trim() === '1';
  return allowFallback ? 'admin123' : null;
}

export async function POST(request: NextRequest) {
  try {
    const ip = getRequestIp(request.headers);
    if (
      !consumeRateLimit({
        keyParts: ['admin-auth', ip],
        windowMs: WINDOW_MS,
        maxPerWindow: MAX_PER_WINDOW_PER_IP,
      }) ||
      !consumeRateLimit({
        keyParts: ['admin-auth-global'],
        windowMs: WINDOW_MS,
        maxPerWindow: MAX_PER_WINDOW_GLOBAL,
      })
    ) {
      return NextResponse.json({ error: 'Too many attempts' }, { status: 429 });
    }

    const adminPassword = getAdminPasswordOrNull();
    if (!adminPassword) {
      return NextResponse.json(
        {
          error: 'Admin auth is not configured',
          hint:
            process.env.NODE_ENV === 'production'
              ? 'Set ADMIN_PASSWORD in environment variables'
              : 'Set ADMIN_PASSWORD or ALLOW_DEV_ADMIN_PASSWORD_FALLBACK=1 for local testing',
        },
        { status: 500 }
      );
    }

    const { password } = await request.json();

    if (String(password ?? '') === adminPassword) {
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
