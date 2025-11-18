import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const configPath = path.join(process.cwd(), 'public', 'config', 'video-config.json');
const videosDir = path.join(process.cwd(), 'public', 'videos');

async function ensurePaths() {
  // Ensure videos directory exists
  await fs.mkdir(videosDir, { recursive: true });

  // Ensure config file exists
  try {
    await fs.access(configPath);
  } catch {
    const dir = path.dirname(configPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      configPath,
      JSON.stringify({ heroVideo: 'Luxury_Automotive_Abstract_Video_Creation.mp4', videos: [] }, null, 2)
    );
  }
}

export async function POST(request: NextRequest) {
  try {
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

  const data = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(data);
    
    if (!config.videos.includes(filename)) {
      config.videos.push(filename);
      await fs.writeFile(configPath, JSON.stringify(config, null, 2));
    }

    return NextResponse.json({ success: true, filename });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to upload video' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
