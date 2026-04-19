import { promises as fs } from 'fs';
import path from 'path';

const configPath = path.join(process.cwd(), 'data', 'admin-config', 'video-config.json');
const legacyConfigPath = path.join(process.cwd(), 'public', 'config', 'video-config.json');

export type VideoConfig = {
  heroVideo: string;
  videos: string[];
  heroEnabled: boolean;
  heroVideoMobile?: string;
  heroPoster?: string;
};

export const defaultVideoConfig: VideoConfig = {
  heroVideo: 'rollsbg-v3.mp4',
  videos: [],
  heroEnabled: true,
};

export async function ensureVideoConfigFile() {
  try {
    await fs.access(configPath);
  } catch {
    const dir = path.dirname(configPath);
    await fs.mkdir(dir, { recursive: true });

    try {
      const legacyData = await fs.readFile(legacyConfigPath, 'utf8');
      await fs.writeFile(configPath, legacyData, 'utf8');
      return;
    } catch {}

    await fs.writeFile(configPath, JSON.stringify(defaultVideoConfig, null, 2), 'utf8');
  }
}

export async function readVideoConfig(): Promise<VideoConfig> {
  try {
    let raw: string;
    try {
      raw = await fs.readFile(configPath, 'utf8');
    } catch {
      raw = await fs.readFile(legacyConfigPath, 'utf8');
    }
    return {
      ...defaultVideoConfig,
      ...(JSON.parse(raw) as Partial<VideoConfig>),
    };
  } catch {
    return defaultVideoConfig;
  }
}

export async function writeVideoConfig(update: Partial<VideoConfig>) {
  await ensureVideoConfigFile();
  const current = await readVideoConfig();
  const next = { ...current, ...update };
  await fs.writeFile(configPath, JSON.stringify(next, null, 2), 'utf8');

  try {
    await fs.unlink(legacyConfigPath);
  } catch {}

  return next;
}
