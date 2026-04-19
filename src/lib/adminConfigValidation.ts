import type { SiteContent } from '@/types/site-content';
import type { SiteMedia, StoreId } from '@/types/site-media';
import type { VideoConfig } from '@/lib/videoConfig';

export class AdminConfigValidationError extends Error {}

function fail(path: string, message: string): never {
  throw new AdminConfigValidationError(`${path}: ${message}`);
}

function expectObject(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(path, 'expected object');
  }
  return value as Record<string, unknown>;
}

function expectString(value: unknown, path: string, options?: { allowEmpty?: boolean }) {
  if (typeof value !== 'string') {
    fail(path, 'expected string');
  }
  const trimmed = value.trim();
  if (!options?.allowEmpty && !trimmed) {
    fail(path, 'expected non-empty string');
  }
  return trimmed;
}

function expectOptionalString(value: unknown, path: string) {
  if (value == null || value === '') return undefined;
  return expectString(value, path, { allowEmpty: false });
}

function expectBoolean(value: unknown, path: string) {
  if (typeof value !== 'boolean') {
    fail(path, 'expected boolean');
  }
  return value;
}

function expectStringArray(value: unknown, path: string) {
  if (!Array.isArray(value)) {
    fail(path, 'expected array');
  }
  return value.map((entry, index) => expectString(entry, `${path}[${index}]`, { allowEmpty: false }));
}

function expectObjectArray(value: unknown, path: string) {
  if (!Array.isArray(value)) {
    fail(path, 'expected array');
  }
  return value.map((entry, index) => expectObject(entry, `${path}[${index}]`));
}

function expectEnum<T extends string>(value: unknown, path: string, allowed: readonly T[]) {
  const normalized = expectString(value, path, { allowEmpty: false }) as T;
  if (!allowed.includes(normalized)) {
    fail(path, `expected one of ${allowed.join(', ')}`);
  }
  return normalized;
}

