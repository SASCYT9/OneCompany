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
  await ensureContentFile();
  try {
    const data = await fs.readFile(contentPath, 'utf-8');
    const parsed = JSON.parse(data) as SiteContent;
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
    };
  } catch (error) {
    console.error('Failed to parse site content. Falling back to default.', error);
    return defaultSiteContent;
  }
}

export async function writeSiteContent(content: SiteContent) {
  await ensureContentFile();
  await fs.writeFile(contentPath, JSON.stringify(content, null, 2));
}
