import path from 'path';
import type { SiteMedia, StoreId } from '@/types/site-media';
import { defaultSiteMedia } from '@/config/defaultSiteMedia';
import { validateSiteMediaInput } from '@/lib/adminConfigValidation';
import {
  ensureVersionedJsonFile,
  readJsonFileWithFallback,
  writeVersionedJsonFile,
} from '@/lib/adminJsonStorage';

const mediaPath = path.join(process.cwd(), 'data', 'admin-config', 'site-media.json');
const legacyMediaPath = path.join(process.cwd(), 'public', 'config', 'site-media.json');

async function ensureMediaFile() {
  await ensureVersionedJsonFile({
    filePath: mediaPath,
    defaultValue: defaultSiteMedia,
    legacyPath: legacyMediaPath,
  });
}

function mergeStoreSection(storeId: StoreId, incoming: SiteMedia['stores'][StoreId]) {
  const fallback = defaultSiteMedia.stores[storeId];
  return {
    heroPoster: incoming?.heroPoster ?? fallback.heroPoster,
    catalogProducts: incoming?.catalogProducts ?? fallback.catalogProducts,
    gallery: incoming?.gallery ?? fallback.gallery,
  };
}

export async function readSiteMedia(): Promise<SiteMedia> {
  try {
    const parsed = await readJsonFileWithFallback({
      filePath: mediaPath,
      defaultValue: defaultSiteMedia,
      legacyPath: legacyMediaPath,
    });
    return validateSiteMediaInput({
      heroPosters: {
        auto: parsed.heroPosters?.auto ?? defaultSiteMedia.heroPosters.auto,
        moto: parsed.heroPosters?.moto ?? defaultSiteMedia.heroPosters.moto,
      },
      stores: {
        kw: mergeStoreSection('kw', parsed.stores?.kw),
        fi: mergeStoreSection('fi', parsed.stores?.fi),
        eventuri: mergeStoreSection('eventuri', parsed.stores?.eventuri),
      },
    });
  } catch {
    // If file doesn't exist or fails to parse, return defaults
    // Do not attempt to create file in production/read-only environments
    return defaultSiteMedia;
  }
}

export async function writeSiteMedia(payload: SiteMedia) {
  await ensureMediaFile();
  const merged = validateSiteMediaInput({
    heroPosters: {
      auto: payload.heroPosters.auto || defaultSiteMedia.heroPosters.auto,
      moto: payload.heroPosters.moto || defaultSiteMedia.heroPosters.moto,
    },
    stores: {
      kw: mergeStoreSection('kw', payload.stores.kw),
      fi: mergeStoreSection('fi', payload.stores.fi),
      eventuri: mergeStoreSection('eventuri', payload.stores.eventuri),
    },
  });
  await writeVersionedJsonFile({
    filePath: mediaPath,
    historyKey: 'site-media',
    value: merged,
    legacyPath: legacyMediaPath,
  });

  return merged;
}
