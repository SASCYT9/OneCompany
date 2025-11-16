import { NextRequest, NextResponse } from 'next/server';

// Trim any whitespace/newline characters from environment variable
const ADMIN_PASSWORD = (process.env.ADMIN_PASSWORD || 'admin123').trim();

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();

    if (password === ADMIN_PASSWORD) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json(
        { error: 'Invalid password' },
        { status: 401 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
