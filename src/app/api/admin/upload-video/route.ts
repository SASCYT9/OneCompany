import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { assertAdminRequest } from '@/lib/adminAuth';
import { readVideoConfig, writeVideoConfig } from '@/lib/videoConfig';

const videosDir = path.join(process.cwd(), 'public', 'videos');

async function ensurePaths() {
  // Ensure videos directory exists
  await fs.mkdir(videosDir, { recursive: true });

  await readVideoConfig();
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    assertAdminRequest(cookieStore);
    await ensurePaths();
    const formData = await request.formData();
    const file = formData.get('video') as File;
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file uploaded' },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const filename = `${Date.now()}-${file.name}`;
    const filepath = path.join(videosDir, filename);

    await fs.writeFile(filepath, buffer);

    const config = await readVideoConfig();
    if (!config.videos.includes(filename)) {
      config.videos.push(filename);
      await writeVideoConfig(config);
    }

    return NextResponse.json({ success: true, filename });
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to upload video' }, { status: 500 });
  }
}
