import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  ADMIN_SESSION_COOKIE,
  adminSessionCookieOptions,
  getAdminSession,
} from '@/lib/adminAuth';

export async function GET() {
  const session = getAdminSession(await cookies());

  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    session: {
      email: session.email,
      name: session.name,
      permissions: session.permissions,
      issuedAt: session.issuedAt,
    },
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

export const runtime = 'nodejs';
