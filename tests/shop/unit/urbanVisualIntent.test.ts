import test from 'node:test';
import assert from 'node:assert/strict';
import type { UrbanCollectionPageConfig } from '../../../src/app/[locale]/shop/data/urbanCollectionPages';
import { buildUrbanCollectionPhotoGallery, buildUrbanCollectionImagePool, resolveUrbanCollectionCardImage, resolveUrbanProductGallery } from '../../../src/lib/urbanImageUtils';
import { resolveUrbanCardVisualIntent, resolveUrbanVisualIntent } from '../../../src/lib/urbanVisualIntent';

function buildCollectionConfig(): UrbanCollectionPageConfig {
  return {
    handle: 'mercedes-g-wagon-w465-widetrack',
    hero: {
      eyebrow: '',
      eyebrowUk: '',
      title: 'Urban G-Wagon Hero',
      titleUk: '',
      subtitle: '',
      subtitleUk: '',
      buttonLabel: '',
      buttonLabelUk: '',
      buttonLink: '',
      buttonNewTab: false,
      externalPosterUrl: '/images/shop/urban/test/hero-front.jpg',
      overlayOpacity: 0,
      mobileHeight: 0,
      desktopHeight: 0,
      accentColor: '#fff',
    },
    overview: {
      eyebrow: '',
      eyebrowUk: '',
      title: 'Urban G-Wagon Overview',
      titleUk: '',
      badge: '',
      badgeUk: '',
      subtitle: '',
      subtitleUk: '',
      description: '',
      descriptionUk: '',
      buttonLabel: '',
      buttonLabelUk: '',
      buttonLink: '',
      buttonNewTab: false,
      externalImageUrl: '/images/shop/urban/test/overview-side.jpg',
      highlights: [],
      paddingTop: 0,
      paddingBottom: 0,
      backgroundColor: '#000',
      borderColor: '#111',
      copyColor: '#fff',
    },
    gallery: {
      label: '',
      labelUk: '',
      slides: [
        { externalImageUrl: '/images/shop/urban/test/gallery-neutral-1.jpg', caption: 'Urban G-Wagon - Image 1' },
        { externalImageUrl: '/images/shop/urban/test/gallery-detail-1.jpg', caption: 'Urban G-Wagon - Detail 1' },
      ],
      paddingTop: 0,
      paddingBottom: 0,
      backgroundColor: '#000',
      borderColor: '#111',
    },
    videoPointer: null,
    bannerStack: {
      banners: [
        {
          mediaType: 'image',
          externalImageUrl: '/images/shop/urban/test/banner-rear.jpg',
          eyebrow: '',
          eyebrowUk: '',
          title: 'Rear banner',
          titleUk: '',
          subtitle: '',
          subtitleUk: '',
          buttonLabel: '',
          buttonLabelUk: '',
          buttonLink: '',
        },
      ],
      overlayOpacity: 0,
      mobileHeight: 0,
      desktopHeight: 0,
      borderColor: '#111',
    },
    blueprint: {
      eyebrow: '',
      eyebrowUk: '',
      heading: '',
      headingUk: '',
      subheading: '',
      subheadingUk: '',
      ctaLabel: '',
      ctaLabelUk: '',
      ctaLink: '',
      ctaNewTab: false,
      views: [
        {
          positionLabel: 'Front',
          titleEn: '',
          titleUk: '',
          partsEn: '',
          partsUk: '',
          externalImageUrl: '/images/shop/urban/test/blueprint-front.png',
        },
        {
          positionLabel: 'Left',
          titleEn: '',
          titleUk: '',
          partsEn: '',
          partsUk: '',
          externalImageUrl: '/images/shop/urban/test/blueprint-left.png',
        },
        {
          positionLabel: 'Back',
          titleEn: '',
          titleUk: '',
          partsEn: '',
          partsUk: '',
          externalImageUrl: '/images/shop/urban/test/blueprint-back.png',
        },
      ],
      paddingTop: 0,
      paddingBottom: 0,
      backgroundColor: '#fff',
      cardBackground: '#fff',
      textColor: '#111',
      mutedColor: '#666',
      separatorColor: '#ddd',
    },
    productGrid: {
      productsPerPage: 12,
      columnsDesktop: 3,
      columnsMobile: 2,
      enableFiltering: true,
      enableSorting: true,
      paddingTop: 0,
      paddingBottom: 0,
    },
  };
}

