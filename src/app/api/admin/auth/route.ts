import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_SESSION_COOKIE, adminSessionCookieOptions, createSessionToken } from '@/lib/adminAuth';

// Trim any whitespace/newline characters from environment variable
const ADMIN_PASSWORD = (process.env.ADMIN_PASSWORD || 'admin123').trim();

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();

    if (password === ADMIN_PASSWORD) {
      const response = NextResponse.json({ success: true });
      response.cookies.set(ADMIN_SESSION_COOKIE, createSessionToken(), adminSessionCookieOptions);
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
