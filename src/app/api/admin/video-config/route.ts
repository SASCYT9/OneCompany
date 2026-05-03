import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { assertAdminRequest } from '@/lib/adminAuth';
import { readVideoConfig, writeVideoConfig } from '@/lib/videoConfig';

export async function GET() {
  try {
    const cookieStore = await cookies();
    assertAdminRequest(cookieStore);
    const config = await readVideoConfig();
    return NextResponse.json(config);
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to load video config' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    assertAdminRequest(cookieStore);
    const { heroVideo } = await request.json();
    const config = await readVideoConfig();
    const updated = { ...config, heroVideo };
    await writeVideoConfig(updated);
    return NextResponse.json(updated);
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to save video config' }, { status: 500 });
  }
}
