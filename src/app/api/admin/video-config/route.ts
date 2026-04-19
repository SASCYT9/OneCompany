import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { assertAdminRequest } from '@/lib/adminAuth';
import { readVideoConfig, writeVideoConfig } from '@/lib/videoConfig';

export async function GET() {
  try {
    const cookieStore = await cookies();
    assertAdminRequest(cookieStore);
    return NextResponse.json(await readVideoConfig());
  } catch {
    return NextResponse.json(
      { error: 'Failed to load video config' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    assertAdminRequest(cookieStore);
    const { heroVideo, heroEnabled, heroVideoMobile, heroPoster } = await request.json();

    return NextResponse.json(
      await writeVideoConfig({
        ...(typeof heroVideo === 'string' ? { heroVideo } : {}),
        ...(typeof heroEnabled === 'boolean' ? { heroEnabled } : {}),
        ...(typeof heroVideoMobile === 'string' ? { heroVideoMobile } : {}),
        ...(typeof heroPoster === 'string' ? { heroPoster } : {}),
      })
    );
  } catch {
    return NextResponse.json(
      { error: 'Failed to save video config' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
