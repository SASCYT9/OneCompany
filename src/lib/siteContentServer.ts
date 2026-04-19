import path from 'path';
import { SiteContent } from '@/types/site-content';
import { defaultSiteContent } from '@/config/defaultSiteContent';
import { validateSiteContentInput } from '@/lib/adminConfigValidation';
import {
  ensureVersionedJsonFile,
  readJsonFileWithFallback,
  writeVersionedJsonFile,
} from '@/lib/adminJsonStorage';

const contentPath = path.join(process.cwd(), 'data', 'admin-config', 'site-content.json');
const legacyContentPath = path.join(process.cwd(), 'public', 'config', 'site-content.json');

async function ensureContentFile() {
  await ensureVersionedJsonFile({
    filePath: contentPath,
    defaultValue: defaultSiteContent,
    legacyPath: legacyContentPath,
  });
}

export async function readSiteContent(): Promise<SiteContent> {
  try {
    const parsed = await readJsonFileWithFallback({
      filePath: contentPath,
      defaultValue: defaultSiteContent,
      legacyPath: legacyContentPath,
    });
    const normalizeLocalized = (value: unknown, fallback: { ua: string; en: string }) => {
      if (!value) {
        return fallback;
      }
      if (typeof value === 'string') {
        return { ua: value, en: value };
      }
      return {
        ...fallback,
        ...(value as { ua?: string; en?: string }),
      };
    };

    const normalizePost = (post: SiteContent['blog']['posts'][number]) => ({
      ...post,
      title: normalizeLocalized(post.title, { ua: '', en: '' }),
      caption: normalizeLocalized(post.caption, { ua: '', en: '' }),
      location: post.location ? normalizeLocalized(post.location, { ua: '', en: '' }) : undefined,
    });
    return validateSiteContentInput({
      ...defaultSiteContent,
      ...parsed,
      hero: { ...defaultSiteContent.hero, ...parsed.hero },
      statHighlights: parsed.statHighlights ?? defaultSiteContent.statHighlights,
      marqueeBrands: parsed.marqueeBrands ?? defaultSiteContent.marqueeBrands,
      values: parsed.values ?? defaultSiteContent.values,
      productCategories: parsed.productCategories ?? defaultSiteContent.productCategories,
      contactCta: { ...defaultSiteContent.contactCta, ...parsed.contactCta },
      contactPage: {
        ...defaultSiteContent.contactPage,
        ...parsed.contactPage,
        budgets: parsed.contactPage?.budgets ?? defaultSiteContent.contactPage.budgets,
        channels: parsed.contactPage?.channels ?? defaultSiteContent.contactPage.channels,
        successStories: parsed.contactPage?.successStories ?? defaultSiteContent.contactPage.successStories,
        messengerHandles: parsed.contactPage?.messengerHandles ?? defaultSiteContent.contactPage.messengerHandles,
      },
      brandSections: {
        automotive: parsed.brandSections?.automotive ?? defaultSiteContent.brandSections.automotive,
        moto: parsed.brandSections?.moto ?? defaultSiteContent.brandSections.moto,
      },
      blog: {
        ...defaultSiteContent.blog,
        ...parsed.blog,
        posts: (parsed.blog?.posts ?? defaultSiteContent.blog.posts).map(normalizePost),
      },
    });
  } catch {
    // If file doesn't exist or fails to parse, return defaults
    // Do not attempt to create file in production/read-only environments
    return defaultSiteContent;
  }
}

export async function writeSiteContent(content: SiteContent) {
  await ensureContentFile();
  await writeVersionedJsonFile({
    filePath: contentPath,
    historyKey: 'site-content',
    value: validateSiteContentInput(content),
    legacyPath: legacyContentPath,
  });
}