function isSafeAssetReference(value: string, options?: { allowFilename?: boolean; allowEmpty?: boolean }) {
  if (!value) return Boolean(options?.allowEmpty);
  if (value.includes('..')) return false;
  if (/^(javascript|data):/i.test(value)) return false;
  if (/^https?:\/\//i.test(value)) return true;
  if (value.startsWith('/')) return true;
  if (options?.allowFilename) {
    return /^[a-zA-Z0-9._/-]+$/.test(value);
  }
  return false;
}

function expectAssetReference(
  value: unknown,
  path: string,
  options?: { allowFilename?: boolean; allowEmpty?: boolean }
) {
  const resolved = options?.allowEmpty ? expectString(value ?? '', path, { allowEmpty: true }) : expectString(value, path);
  if (!isSafeAssetReference(resolved, options)) {
    fail(path, 'expected a safe asset reference');
  }
  return resolved;
}

function validateLocalizedString(value: unknown, path: string) {
  const source = expectObject(value, path);
  return {
    ua: expectString(source.ua, `${path}.ua`, { allowEmpty: true }),
    en: expectString(source.en, `${path}.en`, { allowEmpty: true }),
  };
}

export function validateSiteContentInput(input: unknown): SiteContent {
  const source = expectObject(input, 'siteContent');
  const hero = expectObject(source.hero, 'hero');
  const contactCta = expectObject(source.contactCta, 'contactCta');
  const contactPage = expectObject(source.contactPage, 'contactPage');
  const brandSections = expectObject(source.brandSections, 'brandSections');
  const blog = expectObject(source.blog, 'blog');
  const messengerHandles = expectObject(contactPage.messengerHandles, 'contactPage.messengerHandles');

  return {
    hero: {
      badge: expectString(hero.badge, 'hero.badge', { allowEmpty: true }),
      title: expectString(hero.title, 'hero.title', { allowEmpty: true }),
      subtitle: expectString(hero.subtitle, 'hero.subtitle', { allowEmpty: true }),
      ctaAutoLabel: expectString(hero.ctaAutoLabel, 'hero.ctaAutoLabel', { allowEmpty: true }),
      ctaMotoLabel: expectString(hero.ctaMotoLabel, 'hero.ctaMotoLabel', { allowEmpty: true }),
      scrollLabel: expectString(hero.scrollLabel, 'hero.scrollLabel', { allowEmpty: true }),
      globalPresence: expectString(hero.globalPresence, 'hero.globalPresence', { allowEmpty: true }),
      brandPromise: expectString(hero.brandPromise, 'hero.brandPromise', { allowEmpty: true }),
      atelierAddress: expectString(hero.atelierAddress, 'hero.atelierAddress', { allowEmpty: true }),
    },
    marqueeBrands: expectStringArray(source.marqueeBrands, 'marqueeBrands'),
    statHighlights: expectObjectArray(source.statHighlights, 'statHighlights').map((entry, index) => ({
      value: expectString(entry.value, `statHighlights[${index}].value`, { allowEmpty: true }),
      label: expectString(entry.label, `statHighlights[${index}].label`, { allowEmpty: true }),
    })),
    values: expectStringArray(source.values, 'values'),
    brandSections: {
      automotive: expectObjectArray(brandSections.automotive, 'brandSections.automotive').map((entry, index) => ({
        name: expectString(entry.name, `brandSections.automotive[${index}].name`, { allowEmpty: true }),
        logo: expectAssetReference(entry.logo, `brandSections.automotive[${index}].logo`),
      })),
      moto: expectObjectArray(brandSections.moto, 'brandSections.moto').map((entry, index) => ({
        name: expectString(entry.name, `brandSections.moto[${index}].name`, { allowEmpty: true }),
        logo: expectAssetReference(entry.logo, `brandSections.moto[${index}].logo`),
      })),
    },
    productCategories: expectObjectArray(source.productCategories, 'productCategories').map((entry, index) => ({
      name: expectString(entry.name, `productCategories[${index}].name`, { allowEmpty: true }),
      description: expectString(entry.description, `productCategories[${index}].description`, { allowEmpty: true }),
    })),
    contactCta: {
      heading: expectString(contactCta.heading, 'contactCta.heading', { allowEmpty: true }),
      body: expectString(contactCta.body, 'contactCta.body', { allowEmpty: true }),
      buttonLabel: expectString(contactCta.buttonLabel, 'contactCta.buttonLabel', { allowEmpty: true }),
      buttonHref: expectString(contactCta.buttonHref, 'contactCta.buttonHref', { allowEmpty: true }),
    },
    contactPage: {
      heroBadge: expectString(contactPage.heroBadge, 'contactPage.heroBadge', { allowEmpty: true }),
      infoBody: expectString(contactPage.infoBody, 'contactPage.infoBody', { allowEmpty: true }),
      timezoneNote: expectString(contactPage.timezoneNote, 'contactPage.timezoneNote', { allowEmpty: true }),
      slaPromise: expectString(contactPage.slaPromise, 'contactPage.slaPromise', { allowEmpty: true }),
      messengerTagline: expectString(contactPage.messengerTagline, 'contactPage.messengerTagline', { allowEmpty: true }),
      budgets: expectStringArray(contactPage.budgets, 'contactPage.budgets'),
      channels: expectObjectArray(contactPage.channels, 'contactPage.channels').map((entry, index) => ({
        id: expectString(entry.id, `contactPage.channels[${index}].id`, { allowEmpty: false }),
        label: expectString(entry.label, `contactPage.channels[${index}].label`, { allowEmpty: true }),
        value: expectString(entry.value, `contactPage.channels[${index}].value`, { allowEmpty: true }),
        note: expectString(entry.note, `contactPage.channels[${index}].note`, { allowEmpty: true }),
        type: expectEnum(entry.type, `contactPage.channels[${index}].type`, [
          'email',
          'phone',
          'telegram',
          'whatsapp',
        ] as const),
      })),
      successStories: expectObjectArray(contactPage.successStories, 'contactPage.successStories').map((entry, index) => ({
        id: expectString(entry.id, `contactPage.successStories[${index}].id`, { allowEmpty: false }),
        badge: expectString(entry.badge, `contactPage.successStories[${index}].badge`, { allowEmpty: true }),
        title: expectString(entry.title, `contactPage.successStories[${index}].title`, { allowEmpty: true }),
        summary: expectString(entry.summary, `contactPage.successStories[${index}].summary`, { allowEmpty: true }),
        metric: expectString(entry.metric, `contactPage.successStories[${index}].metric`, { allowEmpty: true }),
        metricLabel: expectString(entry.metricLabel, `contactPage.successStories[${index}].metricLabel`, { allowEmpty: true }),
      })),
      messengerHandles: {
        telegram: expectString(messengerHandles.telegram, 'contactPage.messengerHandles.telegram', { allowEmpty: true }),
        whatsapp: expectString(messengerHandles.whatsapp, 'contactPage.messengerHandles.whatsapp', { allowEmpty: true }),
        phone: expectString(messengerHandles.phone, 'contactPage.messengerHandles.phone', { allowEmpty: true }),
      },
    },
    blog: {
      instagramUrl: expectString(blog.instagramUrl, 'blog.instagramUrl', { allowEmpty: true }),
      instagramHandle: expectString(blog.instagramHandle, 'blog.instagramHandle', { allowEmpty: true }),
      posts: expectObjectArray(blog.posts, 'blog.posts').map((entry, index) => ({
        id: expectString(entry.id, `blog.posts[${index}].id`, { allowEmpty: false }),
        slug: expectString(entry.slug, `blog.posts[${index}].slug`, { allowEmpty: false }),
        title: validateLocalizedString(entry.title, `blog.posts[${index}].title`),
        caption: validateLocalizedString(entry.caption, `blog.posts[${index}].caption`),
        date: expectString(entry.date, `blog.posts[${index}].date`, { allowEmpty: false }),
        location: entry.location == null ? undefined : validateLocalizedString(entry.location, `blog.posts[${index}].location`),
        tags: entry.tags == null ? undefined : expectStringArray(entry.tags, `blog.posts[${index}].tags`),
        pinned: entry.pinned == null ? undefined : expectBoolean(entry.pinned, `blog.posts[${index}].pinned`),
        status: expectEnum(entry.status, `blog.posts[${index}].status`, ['draft', 'published'] as const),
        media: expectObjectArray(entry.media, `blog.posts[${index}].media`).map((mediaEntry, mediaIndex) => ({
          id: expectString(mediaEntry.id, `blog.posts[${index}].media[${mediaIndex}].id`, { allowEmpty: false }),
          type: expectEnum(mediaEntry.type, `blog.posts[${index}].media[${mediaIndex}].type`, ['image', 'video'] as const),
          src: expectAssetReference(mediaEntry.src, `blog.posts[${index}].media[${mediaIndex}].src`),
          poster:
            mediaEntry.poster == null || mediaEntry.poster === ''
              ? undefined
              : expectAssetReference(mediaEntry.poster, `blog.posts[${index}].media[${mediaIndex}].poster`),
          alt: expectOptionalString(mediaEntry.alt, `blog.posts[${index}].media[${mediaIndex}].alt`),
        })),
      })),
    },
  };
}

function validateCatalogProduct(value: Record<string, unknown>, path: string) {
  return {
    id: expectOptionalString(value.id, `${path}.id`),
    name: expectOptionalString(value.name, `${path}.name`),
    image: value.image == null ? undefined : expectAssetReference(value.image, `${path}.image`),
    description: expectOptionalString(value.description, `${path}.description`),
    series: expectOptionalString(value.series, `${path}.series`),
    price: expectOptionalString(value.price, `${path}.price`),
    compatibility: expectOptionalString(value.compatibility, `${path}.compatibility`),
    features: value.features == null ? undefined : expectStringArray(value.features, `${path}.features`),
    specs: value.specs == null ? undefined : expectStringArray(value.specs, `${path}.specs`),
    url: expectOptionalString(value.url, `${path}.url`),
  };
}

function validateStoreSection(value: unknown, path: string) {
  const source = expectObject(value, path);
  return {
    heroPoster: expectAssetReference(source.heroPoster, `${path}.heroPoster`),
    catalogProducts: expectObjectArray(source.catalogProducts, `${path}.catalogProducts`).map((entry, index) =>
      validateCatalogProduct(entry, `${path}.catalogProducts[${index}]`)
    ),
    gallery: expectObjectArray(source.gallery, `${path}.gallery`).map((entry, index) => ({
      id: expectString(entry.id, `${path}.gallery[${index}].id`, { allowEmpty: false }),
      image: expectAssetReference(entry.image, `${path}.gallery[${index}].image`),
      caption: expectOptionalString(entry.caption, `${path}.gallery[${index}].caption`),
    })),
  };
}

export function validateSiteMediaInput(input: unknown): SiteMedia {
  const source = expectObject(input, 'siteMedia');
  const heroPosters = expectObject(source.heroPosters, 'heroPosters');
  const stores = expectObject(source.stores, 'stores') as Record<StoreId, unknown>;

  return {
    heroPosters: {
      auto: expectAssetReference(heroPosters.auto, 'heroPosters.auto'),
      moto: expectAssetReference(heroPosters.moto, 'heroPosters.moto'),
    },
    stores: {
      kw: validateStoreSection(stores.kw, 'stores.kw'),
      fi: validateStoreSection(stores.fi, 'stores.fi'),
      eventuri: validateStoreSection(stores.eventuri, 'stores.eventuri'),
    },
  };
}

export function validateVideoConfigUpdate(input: unknown): Partial<VideoConfig> {
  const source = expectObject(input, 'videoConfig');
  const next: Partial<VideoConfig> = {};

  if ('heroVideo' in source) {
    next.heroVideo = expectAssetReference(source.heroVideo, 'heroVideo', { allowFilename: true });
  }
  if ('heroEnabled' in source) {
    next.heroEnabled = expectBoolean(source.heroEnabled, 'heroEnabled');
  }
  if ('heroVideoMobile' in source) {
    next.heroVideoMobile =
      source.heroVideoMobile == null || source.heroVideoMobile === ''
        ? undefined
        : expectAssetReference(source.heroVideoMobile, 'heroVideoMobile', { allowFilename: true });
  }
  if ('heroPoster' in source) {
    next.heroPoster =
      source.heroPoster == null || source.heroPoster === ''
        ? undefined
        : expectAssetReference(source.heroPoster, 'heroPoster');
  }
  if ('videos' in source) {
    next.videos = expectStringArray(source.videos, 'videos').map((entry, index) =>
      expectAssetReference(entry, `videos[${index}]`, { allowFilename: true })
    );
  }

  return next;
}
