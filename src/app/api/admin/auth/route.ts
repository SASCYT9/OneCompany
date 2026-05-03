import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import {
  ADMIN_SESSION_COOKIE,
  adminSessionCookieOptions,
  createSessionToken,
  isAdminRequestAuthenticated,
} from '@/lib/adminAuth';

const ADMIN_PASSWORD = (process.env.ADMIN_PASSWORD ?? 'admin123').trim();

export async function GET() {
  const cookieStore = await cookies();
  const authorized = isAdminRequestAuthenticated(cookieStore);

  if (!authorized) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({ authenticated: true });
}

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();
    const providedPassword = typeof password === 'string' ? password.trim() : '';

    if (providedPassword && providedPassword === ADMIN_PASSWORD) {
      const token = createSessionToken();
      const cookieStore = await cookies();
      cookieStore.set(ADMIN_SESSION_COOKIE, token, adminSessionCookieOptions);
      return NextResponse.json({ success: true });
    }

    const cookieStore = await cookies();
    cookieStore.delete(ADMIN_SESSION_COOKIE);
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
  } catch (error) {
    const cookieStore = await cookies();
    cookieStore.delete(ADMIN_SESSION_COOKIE);
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_SESSION_COOKIE);
  return NextResponse.json({ success: true });
}