test('resolves Urban visual intent for front, rear, side, and package products', () => {
  assert.equal(
    resolveUrbanVisualIntent({
      slug: 'roof-module',
      title: { ua: 'Даховий модуль Urban', en: 'Urban Roof Module' },
      category: { ua: '', en: '' },
      productType: 'Lighting',
      tags: [],
      bundle: null,
    } as never),
    'front'
  );

  assert.equal(
    resolveUrbanVisualIntent({
      slug: 'rear-bumper',
      title: { ua: 'Задній бампер Urban', en: 'Urban Rear Bumper' },
      category: { ua: '', en: '' },
      productType: 'Body',
      tags: [],
      bundle: null,
    } as never),
    'rear'
  );

  assert.equal(
    resolveUrbanVisualIntent({
      slug: 'wheel-package',
      title: { ua: 'Пакет коліс Urban', en: 'Urban Wheel Package' },
      category: { ua: '', en: '' },
      productType: 'Wheels',
      tags: [],
      bundle: null,
    } as never),
    'side'
  );

  assert.equal(
    resolveUrbanVisualIntent({
      slug: 'widetrack-package',
      title: { ua: 'Пакет Widetrack', en: 'Urban Widetrack Package' },
      category: { ua: '', en: '' },
      productType: 'Bundle',
      tags: [],
      bundle: { items: [], availableQuantity: 1 },
    } as never),
    'package'
  );
});

test('prefers directional intent for package cards before falling back to generic package cover', () => {
  assert.equal(
    resolveUrbanCardVisualIntent({
      slug: 'front-package',
      title: { ua: 'Передній пакет Urban', en: 'Urban Front Bumper Package' },
      category: { ua: '', en: '' },
      productType: 'Bundle',
      tags: [],
      bundle: { items: [], availableQuantity: 1 },
    } as never),
    'front'
  );

  assert.equal(
    resolveUrbanCardVisualIntent({
      slug: 'rear-package',
      title: { ua: 'Задній пакет Urban', en: 'Urban Rear Bumper Package' },
      category: { ua: '', en: '' },
      productType: 'Bundle',
      tags: [],
      bundle: { items: [], availableQuantity: 1 },
    } as never),
    'rear'
  );

  assert.equal(
    resolveUrbanCardVisualIntent({
      slug: 'wheel-package',
      title: { ua: 'Пакет коліс Urban', en: 'Urban Wheel Package' },
      category: { ua: '', en: '' },
      productType: 'Bundle',
      tags: [],
      bundle: { items: [], availableQuantity: 1 },
    } as never),
    'side'
  );
});

test('builds package photo gallery from real collection photos only and preserves order', () => {
  const config = buildCollectionConfig();
  const gallery = buildUrbanCollectionPhotoGallery(config, config.handle);

  assert.deepEqual(gallery, [
    '/images/shop/urban/test/hero-front.jpg',
    '/images/shop/urban/test/overview-side.jpg',
    '/images/shop/urban/test/banner-rear.jpg',
    '/images/shop/urban/test/gallery-neutral-1.jpg',
    '/images/shop/urban/test/gallery-detail-1.jpg',
  ]);
  assert.equal(gallery.some((url) => url.includes('blueprint-')), false);
});

test('prefers a matching real collection photo before blueprint fallback for single-part cards', () => {
  const config = buildCollectionConfig();
  const imagePool = buildUrbanCollectionImagePool(config, [config.handle]);

  const resolved = resolveUrbanCollectionCardImage(
    null,
    [config.handle],
    imagePool,
    'rear-bumper',
    [],
    {
      slug: 'rear-bumper',
      title: { ua: 'Задній бампер Urban', en: 'Urban Rear Bumper' },
      category: { ua: '', en: '' },
      productType: 'Body',
      tags: [],
      bundle: null,
    } as never
  );

  assert.equal(resolved, '/images/shop/urban/test/banner-rear.jpg');
});

