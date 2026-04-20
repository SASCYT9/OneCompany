import test from 'node:test';
import assert from 'node:assert/strict';
import type { UrbanCollectionPageConfig } from '../../../src/app/[locale]/shop/data/urbanCollectionPages';
import {
  buildUrbanCollectionImagePool,
  isUrbanPlaceholderImage,
  resolveUrbanCollectionCardImage,
  resolveUrbanProductImage,
} from '../../../src/lib/urbanImageUtils';

const W465_PROGRAM_FALLBACK =
  '/images/shop/urban/carousel/models/gwagonWidetrack2024/webp/urban-automotive-g-wagon-g63-w465-widetrack-5-2560.webp';
const SOFTKIT_PROGRAM_FALLBACK = '/images/shop/urban/carousel/models/gwagonSoftKit/carousel-1-1920.jpg';
const DEFENDER_IMAGE =
  '/images/shop/urban/carousel/models/defender2020Plus/2025Updates/webp/urban-automotive-defender-2020-onwards-1-2560.webp';
const W465_PRODUCT_IMAGE =
  '/images/shop/urban/carousel/models/gwagonWidetrack2024/webp/urban-automotive-g-wagon-g63-w465-widetrack-5-2560.webp';

test('treats Shopify Urban silhouette PNGs with query strings as placeholders', () => {
  const url =
    'https://cdn.shopify.com/s/files/1/0733/4058/4242/files/Gwagon_e9292903-5bf9-49aa-92da-8264c9bb9586.png?v=1776081527';

  assert.equal(isUrbanPlaceholderImage(url), true);
});

test('resolves Urban placeholder images to a collection fallback image', () => {
  const url =
    'https://cdn.shopify.com/s/files/1/0733/4058/4242/files/Gwagon_e9292903-5bf9-49aa-92da-8264c9bb9586.png?v=1776081527';

  const resolved = resolveUrbanProductImage(url, ['mercedes-g-wagon-w465-widetrack']);

  assert.equal(resolved.includes('image-coming-soon'), false);
  assert.equal(resolved.includes('Gwagon_e9292903-5bf9-49aa-92da-8264c9bb9586.png'), false);
});

function buildCollectionConfig(): UrbanCollectionPageConfig {
  return {
    handle: 'mercedes-g-wagon-w465-widetrack',
    hero: {
      eyebrow: '',
      eyebrowUk: '',
      title: '',
      titleUk: '',
      subtitle: '',
      subtitleUk: '',
      buttonLabel: '',
      buttonLabelUk: '',
      buttonLink: '',
      buttonNewTab: false,
      externalPosterUrl: '/images/shop/urban/hero/models/gwagonWidetrack2024/hero-1-1920.jpg',
      overlayOpacity: 0,
      mobileHeight: 0,
      desktopHeight: 0,
      accentColor: '#fff',
    },
    overview: {
      eyebrow: '',
      eyebrowUk: '',
      title: '',
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
      externalImageUrl: '/images/shop/urban/overview/models/gwagonWidetrack2024/overview-1.jpg',
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
        { externalImageUrl: '/images/shop/urban/gallery/models/gwagonWidetrack2024/gallery-1.jpg', caption: '' },
        { externalImageUrl: '/images/shop/urban/gallery/models/gwagonWidetrack2024/gallery-2.jpg', caption: '' },
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
          externalImageUrl: '/images/shop/urban/banner/models/gwagonWidetrack2024/banner-1.jpg',
          eyebrow: '',
          eyebrowUk: '',
          title: '',
          titleUk: '',
          subtitle: '',
          subtitleUk: '',
          buttonLabel: '',
          buttonLabelUk: '',
          buttonLink: '',
        },
        {
          mediaType: 'video',
          externalImageUrl: 'https://cdn.example.com/urban-video.mp4',
          eyebrow: '',
          eyebrowUk: '',
          title: '',
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
          positionLabel: '',
          titleEn: '',
          titleUk: '',
          partsEn: '',
          partsUk: '',
          externalImageUrl: '/images/shop/urban/blueprint/models/gwagonWidetrack2024/view-1.jpg',
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

test('builds a real Urban collection image pool from collection page media', () => {
  const images = buildUrbanCollectionImagePool(buildCollectionConfig(), ['mercedes-g-wagon-w465-widetrack']);

  assert.ok(images.length >= 6);
  assert.ok(images.every((url) => !isUrbanPlaceholderImage(url)));
  assert.equal(images.includes('https://cdn.example.com/urban-video.mp4'), false);
});

test('resolves placeholder card images to a stable collection photo while preserving real images', () => {
  const placeholder =
    'https://cdn.shopify.com/s/files/1/0733/4058/4242/files/Gwagon_e9292903-5bf9-49aa-92da-8264c9bb9586.png?v=1776081527';
  const imagePool = buildUrbanCollectionImagePool(buildCollectionConfig(), ['mercedes-g-wagon-w465-widetrack']);

  const first = resolveUrbanCollectionCardImage(
    placeholder,
    ['mercedes-g-wagon-w465-widetrack'],
    imagePool,
    'urb-bun-25358207-v1'
  );
  const second = resolveUrbanCollectionCardImage(
    placeholder,
    ['mercedes-g-wagon-w465-widetrack'],
    imagePool,
    'urb-bun-25358207-v1'
  );

  assert.equal(first, W465_PROGRAM_FALLBACK);
  assert.equal(first, second);
  assert.equal(
    resolveUrbanCollectionCardImage(
      '/images/shop/urban/real-product-shot.jpg',
      ['mercedes-g-wagon-w465-widetrack'],
      imagePool,
      'real'
    ),
    '/images/shop/urban/real-product-shot.jpg'
  );
});

test('rejects cross-model Defender images for G-Wagon Soft Kit products', () => {
  const resolved = resolveUrbanCollectionCardImage(
    DEFENDER_IMAGE,
    ['mercedes-g-wagon-softkit'],
    [],
    'urb-bun-25358198-v1'
  );

  assert.equal(resolved, SOFTKIT_PROGRAM_FALLBACK);
});

test('prefers the first compatible gallery image when the primary image is a cross-model mismatch', () => {
  const imagePool = buildUrbanCollectionImagePool(buildCollectionConfig(), ['mercedes-g-wagon-w465-widetrack']);
  const resolved = resolveUrbanCollectionCardImage(
    DEFENDER_IMAGE,
    ['mercedes-g-wagon-w465-widetrack'],
    imagePool,
    'urb-bun-25358207-v1',
    [DEFENDER_IMAGE, W465_PRODUCT_IMAGE]
  );

  assert.equal(resolved, W465_PRODUCT_IMAGE);
  assert.equal(resolveUrbanProductImage(DEFENDER_IMAGE, ['mercedes-g-wagon-softkit'], 'urb-bun-25358198-v1'), SOFTKIT_PROGRAM_FALLBACK);
});
