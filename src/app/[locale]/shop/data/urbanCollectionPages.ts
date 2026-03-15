/**
 * Shared Urban collection theme types.
 * Theme data is loaded from Shopify JSONC templates in urbanCollectionPages.server.ts.
 */

export type UrbanHeroConfig = {
  eyebrow: string;
  eyebrowUk: string;
  title: string;
  titleUk: string;
  subtitle: string;
  subtitleUk: string;
  buttonLabel: string;
  buttonLabelUk: string;
  buttonLink: string;
  buttonNewTab: boolean;
  externalVideoEmbedUrl?: string;
  externalPosterUrl: string;
  overlayOpacity: number;
  mobileHeight: number;
  desktopHeight: number;
  accentColor: string;
};

export type UrbanOverviewHighlight = { text: string; textUk: string };

export type UrbanOverviewConfig = {
  eyebrow: string;
  eyebrowUk: string;
  title: string;
  titleUk: string;
  badge: string;
  badgeUk: string;
  subtitle: string;
  subtitleUk: string;
  description: string;
  descriptionUk: string;
  buttonLabel: string;
  buttonLabelUk: string;
  buttonLink: string;
  buttonNewTab: boolean;
  externalImageUrl: string;
  highlights: UrbanOverviewHighlight[];
  paddingTop: number;
  paddingBottom: number;
  backgroundColor: string;
  borderColor: string;
  copyColor: string;
};

export type UrbanGallerySlide = { externalImageUrl: string; caption: string };

export type UrbanGalleryConfig = {
  label: string;
  labelUk: string;
  slides: UrbanGallerySlide[];
  paddingTop: number;
  paddingBottom: number;
  backgroundColor: string;
  borderColor: string;
};

export type UrbanBannerItem = {
  mediaType: 'image' | 'video';
  externalImageUrl: string;
  eyebrow: string;
  eyebrowUk: string;
  title: string;
  titleUk: string;
  subtitle: string;
  subtitleUk: string;
  buttonLabel: string;
  buttonLabelUk: string;
  buttonLink: string;
};

export type UrbanBannerStackConfig = {
  banners: UrbanBannerItem[];
  overlayOpacity: number;
  mobileHeight: number;
  desktopHeight: number;
  borderColor: string;
};

export type UrbanVideoPointerConfig = {
  videoUrl: string;
  captionEyebrow: string;
  captionEyebrowUk: string;
  captionTitle: string;
  captionTitleUk: string;
  fullWidth: boolean;
  maxWidth: number;
  overlayTop: number;
  overlayBottom: number;
  paddingTop: number;
  paddingBottom: number;
  backgroundColor: string;
};

export type UrbanBlueprintView = {
  positionLabel: string;
  titleEn: string;
  titleUk: string;
  partsEn: string;
  partsUk: string;
  externalImageUrl: string;
};

export type UrbanBlueprintConfig = {
  eyebrow: string;
  eyebrowUk: string;
  heading: string;
  headingUk: string;
  subheading: string;
  subheadingUk: string;
  ctaLabel: string;
  ctaLabelUk: string;
  ctaLink: string;
  ctaNewTab: boolean;
  views: UrbanBlueprintView[];
  paddingTop: number;
  paddingBottom: number;
  backgroundColor: string;
  cardBackground: string;
  textColor: string;
  mutedColor: string;
  separatorColor: string;
};

export type UrbanProductGridConfig = {
  productsPerPage: number;
  columnsDesktop: number;
  columnsMobile: number;
  enableFiltering: boolean;
  enableSorting: boolean;
  paddingTop: number;
  paddingBottom: number;
};

export type UrbanCollectionPageConfig = {
  handle: string;
  hero: UrbanHeroConfig;
  overview: UrbanOverviewConfig;
  gallery: UrbanGalleryConfig;
  videoPointer: UrbanVideoPointerConfig | null;
  bannerStack: UrbanBannerStackConfig;
  blueprint: UrbanBlueprintConfig;
  productGrid: UrbanProductGridConfig;
};
