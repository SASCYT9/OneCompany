import { promises as fs } from 'fs';
import path from 'path';
import type { SiteMedia, StoreId } from '@/types/site-media';
import { defaultSiteMedia } from '@/config/defaultSiteMedia';

const mediaPath = path.join(process.cwd(), 'public', 'config', 'site-media.json');

async function ensureMediaFile() {
  try {
    await fs.access(mediaPath);
  } catch {
    const dir = path.dirname(mediaPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(mediaPath, JSON.stringify(defaultSiteMedia, null, 2), 'utf8');
  }
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
    const raw = await fs.readFile(mediaPath, 'utf8');
    const parsed = JSON.parse(raw) as SiteMedia;
    return {
      heroPosters: {
        auto: parsed.heroPosters?.auto ?? defaultSiteMedia.heroPosters.auto,
        moto: parsed.heroPosters?.moto ?? defaultSiteMedia.heroPosters.moto,
      },
      stores: {
        kw: mergeStoreSection('kw', parsed.stores?.kw),
        fi: mergeStoreSection('fi', parsed.stores?.fi),
        eventuri: mergeStoreSection('eventuri', parsed.stores?.eventuri),
      },
    };
  } catch (error) {
    // If file doesn't exist or fails to parse, return defaults
    // Do not attempt to create file in production/read-only environments
    return defaultSiteMedia;
  }
}

export async function writeSiteMedia(payload: SiteMedia) {
  await ensureMediaFile();
  const merged: SiteMedia = {
    heroPosters: {
      auto: payload.heroPosters.auto || defaultSiteMedia.heroPosters.auto,
      moto: payload.heroPosters.moto || defaultSiteMedia.heroPosters.moto,
    },
    stores: {
      kw: mergeStoreSection('kw', payload.stores.kw),
      fi: mergeStoreSection('fi', payload.stores.fi),
      eventuri: mergeStoreSection('eventuri', payload.stores.eventuri),
    },
  };
  await fs.writeFile(mediaPath, JSON.stringify(merged, null, 2), 'utf8');
  return merged;
}
