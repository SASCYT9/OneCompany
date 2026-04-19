import path from 'path';
import { validateVideoConfigUpdate } from '@/lib/adminConfigValidation';
import {
  ensureVersionedJsonFile,
  readJsonFileWithFallback,
  writeVersionedJsonFile,
} from '@/lib/adminJsonStorage';

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
  await ensureVersionedJsonFile({
    filePath: configPath,
    defaultValue: defaultVideoConfig,
    legacyPath: legacyConfigPath,
  });
}

export async function readVideoConfig(): Promise<VideoConfig> {
  try {
    const raw = await readJsonFileWithFallback({
      filePath: configPath,
      defaultValue: defaultVideoConfig,
      legacyPath: legacyConfigPath,
    });
    return {
      ...defaultVideoConfig,
      ...validateVideoConfigUpdate(raw),
    };
  } catch {
    return defaultVideoConfig;
  }
}

export async function writeVideoConfig(update: Partial<VideoConfig>) {
  await ensureVideoConfigFile();
  const current = await readVideoConfig();
  const next = {
    ...current,
    ...validateVideoConfigUpdate(update),
  };
  await writeVersionedJsonFile({
    filePath: configPath,
    historyKey: 'video-config',
    value: next,
    legacyPath: legacyConfigPath,
  });

  return next;
}
