import type { UrbanCollectionPageConfig } from '@/app/[locale]/shop/data/urbanCollectionPages';
import type { ShopProduct } from '@/lib/shopCatalog';
import { getUrbanCollectionMediaRoleOverrides } from '@/lib/urbanProductOverrides';

export type UrbanVisualIntent = 'front' | 'rear' | 'side' | 'detail' | 'package';
export type UrbanMediaRole = 'hero' | 'front' | 'rear' | 'side' | 'detail' | 'neutral';

type UrbanVisualProduct = Pick<ShopProduct, 'slug' | 'title' | 'category' | 'productType' | 'tags' | 'bundle'>;

type UrbanMediaRoleMap = Record<UrbanMediaRole, string[]>;
type UrbanBlueprintRoleMap = Record<'front' | 'rear' | 'side', string[]>;

export type UrbanCollectionMediaSet = {
  photoGallery: string[];
  rolePhotos: UrbanMediaRoleMap;
  blueprintByIntent: UrbanBlueprintRoleMap;
};

const PACKAGE_REGEX =
  /\bbundle\b|\bpackage\b|\bfull kit\b|\bwidetrack\b|\bsoft kit\b|\bsoftkit\b|\baerokit\b|\baero kit\b|replacement bumper package/i;
const FRONT_REGEX =
  /\bfront bumper\b|\bgrille\b|\bhood\b|\bsplitter\b|\bfront lip\b|\bcanards\b|\bdrl\b|\broof module\b|\broof light\b/i;
const REAR_REGEX =
  /\brear bumper\b|\bdiffuser\b|\brear spoiler\b|\brear wing\b|\bexhaust surround\b|\bexhaust finisher\b|\bspare wheel cover\b/i;
const SIDE_REGEX =
  /\bside steps\b|\bside skirts\b|\barches\b|\bwheel arches\b|\bmirror caps\b|\bside vents\b|\bdoor trims\b|\bwheel package\b/i;
const DETAIL_REGEX =
  /\bbadge\b|\btrim\b|\baccessor(y|ies)\b|\bkey fob\b|\bfinisher\b|\bemblem\b|\bcover\b/i;

