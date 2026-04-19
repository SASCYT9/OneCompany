import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_SESSION_COOKIE, adminSessionCookieOptions, createSessionToken, getAdminSession } from '@/lib/adminAuth';
import { ensureAdminBootstrap } from '@/lib/adminRbac';
import { consumeRateLimit, getRequestIp } from '@/lib/shopPublicRateLimit';
import { prisma } from '@/lib/prisma';
import { verifyPassword } from '@/lib/hashPassword';
import { cookies } from 'next/headers';

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
      !(await consumeRateLimit({
        keyParts: ['admin-auth', ip],
        windowMs: WINDOW_MS,
        maxPerWindow: MAX_PER_WINDOW_PER_IP,
      })) ||
      !(await consumeRateLimit({
        keyParts: ['admin-auth-global'],
        windowMs: WINDOW_MS,
        maxPerWindow: MAX_PER_WINDOW_GLOBAL,
      }))
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

    const { email, password } = await request.json();
    const providedEmail = String(email || '').trim().toLowerCase();

    // 1. Check Global Fallback
    const fallbackEmail = (process.env.ADMIN_EMAIL || 'admin@onecompany.local').trim().toLowerCase();
    if (providedEmail === fallbackEmail && String(password ?? '') === adminPassword) {
      const admin = await ensureAdminBootstrap(prisma);
      const response = NextResponse.json({ success: true });
      response.cookies.set(
        ADMIN_SESSION_COOKIE,
        createSessionToken({
          email: admin.email,
          name: admin.name || 'Admin',
          permissions: admin.permissions,
        }),
        adminSessionCookieOptions
      );
      return response;
    } 

    // 2. Check Database Individual User
    if (providedEmail) {
      const dbUser = await prisma.adminUser.findUnique({
        where: { email: providedEmail },
        include: { roles: { include: { role: true } } }
      });

      if (dbUser && dbUser.isActive && (dbUser as any).passwordHash) {
        if (verifyPassword(String(password ?? ''), (dbUser as any).passwordHash)) {
          // Update last login
          await prisma.adminUser.update({
            where: { id: dbUser.id },
            data: { lastLoginAt: new Date() }
          });

          // Aggregate permissions
          const permissions = dbUser.roles.flatMap(r => r.role.permissions);

          const response = NextResponse.json({ success: true });
          response.cookies.set(
            ADMIN_SESSION_COOKIE,
            createSessionToken({
              email: dbUser.email,
              name: dbUser.name || 'Admin',
              permissions,
            }),
            adminSessionCookieOptions
          );
          return response;
        }
      }
    }

    return NextResponse.json(
      { error: 'Invalid email or password' },
      { status: 401 }
    );
  } catch {
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';

export async function GET() {
  const cookieStore = await cookies();
  const session = getAdminSession(cookieStore);

  return NextResponse.json({
    authenticated: Boolean(session),
    session,
  });
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(ADMIN_SESSION_COOKIE, '', {
    ...adminSessionCookieOptions,
    maxAge: 0,
  });
  return response;
}
