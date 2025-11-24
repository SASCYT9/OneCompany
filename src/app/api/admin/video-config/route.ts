import { NextRequest, NextResponse } from 'next/server';
// imports already present above
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
      JSON.stringify({ heroVideo: 'rollsbg-v2.mp4', videos: [], heroEnabled: true }, null, 2)
    );
  }
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    assertAdminRequest(cookieStore);
    // await ensureConfigFile(); // Removed to prevent crash on Vercel
    try {
      const data = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(data);
      return NextResponse.json(config);
    } catch {
      // Return default config if file missing
      return NextResponse.json({ heroVideo: 'rollsbg-v2.mp4', videos: [], heroEnabled: true });
    }
  } catch {
    return NextResponse.json(
      { error: 'Failed to load video config' },
      { status: 500 }
    );
  }
}
import { cookies } from 'next/headers';
import { assertAdminRequest } from '@/lib/adminAuth';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    assertAdminRequest(cookieStore);
    const { heroVideo, heroEnabled, heroVideoMobile, heroPoster } = await request.json();
    
    await ensureConfigFile();
    const data = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(data);
    
    if (typeof heroVideo === 'string') config.heroVideo = heroVideo;
    if (typeof heroEnabled === 'boolean') config.heroEnabled = heroEnabled;
    if (typeof heroVideoMobile === 'string') config.heroVideoMobile = heroVideoMobile;
    if (typeof heroPoster === 'string') config.heroPoster = heroPoster;
    
    await fs.writeFile(configPath, JSON.stringify(config, null, 2));
    // Append audit log
    try {
      const auditPath = path.join(process.cwd(), 'public', 'config', 'video-config-audit.jsonl');
      const auditRecord = JSON.stringify({ timestamp: new Date().toISOString(), heroVideo: config.heroVideo, heroEnabled: config.heroEnabled, heroVideoMobile: config.heroVideoMobile, heroPoster: config.heroPoster }) + '\n';
      await fs.appendFile(auditPath, auditRecord);
    } catch (e) {
      console.warn('Failed to append audit log for video-config', e);
    }
    
    return NextResponse.json(config);
  } catch {
    return NextResponse.json(
      { error: 'Failed to save video config' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
