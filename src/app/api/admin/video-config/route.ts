import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const configPath = path.join(process.cwd(), 'public', 'config', 'video-config.json');

async function ensureConfigFile() {
  try {
    await fs.access(configPath);
  } catch {
    const dir = path.dirname(configPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      configPath,
      JSON.stringify({ heroVideo: 'hero-smoke.mp4', videos: [] }, null, 2)
    );
  }
}

export async function GET() {
  try {
    await ensureConfigFile();
    const data = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(data);
    return NextResponse.json(config);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to load video config' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { heroVideo } = await request.json();
    
    await ensureConfigFile();
    const data = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(data);
    
    config.heroVideo = heroVideo;
    
    await fs.writeFile(configPath, JSON.stringify(config, null, 2));
    
    return NextResponse.json(config);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to save video config' },
      { status: 500 }
    );
  }
}
