import { promises as fs } from 'fs';
import path from 'path';

export type VideoConfig = {
  heroVideo: string;
  videos: string[];
  heroEnabled?: boolean;
  heroVideoMobile?: string;
  heroPoster?: string;
};

const configPath = path.join(process.cwd(), 'public', 'config', 'video-config.json');
const defaultConfig: VideoConfig = { heroVideo: 'hero-main.mp4', videos: [], heroEnabled: true, heroVideoMobile: 'hero-smoke.mp4', heroPoster: 'hero-background.jpg' };

async function ensureVideoConfigFile() {
  try {
    await fs.access(configPath);
  } catch {
    const dir = path.dirname(configPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(configPath, JSON.stringify(defaultConfig, null, 2));
  }
}

export async function readVideoConfig(): Promise<VideoConfig> {
  await ensureVideoConfigFile();
  try {
    const data = await fs.readFile(configPath, 'utf-8');
    const parsed = JSON.parse(data) as VideoConfig;
    return { ...defaultConfig, ...parsed };
  } catch (error) {
    console.error('Failed to read video config', error);
    return defaultConfig;
  }
}

export async function writeVideoConfig(config: VideoConfig) {
  await ensureVideoConfigFile();
  await fs.writeFile(configPath, JSON.stringify(config, null, 2));
}

export { configPath as videoConfigPath };
