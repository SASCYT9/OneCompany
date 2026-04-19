import { PrismaClient } from '@prisma/client';
import { countReferencedAssetUrls } from '@/lib/adminAssetReferences';
import { deleteMedia, listMedia, type MediaItem } from '@/lib/mediaStore';
import { readSiteContent } from '@/lib/siteContentServer';
import { readSiteMedia } from '@/lib/siteMediaServer';
import { readVideoConfig } from '@/lib/videoConfig';

export type ShopLibraryMediaUsage = {
  productPrimaryImages: number;
  productMedia: number;
  variantImages: number;
  siteContent: number;
  siteMedia: number;
  videoConfig: number;
};

export type ShopLibraryMediaItem = MediaItem & {
  usage: ShopLibraryMediaUsage;
  usageCount: number;
};

function emptyUsage(): ShopLibraryMediaUsage {
  return {
    productPrimaryImages: 0,
    productMedia: 0,
    variantImages: 0,
    siteContent: 0,
    siteMedia: 0,
    videoConfig: 0,
  };
}

async function buildUsageMap(prisma: PrismaClient, urls: string[]) {
  const uniqueUrls = Array.from(new Set(urls.filter(Boolean)));
  if (!uniqueUrls.length) {
    return new Map<string, ShopLibraryMediaUsage>();
  }

  const [productPrimaryImages, productMedia, variantImages, siteContent, siteMedia, videoConfig] =
    await Promise.all([
    prisma.shopProduct.findMany({
      where: { image: { in: uniqueUrls } },
      select: { image: true },
    }),
    prisma.shopProductMedia.findMany({
      where: { src: { in: uniqueUrls } },
      select: { src: true },
    }),
    prisma.shopProductVariant.findMany({
      where: { image: { in: uniqueUrls } },
      select: { image: true },
    }),
    readSiteContent(),
    readSiteMedia(),
    readVideoConfig(),
  ]);

  const usageMap = new Map<string, ShopLibraryMediaUsage>();
  const ensureEntry = (url: string) => {
    const current = usageMap.get(url);
    if (current) {
      return current;
    }
    const created = emptyUsage();
    usageMap.set(url, created);
    return created;
  };

  for (const item of productPrimaryImages) {
    if (!item.image) continue;
    ensureEntry(item.image).productPrimaryImages += 1;
  }

  for (const item of productMedia) {
    ensureEntry(item.src).productMedia += 1;
  }

  for (const item of variantImages) {
    if (!item.image) continue;
    ensureEntry(item.image).variantImages += 1;
  }

  const siteContentCounts = countReferencedAssetUrls(siteContent, uniqueUrls);
  const siteMediaCounts = countReferencedAssetUrls(siteMedia, uniqueUrls);
  const videoConfigCounts = countReferencedAssetUrls(videoConfig, uniqueUrls);

  for (const url of uniqueUrls) {
    const usage = ensureEntry(url);
    usage.siteContent += siteContentCounts.get(url) ?? 0;
    usage.siteMedia += siteMediaCounts.get(url) ?? 0;
    usage.videoConfig += videoConfigCounts.get(url) ?? 0;
  }

  return usageMap;
}

function withUsage(item: MediaItem, usage?: ShopLibraryMediaUsage): ShopLibraryMediaItem {
  const resolvedUsage = usage ?? emptyUsage();
  return {
    ...item,
    usage: resolvedUsage,
    usageCount:
      resolvedUsage.productPrimaryImages +
      resolvedUsage.productMedia +
      resolvedUsage.variantImages +
      resolvedUsage.siteContent +
      resolvedUsage.siteMedia +
      resolvedUsage.videoConfig,
  };
}

export async function listShopLibraryMedia(prisma: PrismaClient): Promise<ShopLibraryMediaItem[]> {
  const items = await listMedia();
  const usageMap = await buildUsageMap(
    prisma,
    items.map((item) => item.url)
  );

  return items.map((item) => withUsage(item, usageMap.get(item.url)));
}

export async function deleteUnusedShopLibraryMedia(prisma: PrismaClient, id: string) {
  const items = await listMedia();
  const item = items.find((entry) => entry.id === id);
  if (!item) {
    return { deleted: false, notFound: true, item: null, usage: emptyUsage() };
  }

  const usageMap = await buildUsageMap(prisma, [item.url]);
  const usage = usageMap.get(item.url) ?? emptyUsage();
  const usageCount =
    usage.productPrimaryImages +
    usage.productMedia +
    usage.variantImages +
    usage.siteContent +
    usage.siteMedia +
    usage.videoConfig;

  if (usageCount > 0) {
    return { deleted: false, notFound: false, item, usage };
  }

  await deleteMedia(id);
  return { deleted: true, notFound: false, item, usage };
}