function normalizeText(value: string | null | undefined) {
  return String(value ?? '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function normalizeUrbanMediaUrl(url: string | null | undefined) {
  const raw = String(url ?? '').replace(/^["']|["']$/g, '').trim();
  if (!raw) return '';
  return raw.startsWith('//') ? `https:${raw}` : raw;
}

function uniqueUrls(urls: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      urls
        .map((url) => normalizeUrbanMediaUrl(url))
        .filter(Boolean)
    )
  );
}

function createRoleMap(): UrbanMediaRoleMap {
  return {
    hero: [],
    front: [],
    rear: [],
    side: [],
    detail: [],
    neutral: [],
  };
}

function createBlueprintMap(): UrbanBlueprintRoleMap {
  return {
    front: [],
    rear: [],
    side: [],
  };
}

function pushUnique(target: string[], value: string | null | undefined) {
  const normalized = normalizeUrbanMediaUrl(value);
  if (normalized && !target.includes(normalized)) {
    target.push(normalized);
  }
}

function inferRealPhotoRoles(
  url: string,
  hintText: string,
  sourceKind: 'hero' | 'overview' | 'banner' | 'gallery'
): UrbanMediaRole[] {
  const haystack = normalizeText(`${url} ${hintText}`);
  const roles: UrbanMediaRole[] = [];

  if (sourceKind === 'hero') {
    roles.push('hero');
  }

  if (/\bdetail\b|\bclose\b|\bmirror\b|\btrim\b|\bbadge\b|\bemblem\b/.test(haystack)) {
    roles.push('detail');
  } else if (/\brear\b|\bback\b|\bdiffuser\b|\bexhaust\b|\bspoiler\b/.test(haystack)) {
    roles.push('rear');
  } else if (/\bleft\b|\bright\b|\bside\b|\bprofile\b|\bwheel\b|\barch\b/.test(haystack)) {
    roles.push('side');
  } else if (/\bfront\b|\bgrille\b|\bhood\b|\bsplitter\b|\bcanard\b/.test(haystack)) {
    roles.push('front');
  } else if (sourceKind !== 'hero') {
    roles.push('neutral');
  }

  if (!roles.length) {
    roles.push('neutral');
  }

  return Array.from(new Set(roles));
}

function blueprintIntentFromLabel(label: string | null | undefined): keyof UrbanBlueprintRoleMap | null {
  const normalized = normalizeText(label);
  if (normalized.includes('front')) return 'front';
  if (normalized.includes('back') || normalized.includes('rear')) return 'rear';
  if (normalized.includes('left') || normalized.includes('right') || normalized.includes('side')) return 'side';
  return null;
}

export function resolveUrbanVisualIntent(product: UrbanVisualProduct): UrbanVisualIntent {
  if (product.bundle) {
    return 'package';
  }

  const haystack = normalizeText(
    [
      product.title.en,
      product.title.ua,
      product.category.en,
      product.category.ua,
      product.productType,
      ...(product.tags ?? []),
    ].join(' ')
  );

  if (PACKAGE_REGEX.test(haystack)) return 'package';
  if (REAR_REGEX.test(haystack)) return 'rear';
  if (FRONT_REGEX.test(haystack)) return 'front';
  if (SIDE_REGEX.test(haystack)) return 'side';
  if (DETAIL_REGEX.test(haystack)) return 'detail';
  return 'detail';
}

export function resolveUrbanCardVisualIntent(product: UrbanVisualProduct): UrbanVisualIntent {
  const haystack = normalizeText(
    [
      product.title.en,
      product.title.ua,
      product.category.en,
      product.category.ua,
      product.productType,
      ...(product.tags ?? []),
    ].join(' ')
  );

  if (REAR_REGEX.test(haystack)) return 'rear';
  if (FRONT_REGEX.test(haystack)) return 'front';
  if (SIDE_REGEX.test(haystack)) return 'side';
  if (DETAIL_REGEX.test(haystack)) return 'detail';
  if (product.bundle || PACKAGE_REGEX.test(haystack)) return 'package';
  return 'detail';
}

export function buildUrbanCollectionMediaSet(
  config: UrbanCollectionPageConfig | null | undefined,
  collectionHandle?: string | null
): UrbanCollectionMediaSet {
  const photoGallery: string[] = [];
  const rolePhotos = createRoleMap();
  const blueprintByIntent = createBlueprintMap();

  if (!config) {
    return { photoGallery, rolePhotos, blueprintByIntent };
  }

  const addPhoto = (
    url: string | null | undefined,
    hintText: string,
    sourceKind: 'hero' | 'overview' | 'banner' | 'gallery'
  ) => {
    const normalized = normalizeUrbanMediaUrl(url);
    if (!normalized) {
      return;
    }
    pushUnique(photoGallery, normalized);
    inferRealPhotoRoles(normalized, hintText, sourceKind).forEach((role) => {
      pushUnique(rolePhotos[role], normalized);
    });
  };

  addPhoto(config.hero.externalPosterUrl, `${config.hero.title} ${config.hero.subtitle}`, 'hero');
  addPhoto(config.overview.externalImageUrl, `${config.overview.title} ${config.overview.subtitle}`, 'overview');
  config.bannerStack.banners
    .filter((banner) => banner.mediaType === 'image')
    .forEach((banner) =>
      addPhoto(
        banner.externalImageUrl,
        `${banner.title} ${banner.subtitle} ${banner.eyebrow}`,
        'banner'
      )
    );
  config.gallery.slides.forEach((slide) => addPhoto(slide.externalImageUrl, slide.caption, 'gallery'));

  config.blueprint.views.forEach((view) => {
    const intent = blueprintIntentFromLabel(view.positionLabel);
    if (intent) {
      pushUnique(blueprintByIntent[intent], view.externalImageUrl);
    }
  });

  const overrides = getUrbanCollectionMediaRoleOverrides(collectionHandle);
  if (overrides) {
    Object.entries(overrides).forEach(([role, urls]) => {
      if (role in rolePhotos) {
        rolePhotos[role as UrbanMediaRole] = uniqueUrls([...(urls ?? []), ...rolePhotos[role as UrbanMediaRole]]);
      }
    });
  }

  return {
    photoGallery: uniqueUrls(photoGallery),
    rolePhotos,
    blueprintByIntent,
  };
}
