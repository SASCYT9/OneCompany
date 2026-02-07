import { promises as fs } from 'fs';
import path from 'path';
import { SiteContent } from '@/types/site-content';
import { defaultSiteContent } from '@/config/defaultSiteContent';

const contentPath = path.join(process.cwd(), 'public', 'config', 'site-content.json');

async function ensureContentFile() {
  try {
    await fs.access(contentPath);
  } catch {
    const dir = path.dirname(contentPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      contentPath,
      JSON.stringify(defaultSiteContent, null, 2)
    );
  }
}

export async function readSiteContent(): Promise<SiteContent> {
  try {
    const data = await fs.readFile(contentPath, 'utf-8');
    const parsed = JSON.parse(data) as SiteContent;
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
    return {
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
    };
  } catch {
    // If file doesn't exist or fails to parse, return defaults
    // Do not attempt to create file in production/read-only environments
    return defaultSiteContent;
  }
}

export async function writeSiteContent(content: SiteContent) {
  await ensureContentFile();
  await fs.writeFile(contentPath, JSON.stringify(content, null, 2));
}
