import 'server-only';

import fs from 'node:fs';
import path from 'node:path';
import type {
  UrbanBannerItem,
  UrbanBlueprintView,
  UrbanCollectionPageConfig,
  UrbanGallerySlide,
  UrbanOverviewHighlight,
  UrbanVideoPointerConfig,
} from './urbanCollectionPages';
import { resolveUrbanThemeAssetUrl } from '@/lib/urbanThemeAssets';

type ThemeBlock = {
  type: string;
  settings?: Record<string, unknown>;
};

type ThemeSection = {
  type: string;
  settings?: Record<string, unknown>;
  blocks?: Record<string, ThemeBlock>;
  block_order?: string[];
};

type ThemeTemplate = {
  sections?: Record<string, ThemeSection>;
  order?: string[];
};

const TEMPLATE_DIR = path.join(
  process.cwd(),
  'reference',
  'urban-shopify-theme',
  'templates'
);

const templateCache = new Map<string, UrbanCollectionPageConfig | null>();

function parseJsoncTemplate(filePath: string): ThemeTemplate {
  let text = fs.readFileSync(filePath, 'utf8');
  text = text.replace(/^\uFEFF/, '');
  text = text.replace(/\/\*[\s\S]*?\*\//g, '');
  return JSON.parse(text) as ThemeTemplate;
}

function stringSetting(
  source: Record<string, unknown> | undefined,
  key: string,
  fallback = ''
): string {
  const value = source?.[key];
  return typeof value === 'string' ? value : fallback;
}

function numberSetting(
  source: Record<string, unknown> | undefined,
  key: string,
  fallback = 0
): number {
  const value = source?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function booleanSetting(
  source: Record<string, unknown> | undefined,
  key: string,
  fallback = false
): boolean {
  const value = source?.[key];
  return typeof value === 'boolean' ? value : fallback;
}

function assetSetting(
  source: Record<string, unknown> | undefined,
  key: string,
  fallback = ''
): string {
  return resolveUrbanThemeAssetUrl(stringSetting(source, key, fallback));
}

function orderedBlocks(section?: ThemeSection): ThemeBlock[] {
  if (!section?.blocks) {
    return [];
  }

  const order = section.block_order ?? Object.keys(section.blocks);
  return order
    .map((key) => section.blocks?.[key])
    .filter((block): block is ThemeBlock => Boolean(block));
}

function mapOverviewHighlights(section?: ThemeSection): UrbanOverviewHighlight[] {
  return orderedBlocks(section)
    .filter((block) => block.type === 'highlight')
    .map((block) => ({
      text: stringSetting(block.settings, 'text'),
      textUk: stringSetting(block.settings, 'text_uk'),
    }))
    .filter((item) => item.text || item.textUk);
}

function mapGallerySlides(section?: ThemeSection): UrbanGallerySlide[] {
  return orderedBlocks(section)
    .filter((block) => block.type === 'slide')
    .map((block) => ({
      externalImageUrl: assetSetting(block.settings, 'external_image_url'),
      caption: stringSetting(block.settings, 'caption'),
    }))
    .filter((item) => item.externalImageUrl);
}

function mapBannerItems(section?: ThemeSection): UrbanBannerItem[] {
  return orderedBlocks(section)
    .filter((block) => block.type === 'banner')
    .map((block) => ({
      mediaType: (
        stringSetting(block.settings, 'media_type', 'image') === 'video'
          ? 'video'
          : 'image'
      ) as UrbanBannerItem['mediaType'],
      externalImageUrl: assetSetting(block.settings, 'external_image_url'),
      eyebrow: stringSetting(block.settings, 'eyebrow'),
      eyebrowUk: stringSetting(block.settings, 'eyebrow_uk'),
      title: stringSetting(block.settings, 'title'),
      titleUk: stringSetting(block.settings, 'title_uk'),
      subtitle: stringSetting(block.settings, 'subtitle'),
      subtitleUk: stringSetting(block.settings, 'subtitle_uk'),
      buttonLabel: stringSetting(block.settings, 'button_label'),
      buttonLabelUk: stringSetting(block.settings, 'button_label_uk'),
      buttonLink: stringSetting(block.settings, 'button_link'),
    }))
    .filter((item) => item.externalImageUrl);
}

function mapBlueprintViews(section?: ThemeSection): UrbanBlueprintView[] {
  return orderedBlocks(section)
    .filter((block) => block.type === 'view')
    .map((block) => ({
      positionLabel: stringSetting(block.settings, 'position_label'),
      titleEn: stringSetting(block.settings, 'title_en'),
      titleUk: stringSetting(block.settings, 'title_uk'),
      partsEn: stringSetting(block.settings, 'parts_en'),
      partsUk: stringSetting(block.settings, 'parts_uk'),
      externalImageUrl: assetSetting(block.settings, 'external_image_url'),
    }))
    .filter((item) => item.externalImageUrl);
}

function mapVideoPointer(section?: ThemeSection): UrbanVideoPointerConfig | null {
  if (!section || section.type !== 'section-urban-video-pointer') {
    return null;
  }

  return {
    videoUrl: assetSetting(section.settings, 'video_url'),
    captionEyebrow: stringSetting(section.settings, 'caption_eyebrow'),
    captionEyebrowUk: stringSetting(section.settings, 'caption_eyebrow_uk'),
    captionTitle: stringSetting(section.settings, 'caption_title'),
    captionTitleUk: stringSetting(section.settings, 'caption_title_uk'),
    fullWidth: booleanSetting(section.settings, 'full_width', true),
    maxWidth: numberSetting(section.settings, 'max_width', 1900),
    overlayTop: numberSetting(section.settings, 'overlay_top', 10),
    overlayBottom: numberSetting(section.settings, 'overlay_bottom', 15),
    paddingTop: numberSetting(section.settings, 'padding_top', 0),
    paddingBottom: numberSetting(section.settings, 'padding_bottom', 0),
    backgroundColor: stringSetting(section.settings, 'background_color', '#000000'),
  };
}

function requiredSection(
  sections: Record<string, ThemeSection> | undefined,
  key: string,
  type: string
): ThemeSection {
  const section = sections?.[key];
  if (!section || section.type !== type) {
    throw new Error(`Missing section "${key}" of type "${type}"`);
  }
  return section;
}

function buildConfigFromTemplate(handle: string, template: ThemeTemplate): UrbanCollectionPageConfig {
  const hero = requiredSection(
    template.sections,
    'hero',
    'section-urban-cinematic-hero'
  );
  const overview = requiredSection(
    template.sections,
    'overview',
    'section-urban-model-overview'
  );
  const gallery = requiredSection(
    template.sections,
    'gallery',
    'section-urban-gallery-carousel'
  );
  const banner = requiredSection(
    template.sections,
    'banner',
    'section-urban-banner-stack'
  );
  const blueprint = requiredSection(
    template.sections,
    'blueprint_kit',
    'section-urban-blueprint-kit'
  );
  const main = requiredSection(
    template.sections,
    'main',
    'main-collection-product-grid'
  );

  const videoPointer = mapVideoPointer(template.sections?.video_pointer);

  return {
    handle,
    hero: {
      eyebrow: stringSetting(hero.settings, 'eyebrow'),
      eyebrowUk: stringSetting(hero.settings, 'eyebrow_uk'),
      title: stringSetting(hero.settings, 'title'),
      titleUk: stringSetting(hero.settings, 'title_uk'),
      subtitle: stringSetting(hero.settings, 'subtitle'),
      subtitleUk: stringSetting(hero.settings, 'subtitle_uk'),
      buttonLabel: stringSetting(hero.settings, 'button_label'),
      buttonLabelUk: stringSetting(hero.settings, 'button_label_uk'),
      buttonLink: stringSetting(hero.settings, 'button_link'),
      buttonNewTab: booleanSetting(hero.settings, 'button_new_tab'),
      externalVideoEmbedUrl: assetSetting(hero.settings, 'external_video_embed_url') || undefined,
      externalPosterUrl: assetSetting(hero.settings, 'external_poster_url'),
      overlayOpacity: numberSetting(hero.settings, 'overlay_opacity', 25),
      mobileHeight: numberSetting(hero.settings, 'mobile_height', 90),
      desktopHeight: numberSetting(hero.settings, 'desktop_height', 100),
      accentColor: stringSetting(hero.settings, 'accent_color', '#ffffff'),
    },
    overview: {
      eyebrow: stringSetting(overview.settings, 'eyebrow'),
      eyebrowUk: stringSetting(overview.settings, 'eyebrow_uk'),
      title: stringSetting(overview.settings, 'title'),
      titleUk: stringSetting(overview.settings, 'title_uk'),
      badge: stringSetting(overview.settings, 'badge'),
      badgeUk: stringSetting(overview.settings, 'badge_uk'),
      subtitle: stringSetting(overview.settings, 'subtitle'),
      subtitleUk: stringSetting(overview.settings, 'subtitle_uk'),
      description: stringSetting(overview.settings, 'description'),
      descriptionUk: stringSetting(overview.settings, 'description_uk'),
      buttonLabel: stringSetting(overview.settings, 'button_label'),
      buttonLabelUk: stringSetting(overview.settings, 'button_label_uk'),
      buttonLink: stringSetting(overview.settings, 'button_link'),
      buttonNewTab: booleanSetting(overview.settings, 'button_new_tab'),
      externalImageUrl: assetSetting(overview.settings, 'external_image_url'),
      highlights: mapOverviewHighlights(overview),
      paddingTop: numberSetting(overview.settings, 'padding_top', 24),
      paddingBottom: numberSetting(overview.settings, 'padding_bottom', 24),
      backgroundColor: stringSetting(overview.settings, 'background_color', '#000000'),
      borderColor: stringSetting(overview.settings, 'border_color', '#1b1b1b'),
      copyColor: stringSetting(overview.settings, 'copy_color', '#cfcfcf'),
    },
    gallery: {
      label: stringSetting(gallery.settings, 'label', 'Gallery'),
      labelUk: stringSetting(gallery.settings, 'label_uk', 'Галерея'),
      slides: mapGallerySlides(gallery),
      paddingTop: numberSetting(gallery.settings, 'padding_top', 24),
      paddingBottom: numberSetting(gallery.settings, 'padding_bottom', 24),
      backgroundColor: stringSetting(gallery.settings, 'background_color', '#000000'),
      borderColor: stringSetting(gallery.settings, 'border_color', '#1b1b1b'),
    },
    videoPointer,
    bannerStack: {
      banners: mapBannerItems(banner),
      overlayOpacity: numberSetting(banner.settings, 'overlay_opacity', 20),
      mobileHeight: numberSetting(banner.settings, 'mobile_height', 70),
      desktopHeight: numberSetting(banner.settings, 'desktop_height', 90),
      borderColor: stringSetting(banner.settings, 'border_color', '#1c1c1c'),
    },
    blueprint: {
      eyebrow: stringSetting(blueprint.settings, 'eyebrow'),
      eyebrowUk: stringSetting(blueprint.settings, 'eyebrow_uk'),
      heading: stringSetting(blueprint.settings, 'heading'),
      headingUk: stringSetting(blueprint.settings, 'heading_uk'),
      subheading: stringSetting(blueprint.settings, 'subheading'),
      subheadingUk: stringSetting(blueprint.settings, 'subheading_uk'),
      ctaLabel: stringSetting(blueprint.settings, 'cta_label'),
      ctaLabelUk: stringSetting(blueprint.settings, 'cta_label_uk'),
      ctaLink: stringSetting(blueprint.settings, 'cta_link'),
      ctaNewTab: booleanSetting(blueprint.settings, 'cta_new_tab'),
      views: mapBlueprintViews(blueprint),
      paddingTop: numberSetting(blueprint.settings, 'padding_top', 52),
      paddingBottom: numberSetting(blueprint.settings, 'padding_bottom', 52),
      backgroundColor: stringSetting(blueprint.settings, 'background_color', '#f5f5f3'),
      cardBackground: stringSetting(blueprint.settings, 'card_background', '#ffffff'),
      textColor: stringSetting(blueprint.settings, 'text_color', '#111111'),
      mutedColor: stringSetting(blueprint.settings, 'muted_color', '#666666'),
      separatorColor: stringSetting(blueprint.settings, 'separator_color', '#e0e0e0'),
    },
    productGrid: {
      productsPerPage: numberSetting(main.settings, 'products_per_page', 16),
      columnsDesktop: numberSetting(main.settings, 'columns_desktop', 4),
      columnsMobile: Number(stringSetting(main.settings, 'columns_mobile', '2')) || 2,
      enableFiltering: booleanSetting(main.settings, 'enable_filtering', true),
      enableSorting: booleanSetting(main.settings, 'enable_sorting', true),
      paddingTop: numberSetting(main.settings, 'padding_top', 36),
      paddingBottom: numberSetting(main.settings, 'padding_bottom', 36),
    },
  };
}

export function getUrbanCollectionTemplateHandles(): string[] {
  return fs
    .readdirSync(TEMPLATE_DIR)
    .filter((file) => /^collection\..+\.json$/.test(file))
    .map((file) => file.replace(/^collection\./, '').replace(/\.json$/, ''))
    .sort();
}

export function getUrbanCollectionPageConfig(
  handle: string
): UrbanCollectionPageConfig | null {
  if (templateCache.has(handle)) {
    return templateCache.get(handle) ?? null;
  }

  const filePath = path.join(TEMPLATE_DIR, `collection.${handle}.json`);
  if (!fs.existsSync(filePath)) {
    templateCache.set(handle, null);
    return null;
  }

  try {
    const template = parseJsoncTemplate(filePath);
    const config = buildConfigFromTemplate(handle, template);
    templateCache.set(handle, config);
    return config;
  } catch {
    templateCache.set(handle, null);
    return null;
  }
}