test('package cards use directional collection covers instead of collapsing to one generic package image', () => {
  const config = buildCollectionConfig();
  const imagePool = buildUrbanCollectionImagePool(config, [config.handle]);

  const frontPackage = resolveUrbanCollectionCardImage(
    '/images/shop/urban/test/hero-front.jpg',
    [config.handle],
    imagePool,
    'front-package',
    [],
    {
      slug: 'front-package',
      title: { ua: 'Передній пакет Urban', en: 'Urban Front Bumper Package' },
      category: { ua: '', en: '' },
      productType: 'Bundle',
      tags: [],
      bundle: { items: [], availableQuantity: 1 },
    } as never
  );

  const rearPackage = resolveUrbanCollectionCardImage(
    '/images/shop/urban/test/hero-front.jpg',
    [config.handle],
    imagePool,
    'rear-package',
    [],
    {
      slug: 'rear-package',
      title: { ua: 'Задній пакет Urban', en: 'Urban Rear Bumper Package' },
      category: { ua: '', en: '' },
      productType: 'Bundle',
      tags: [],
      bundle: { items: [], availableQuantity: 1 },
    } as never
  );

  const wheelPackage = resolveUrbanCollectionCardImage(
    '/images/shop/urban/test/hero-front.jpg',
    [config.handle],
    imagePool,
    'wheel-package',
    [],
    {
      slug: 'wheel-package',
      title: { ua: 'Пакет коліс Urban', en: 'Urban Wheel Package' },
      category: { ua: '', en: '' },
      productType: 'Bundle',
      tags: [],
      bundle: { items: [], availableQuantity: 1 },
    } as never
  );

  assert.equal(frontPackage, '/images/shop/urban/test/hero-front.jpg');
  assert.equal(rearPackage, '/images/shop/urban/test/banner-rear.jpg');
  assert.equal(wheelPackage, '/images/shop/urban/test/overview-side.jpg');
});

test('uses blueprint fallback when a matching real photo is missing', () => {
  const collectionImages = [
    '/images/shop/urban/test/hero-front.jpg',
    '/images/shop/urban/test/gallery-neutral-1.jpg',
    '/images/shop/urban/test/blueprint-back.png',
  ];

  const resolved = resolveUrbanCollectionCardImage(
    null,
    ['mercedes-g-wagon-w465-widetrack'],
    collectionImages,
    'rear-bumper',
    [],
    {
      slug: 'rear-bumper',
      title: { ua: 'Задній бампер Urban', en: 'Urban Rear Bumper' },
      category: { ua: '', en: '' },
      productType: 'Body',
      tags: [],
      bundle: null,
    } as never
  );

  assert.equal(resolved, '/images/shop/urban/test/blueprint-back.png');
});

test('rejects cross-model own images before resolving card fallback', () => {
  const config = buildCollectionConfig();
  const imagePool = buildUrbanCollectionImagePool(config, [config.handle]);
  const defenderImage =
    '/images/shop/urban/carousel/models/defender2020Plus/2025Updates/webp/urban-automotive-defender-2020-onwards-1-2560.webp';

  const resolved = resolveUrbanCollectionCardImage(
    defenderImage,
    [config.handle],
    imagePool,
    'rear-bumper',
    [],
    {
      slug: 'rear-bumper',
      title: { ua: 'Задній бампер Urban', en: 'Urban Rear Bumper' },
      category: { ua: '', en: '' },
      productType: 'Body',
      tags: [],
      bundle: null,
    } as never
  );

  assert.equal(resolved, '/images/shop/urban/test/banner-rear.jpg');
});

test('resolves full package PDP gallery from the collection photo gallery', () => {
  const config = buildCollectionConfig();
  const gallery = resolveUrbanProductGallery(
    {
      slug: 'urb-package',
      title: { ua: 'Пакет Widetrack', en: 'Urban Widetrack Package' },
      category: { ua: '', en: '' },
      productType: 'Bundle',
      tags: [],
      bundle: { items: [], availableQuantity: 1 },
      image: null,
      gallery: [],
    } as never,
    [config.handle],
    config
  );

  assert.deepEqual(gallery, buildUrbanCollectionPhotoGallery(config, config.handle));
});

test('single-part PDP does not expand into the full collection gallery', () => {
  const config = buildCollectionConfig();
  const gallery = resolveUrbanProductGallery(
    {
      slug: 'roof-module',
      title: { ua: 'Даховий модуль Urban', en: 'Urban Roof Module' },
      category: { ua: '', en: '' },
      productType: 'Lighting',
      tags: [],
      bundle: null,
      image: null,
      gallery: [],
    } as never,
    [config.handle],
    config
  );

  assert.deepEqual(gallery, ['/images/shop/urban/test/hero-front.jpg']);
  assert.notDeepEqual(gallery, buildUrbanCollectionPhotoGallery(config, config.handle));
});
