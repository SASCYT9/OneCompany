/**
 * Server-side shop catalog: DB (ShopProduct) + static fallback.
 * Use for [slug] page and sitemap. When DATABASE_URL is set and migration applied,
 * products from admin appear; otherwise only static catalog is used.
 */

import fs from 'fs';
import path from 'path';

import {
  SHOP_PRODUCTS,
  getShopProductBySlug as getStaticBySlug,
  type ShopMoneySet,
  type ShopProduct,
  type ShopScope,
  type ShopStock,
} from '@/lib/shopCatalog';
import {
  adminProductInclude,
  type AdminShopProductRecord,
} from '@/lib/shopAdminCatalog';
import {
  isLikelyBrabusOverviewProductLike,
  scoreBrabusProductCandidateLike,
} from '@/lib/brabusCatalogCleanup';
import { isBrabusLocalImage, resolveBrabusFallbackImage } from '@/lib/brabusImageFallbacks';
import { resolveBundleInventory } from '@/lib/shopBundles';
import { prisma } from '@/lib/prisma';
import { sanitizeRichTextHtml } from '@/lib/sanitizeRichTextHtml';
import { resolveUrbanThemeAssetUrl } from '@/lib/urbanThemeAssets';
import { resolveEnglishCategory } from '@/lib/shopCategoryTranslation';
import {
  buildUrbanGpSafeFallbackDescription,
  getUrbanCuratedDescriptionOverride,
  hasPoorUrbanUaMachineCopy,
  isUnsafeUrbanGpDescription,
} from '@/lib/urbanGpDescriptionFallback';
import { buildUrbanEditorialCopy } from '@/lib/urbanEditorialCopy';

const BRABUS_LOCAL_ASSETS_DEPLOYED = process.env.BRABUS_LOCAL_ASSETS_DEPLOYED === '1';
const shouldUseDeployedBrabusFallback =
  process.env.NODE_ENV === 'production' && !BRABUS_LOCAL_ASSETS_DEPLOYED;
const FEED_MANAGED_BRANDS = new Set(['ADRO', 'AKRAPOVIC', 'CSF', 'OHLINS']);
const BRAND_FALLBACK_IMAGES: Record<string, string> = {
  ADRO: '/images/shop/adro/adro-hero-m4.jpg',
  AKRAPOVIC: '/images/shop/akrapovic/factory-fallback.jpg',
  CSF: '/images/shop/csf/factory-fallback.jpg',
  OHLINS: '/images/shop/ohlins/factory-fallback.jpg',
};
const LOCAL_SHOP_BRAND_IMAGE_PREFIXES: Record<string, string> = {
  ADRO: '/images/shop/adro/',
  AKRAPOVIC: '/images/shop/akrapovic/',
  BRABUS: '/images/shop/brabus/',
  CSF: '/images/shop/csf/',
  OHLINS: '/images/shop/ohlins/',
};

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => String(value ?? '').trim()).filter(Boolean)));
}

const SHOP_PRODUCT_FALLBACK_IMAGE = '/images/placeholders/product-fallback.svg';

const SHOP_PRODUCT_IMAGE_OVERRIDES: Record<string, { image: string; gallery?: string[] }> = {
  'URB-DIF-25358211-V1': {
    image:
      '/images/shop/urban/products/urus-se/410-0001_Audi_20RS3_208Y_20-_20Visual_20Carbon_20Fibre_20Diffuser_20Assembly_20with_20URBAN_20Branding_1.png',
    gallery: [
      '/images/shop/urban/products/urus-se/410-0001_Audi_20RS3_208Y_20-_20Visual_20Carbon_20Fibre_20Diffuser_20Assembly_20with_20URBAN_20Branding_1.png',
      '/images/shop/urban/products/urus-se/410-0001_Audi_20RS3_208Y_20-_20Visual_20Carbon_20Fibre_20Diffuser_20Assembly_20with_20URBAN_20Branding_2.png',
      '/images/shop/urban/products/urus-se/410-0001_Audi_20RS3_208Y_20-_20Visual_20Carbon_20Fibre_20Diffuser_20Assembly_20with_20URBAN_20Branding_3.png',
      '/images/shop/urban/products/urus-se/410-0001_Audi_20RS3_208Y_20-_20Visual_20Carbon_20Fibre_20Diffuser_20Assembly_20with_20URBAN_20Branding_5.png',
      '/images/shop/urban/products/urus-se/Audi_RS3_Saloon_Kit_Back.jpg',
      '/images/shop/urban/products/urus-se/Audi_RS3_Saloon_1.jpg',
    ],
  },
  'URB-FRO-25358209-V1': {
    image:
      '/images/shop/urban/products/urus-se/410-0002_Audi_20RS3_208Y_20-_20Visual_20Carbon_20Fibre_20Front_20Bumper_20Intake_20Overlays_1.png',
    gallery: [
      '/images/shop/urban/products/urus-se/410-0002_Audi_20RS3_208Y_20-_20Visual_20Carbon_20Fibre_20Front_20Bumper_20Intake_20Overlays_1.png',
      '/images/shop/urban/products/urus-se/410-0002_Audi_20RS3_208Y_20-_20Visual_20Carbon_20Fibre_20Front_20Bumper_20Intake_20Overlays_2.png',
      '/images/shop/urban/products/urus-se/410-0002_Audi_20RS3_208Y_20-_20Visual_20Carbon_20Fibre_20Front_20Bumper_20Intake_20Overlays_3.png',
      '/images/shop/urban/products/urus-se/Audi_RS3_Saloon_Kit_Front.jpg',
      '/images/shop/urban/products/urus-se/Audi_RS3_Saloon.jpg',
    ],
  },
  'URB-SIL-25358218-V1': {
    image:
      '/images/shop/urban/products/urus-se/410-0017_Audi_20RS4_20B9_20-_209.5_20-_20Visual_20Carbon_20Fibre_20Rear_20Diffuser_20Spats_20LH_1.png',
    gallery: [
      '/images/shop/urban/products/urus-se/410-0017_Audi_20RS4_20B9_20-_209.5_20-_20Visual_20Carbon_20Fibre_20Rear_20Diffuser_20Spats_20LH_1.png',
      '/images/shop/urban/products/urus-se/410-0017_Audi_20RS4_20B9_20-_209.5_20-_20Visual_20Carbon_20Fibre_20Rear_20Diffuser_20Spats_20LH_2.png',
      '/images/shop/urban/products/urus-se/Audi_RS4_B95_Kit_Back.jpg',
      '/images/shop/urban/products/urus-se/Audi_RS4_B95_1.jpg',
    ],
  },
  'URB-SPL-25358221-V1': {
    image:
      '/images/shop/urban/products/urus-se/410-0015_Audi_20RS4_20B9_20-_20Visual_20Carbon_20Fibre_20Front_20Splitter_1.png',
    gallery: [
      '/images/shop/urban/products/urus-se/410-0015_Audi_20RS4_20B9_20-_20Visual_20Carbon_20Fibre_20Front_20Splitter_1.png',
      '/images/shop/urban/products/urus-se/410-0015_Audi_20RS4_20B9_20-_20Visual_20Carbon_20Fibre_20Front_20Splitter_2_b5b05de5-2f26-4305-a38d-1626af38ff52.png',
      '/images/shop/urban/products/urus-se/410-0015_Audi_20RS4_20B9_20-_20Visual_20Carbon_20Fibre_20Front_20Splitter_3.png',
      '/images/shop/urban/products/urus-se/410-0015_Audi_20RS4_20B9_20-_20Visual_20Carbon_20Fibre_20Front_20Splitter_4.png',
      '/images/shop/urban/products/urus-se/410-0015_Audi_20RS4_20B9_20-_20Visual_20Carbon_20Fibre_20Front_20Splitter_5.png',
      '/images/shop/urban/products/urus-se/Audi_RS4_B95_Kit_Front.jpg',
    ],
  },
  'URB-SPO-25358219-V1': {
    image:
      '/images/shop/urban/products/urus-se/410-0016_Audi_20RS4_20B9_20-_209.5_20-_20Visual_20Carbon_20Fibre_20Lower_20Spoiler_1.png',
    gallery: [
      '/images/shop/urban/products/urus-se/410-0016_Audi_20RS4_20B9_20-_209.5_20-_20Visual_20Carbon_20Fibre_20Lower_20Spoiler_1.png',
      '/images/shop/urban/products/urus-se/410-0016_Audi_20RS4_20B9_20-_209.5_20-_20Visual_20Carbon_20Fibre_20Lower_20Spoiler_2.png',
      '/images/shop/urban/products/urus-se/Audi_RS4_B95_Kit_Back.jpg',
      '/images/shop/urban/products/urus-se/Audi_RS4_B95.jpg',
    ],
  },
  'URB-SPO-25358220-V1': {
    image:
      '/images/shop/urban/products/urus-se/410-0021_Audi_20RS4_20B9_20-_209.5_20-_20Visual_20Carbon_20Fibre_20Upper_20Spoiler_1.png',
    gallery: [
      '/images/shop/urban/products/urus-se/410-0021_Audi_20RS4_20B9_20-_209.5_20-_20Visual_20Carbon_20Fibre_20Upper_20Spoiler_1.png',
      '/images/shop/urban/products/urus-se/410-0021_Audi_20RS4_20B9_20-_209.5_20-_20Visual_20Carbon_20Fibre_20Upper_20Spoiler_2.png',
      '/images/shop/urban/products/urus-se/Audi_RS4_B95_Kit_Back.jpg',
      '/images/shop/urban/products/urus-se/Audi_RS4_B95_1.jpg',
    ],
  },
  'URB-DIF-25358226-V1': {
    image:
      '/images/shop/urban/products/urus-se/410-0029_Audi_20RS6_20C8_20-_20Visual_20Carbon_20Fibre_20Rear_20Diffuser_20Assembly_20with_20Urban_20Branding_1.png',
    gallery: [
      '/images/shop/urban/products/urus-se/410-0029_Audi_20RS6_20C8_20-_20Visual_20Carbon_20Fibre_20Rear_20Diffuser_20Assembly_20with_20Urban_20Branding_1.png',
      '/images/shop/urban/products/urus-se/410-0029_Audi_20RS6_20C8_20-_20Visual_20Carbon_20Fibre_20Rear_20Diffuser_20Assembly_20with_20Urban_20Branding_2.png',
      'https://smgassets.blob.core.windows.net/customers/urban/dist/img/kits/models/rs6/back.jpg',
      'https://smgassets.blob.core.windows.net/customers/urban/dist/img/carousel/models/rs6/carousel-1-1920.jpg',
    ],
  },
  'URB-SPO-25358227-V1': {
    image:
      '/images/shop/urban/products/urus-se/410-0030_Audi_20RS6_20C8_20-_20Visual_20Carbon_20Fibre_20Rear_20Lip_20Spoiler_20-_20Lower_1.png',
    gallery: [
      '/images/shop/urban/products/urus-se/410-0030_Audi_20RS6_20C8_20-_20Visual_20Carbon_20Fibre_20Rear_20Lip_20Spoiler_20-_20Lower_1.png',
      '/images/shop/urban/products/urus-se/410-0030_Audi_20RS6_20C8_20-_20Visual_20Carbon_20Fibre_20Rear_20Lip_20Spoiler_20-_20Lower_2.png',
      '/images/shop/urban/products/urus-se/410-0030_Audi_20RS6_20C8_20-_20Visual_20Carbon_20Fibre_20Rear_20Lip_20Spoiler_20-_20Lower_3.png',
      'https://smgassets.blob.core.windows.net/customers/urban/dist/img/kits/models/rs6/back.jpg',
      'https://smgassets.blob.core.windows.net/customers/urban/dist/img/carousel/models/rs6/carousel-2-1920.jpg',
    ],
  },
  'URB-FRO-25358230-V1': {
    image: 'https://cdn.shopify.com/s/files/1/0733/4058/4242/files/RSQ8.png?v=1767898805',
    gallery: [
      'https://cdn.shopify.com/s/files/1/0733/4058/4242/files/RSQ8.png?v=1767898805',
      'https://smgassets.blob.core.windows.net/customers/urban/dist/img/kits/models/rsq8/front.jpg',
      'https://smgassets.blob.core.windows.net/customers/urban/dist/img/carousel/models/rsq8/carousel-1-1920.jpg',
      'https://smgassets.blob.core.windows.net/customers/urban/dist/img/hero/models/rsq8/hero-1-1920.jpg',
    ],
  },
  'URB-SPO-26006234-V1': {
    image:
      '/images/shop/urban/products/urus-se/410-0059_Audi_20RSQ8_20MY19-24_20-_20Visual_20Carbon_20Fibre_20Rear_20Lip_20Spoiler_20-_20Lower_20-_20Urban_20Weave_20Orientation_1.png',
    gallery: [
      '/images/shop/urban/products/urus-se/410-0059_Audi_20RSQ8_20MY19-24_20-_20Visual_20Carbon_20Fibre_20Rear_20Lip_20Spoiler_20-_20Lower_20-_20Urban_20Weave_20Orientation_1.png',
      '/images/shop/urban/products/urus-se/410-0059_Audi_20RSQ8_20MY19-24_20-_20Visual_20Carbon_20Fibre_20Rear_20Lip_20Spoiler_20-_20Lower_20-_20Urban_20Weave_20Orientation_2.png',
      '/images/shop/urban/products/urus-se/410-0059_Audi_20RSQ8_20MY19-24_20-_20Visual_20Carbon_20Fibre_20Rear_20Lip_20Spoiler_20-_20Lower_20-_20Urban_20Weave_20Orientation_3.png',
      'https://smgassets.blob.core.windows.net/customers/urban/dist/img/kits/models/rsq8/back.jpg',
    ],
  },
  'URB-SPO-25358234-V1': {
    image:
      '/images/shop/urban/products/urus-se/410-0061_Audi_20RSQ8_20MY19-24_20-_20Visual_20Carbon_20Fibre_20Rear_20Lip_20Spoiler_20-_20Upper_20-_20Urban_20Weave_20Orientation_1.png',
    gallery: [
      '/images/shop/urban/products/urus-se/410-0061_Audi_20RSQ8_20MY19-24_20-_20Visual_20Carbon_20Fibre_20Rear_20Lip_20Spoiler_20-_20Upper_20-_20Urban_20Weave_20Orientation_1.png',
      '/images/shop/urban/products/urus-se/410-0061_Audi_20RSQ8_20MY19-24_20-_20Visual_20Carbon_20Fibre_20Rear_20Lip_20Spoiler_20-_20Upper_20-_20Urban_20Weave_20Orientation_2.png',
      '/images/shop/urban/products/urus-se/410-0061_Audi_20RSQ8_20MY19-24_20-_20Visual_20Carbon_20Fibre_20Rear_20Lip_20Spoiler_20-_20Upper_20-_20Urban_20Weave_20Orientation_3.png',
      'https://smgassets.blob.core.windows.net/customers/urban/dist/img/kits/models/rsq8/back.jpg',
      'https://smgassets.blob.core.windows.net/customers/urban/dist/img/banners/models/rsq82024/webp/urban-aero-kit-daytona-2025-audi-rsq8-front-1920.webp',
    ],
  },
  'URB-DIF-25358238-V1': {
    image:
      'https://smgassets.blob.core.windows.net/customers/urban/dist/img/carousel/models/rsq82024/webp/urban-aero-kit-daytona-2025-audi-rsq8-1-2560.webp',
    gallery: [
      'https://smgassets.blob.core.windows.net/customers/urban/dist/img/carousel/models/rsq82024/webp/urban-aero-kit-daytona-2025-audi-rsq8-1-2560.webp',
      'https://smgassets.blob.core.windows.net/customers/urban/dist/img/kits/models/rsq8/back.jpg',
      'https://smgassets.blob.core.windows.net/customers/urban/dist/img/carousel/models/rsq82024/webp/urban-aero-kit-daytona-2025-audi-rsq8-1-2560.webp',
      'https://smgassets.blob.core.windows.net/customers/urban/dist/img/banners/models/rsq82024/webp/urban-aero-kit-daytona-2025-audi-rsq8-front-1920.webp',
    ],
  },
  'URB-FRO-25358235-V1': {
    image:
      'https://smgassets.blob.core.windows.net/customers/urban/dist/img/banners/models/rsq82024/webp/urban-aero-kit-daytona-2025-audi-rsq8-front-1920.webp',
    gallery: [
      'https://smgassets.blob.core.windows.net/customers/urban/dist/img/banners/models/rsq82024/webp/urban-aero-kit-daytona-2025-audi-rsq8-front-1920.webp',
      'https://smgassets.blob.core.windows.net/customers/urban/dist/img/kits/models/rsq8/front.jpg',
      'https://smgassets.blob.core.windows.net/customers/urban/dist/img/carousel/models/rsq82024/webp/urban-aero-kit-daytona-2025-audi-rsq8-2-2560.webp',
      'https://smgassets.blob.core.windows.net/customers/urban/dist/img/cols/models/rsq82024/webp/urban-aero-kit-daytona-2025-audi-rsq8-uc9-gtc.webp',
    ],
  },
  'URB-BOD-25353001-V1': {
    image: '/images/shop/urban/products/urus-se/Range_Rover_2022_3.jpg',
    gallery: [
      '/images/shop/urban/products/urus-se/Range_Rover_2022_3.jpg',
      '/images/shop/urban/products/urus-se/Urban_Range_Rover_Carbon_Front_Bumper.jpg',
      '/images/shop/urban/products/urus-se/Urban_Range_Rover_Rear_Bumper.jpg',
      '/images/shop/urban/products/urus-se/Urban_Range_Rover_Billet_Exhaust.jpg',
      '/images/shop/urban/products/urus-se/Range_Rover_2022_1.jpg',
      '/images/shop/urban/products/urus-se/Range_Rover_2022_2.jpg',
      '/images/shop/urban/products/urus-se/Range_Rover_2022.jpg',
      '/images/shop/urban/products/urus-se/Range_Rover_2022_4.jpg',
      '/images/shop/urban/carousel/models/rangeRover2022Plus/webp/urban-range-rover-mk-dons-1-1920.webp',
      '/images/shop/urban/carousel/models/rangeRover2022Plus/webp/urban-range-rover-mk-dons-2-1920.webp',
      '/images/shop/urban/carousel/models/rangeRover2022Plus/webp/urban-range-rover-mk-dons-3-1920.webp',
      '/images/shop/urban/carousel/models/rangeRover2022Plus/webp/urban-range-rover-mk-dons-4-1920.webp',
      '/images/shop/urban/carousel/models/rangeRover2022Plus/webp/urban-range-rover-mk-dons-5-1920.webp',
      '/images/shop/urban/carousel/models/rangeRover2022Plus/webp/urban-range-rover-mk-dons-6-1920.webp',
      '/images/shop/urban/carousel/models/rangeRover2022Plus/webp/urban-range-rover-mk-dons-7-1920.webp',
    ],
  },
  'URB-BOD-25353030-V1': {
    image: '/images/shop/urban/products/urus-se/Urban_Automotive_Range_Rover_Sport_L461_2.jpg',
    gallery: [
      '/images/shop/urban/products/urus-se/Urban_Automotive_Range_Rover_Sport_L461_2.jpg',
      '/images/shop/urban/products/urus-se/Urban_Automotive_Range_Rover_Sport_L461.jpg',
      '/images/shop/urban/products/urus-se/Urban_Automotive_Range_Rover_Sport_L461_Kit_Front.jpg',
      '/images/shop/urban/products/urus-se/Urban_Automotive_Range_Rover_Sport_L461_Kit_Back.jpg',
      '/images/shop/urban/cols/models/rangeRoverSportL461/col-image-1-lg.jpg',
      '/images/shop/urban/cols/models/rangeRoverSportL461/col-image-2-lg.jpg',
      '/images/shop/urban/cols/models/rangeRoverSportL461/col-image-3-lg.jpg',
      '/images/shop/urban/banners/models/rangeRoverSportL461/banner-1-1920.jpg',
    ],
  },
  'URB-WID-25353015-V1': {
    image: '/images/shop/urban/products/urus-se/Urban_Range_Rover_Widetrack_Arches.jpg',
    gallery: [
      '/images/shop/urban/products/urus-se/Urban_Range_Rover_Widetrack_Arches.jpg',
      '/images/shop/urban/kits/models/rangeRover2022Plus/left.jpg',
      '/images/shop/urban/kits/models/rangeRover2022Plus/right.jpg',
      '/images/shop/urban/carousel/models/rangeRover2022Plus/webp/urban-range-rover-mk-dons-1-1920.webp',
      '/images/shop/urban/carousel/models/rangeRover2022Plus/webp/urban-range-rover-mk-dons-2-1920.webp',
      '/images/shop/urban/cols/models/rangeRover2022Plus/col-image-1-lg.jpg',
    ],
  },
  'URB-ARC-26006219-V1': {
    image: '/images/shop/urban/cols/models/rangeRoverSportL461/col-image-1-lg.jpg',
    gallery: [
      '/images/shop/urban/cols/models/rangeRoverSportL461/col-image-1-lg.jpg',
      '/images/shop/urban/kits/models/rangeRoverSportL461/left.jpg',
      '/images/shop/urban/kits/models/rangeRoverSportL461/right.jpg',
      '/images/shop/urban/cols/models/rangeRoverSportL461/col-image-2-lg.jpg',
      '/images/shop/urban/cols/models/rangeRoverSportL461/col-image-3-lg.jpg',
      '/images/shop/urban/banners/models/rangeRoverSportL461/banner-1-1920.jpg',
    ],
  },
  'URB-ARC-25353085-V1': {
    image:
      '/images/shop/urban/products/urus-se/440-0076_20Defender_202020_20-_2090_20-_20Urban_20Widetrack_20Arch_20Kit_20_28Gloss_20Black_29-1.png',
    gallery: [
      '/images/shop/urban/products/urus-se/440-0076_20Defender_202020_20-_2090_20-_20Urban_20Widetrack_20Arch_20Kit_20_28Gloss_20Black_29-1.png',
      '/images/shop/urban/products/urus-se/440-0076_20Defender_202020_20-_2090_20-_20Urban_20Widetrack_20Arch_20Kit_20_28Gloss_20Black_29-2.png',
      '/images/shop/urban/products/urus-se/440-0076_20Defender_202020_20-_2090_20-_20Urban_20Widetrack_20Arch_20Kit_20_28Gloss_20Black_29-3.png',
      '/images/shop/urban/products/urus-se/440-0076_20Defender_202020_20-_2090_20-_20Urban_20Widetrack_20Arch_20Kit_20_28Gloss_20Black_29-4.png',
      '/images/shop/urban/products/urus-se/440-0076_20Defender_202020_20-_2090_20-_20Urban_20Widetrack_20Arch_20Kit_20_28Gloss_20Black_29-5.png',
      '/images/shop/urban/kits/models/defender2020Plus/right.jpg',
      '/images/shop/urban/kits/models/defender2020Plus/left.jpg',
      '/images/shop/urban/carousel/models/defender2020Plus/2025Updates/webp/urban-automotive-defender-2020-onwards-3-2560.webp',
    ],
  },
  'URB-ARC-25358153-V1': {
    image: '/images/shop/urban/products/urus-se/Bentley_Continental_GTGTC.jpg',
    gallery: [
      '/images/shop/urban/products/urus-se/Bentley_Continental_GTGTC.jpg',
      '/images/shop/urban/products/urus-se/Bentley_Continental_GTGTC_Kit_Left.jpg',
      '/images/shop/urban/products/urus-se/Bentley_Continental_GTGTC_Kit_Right.jpg',
      '/images/shop/urban/kits/models/continentalGT/left.jpg',
      '/images/shop/urban/kits/models/continentalGT/right.jpg',
      '/images/shop/urban/carousel/models/continentalGT/carousel-1-1920.jpg',
    ],
  },
  'URB-ARC-26006231-V1': {
    image: '/images/shop/urban/products/urus-se/Urban_Widetrack_Arch_Set_1.webp',
    gallery: [
      '/images/shop/urban/products/urus-se/Urban_Widetrack_Arch_Set_1.webp',
      '/images/shop/urban/carousel/models/defender2020Plus/carousel-13-1920.jpg',
      '/images/shop/urban/kits/models/defender2020Plus/right.jpg',
      '/images/shop/urban/kits/models/defender2020Plus/left.jpg',
      '/images/shop/urban/kits/models/defender2020Plus/front.jpg',
      '/images/shop/urban/carousel/models/defender2020Plus/2025Updates/webp/urban-automotive-defender-2020-onwards-1-2560.webp',
    ],
  },
  'URB-ARC-26009359-V1': {
    image: '/images/shop/urban/carousel/models/defender2020Plus/carousel-13-1920.jpg',
    gallery: [
      '/images/shop/urban/carousel/models/defender2020Plus/carousel-13-1920.jpg',
      '/images/shop/urban/kits/models/defender2020Plus/back.jpg',
      '/images/shop/urban/kits/models/defender2020Plus/right.jpg',
      '/images/shop/urban/kits/models/defender2020Plus/left.jpg',
      '/images/shop/urban/products/urus-se/Urban_Widetrack_Arch_Set_1.webp',
      '/images/shop/urban/carousel/models/defender2020Plus/2025Updates/webp/urban-automotive-defender-2020-onwards-3-2560.webp',
    ],
  },
  'URB-CAN-25353086-V1': {
    image:
      '/images/shop/urban/products/urus-se/440-0095_20Defender_202020_20-_2090-110-130_20-_20Urban_20Front_20Canards_20-_20_28Pair_29-1.png',
    gallery: [
      '/images/shop/urban/products/urus-se/440-0095_20Defender_202020_20-_2090-110-130_20-_20Urban_20Front_20Canards_20-_20_28Pair_29-1.png',
      '/images/shop/urban/products/urus-se/440-0095_20Defender_202020_20-_2090-110-130_20-_20Urban_20Front_20Canards_20-_20_28Pair_29-12.jpg',
      '/images/shop/urban/products/urus-se/440-0095_20Defender_202020_20-_2090-110-130_20-_20Urban_20Front_20Canards_20-_20_28Pair_29-1a.png',
      '/images/shop/urban/products/urus-se/440-0095_20Defender_202020_20-_2090-110-130_20-_20Urban_20Front_20Canards_20-_20_28Pair_29-2.png',
      '/images/shop/urban/products/urus-se/440-0095_20Defender_202020_20-_2090-110-130_20-_20Urban_20Front_20Canards_20-_20_28Pair_29-3.png',
      '/images/shop/urban/carousel/models/defender2020Plus/carousel-13-1920.jpg',
    ],
  },
  'URB-FRO-26054204-V1': {
    image: '/images/shop/urban/products/urus-se/Urban-Widetrack-Lamborghini-Urus-SE-Front-Diffuser-Canard.jpg',
    gallery: [
      '/images/shop/urban/products/urus-se/Urban-Widetrack-Lamborghini-Urus-SE-Front-Diffuser-Canard.jpg',
      'https://smgassets.blob.core.windows.net/customers/urban/dist/img/carousel/models/urusSE/webp/urban-automotive-urus-se-widetrack-1-2560.webp',
      'https://smgassets.blob.core.windows.net/customers/urban/dist/img/carousel/models/urusSE/webp/urban-automotive-urus-se-widetrack-2-2560.webp',
      'https://smgassets.blob.core.windows.net/customers/urban/dist/img/detailed-gallery/models/urusSE/webp/urban-automotive-urus-se-carbon-bonnet.webp',
      '/images/shop/urban/products/urus-se/Urban-Widetrack-Lamborghini-Urus-SE-Dragonscale-Bonnet-Vents.jpg',
    ],
  },
  'URB-DOO-26093237-V1': {
    image: '/images/shop/urban/products/urus-se/Urban-Widetrack-Lamborghini-Urus-SE-Side-Vent.jpg',
    gallery: [
      '/images/shop/urban/products/urus-se/Urban-Widetrack-Lamborghini-Urus-SE-Side-Vent.jpg',
      'https://smgassets.blob.core.windows.net/customers/urban/dist/img/detailed-gallery/models/urusSE/webp/urban-automotive-urus-se-side-vents.webp',
      'https://smgassets.blob.core.windows.net/customers/urban/dist/img/banners/models/urusSE/webp/urban-automotive-urus-se-side-2560.webp',
      'https://smgassets.blob.core.windows.net/customers/urban/dist/img/carousel/models/urusSE/webp/urban-automotive-urus-se-widetrack-3-2560.webp',
      '/images/shop/urban/products/urus-se/Urban-Widetrack-Lamborghini-Urus-SE-Wide-Arches.jpg',
    ],
  },
  'URB-BOD-25353062-V1': {
    image: '/images/shop/urban/products/urus-se/Range_Rover_SVR_1.jpg',
    gallery: [
      '/images/shop/urban/products/urus-se/Range_Rover_SVR_1.jpg',
      '/images/shop/urban/products/urus-se/Range_Rover_SVR.jpg',
      '/images/shop/urban/products/urus-se/Range_Rover_SVR_2.jpg',
      '/images/shop/urban/products/urus-se/Range_Rover_SVR_Kit_Front.jpg',
      '/images/shop/urban/products/urus-se/Range_Rover_SVR_Kit_Back.jpg',
      '/images/shop/urban/products/urus-se/Range_Rover_SVR_Kit_Left.jpg',
      '/images/shop/urban/products/urus-se/Range_Rover_SVR_Kit_Right.jpg',
      '/images/shop/urban/products/urus-se/Range_Rover_SVR.png',
    ],
  },
  'URB-BOD-25353068-V1': {
    image: 'https://smgassets.blob.core.windows.net/customers/urban/dist/img/gallery/models/rangeRoverSVR/gallery-3-lg.jpg',
    gallery: [
      'https://smgassets.blob.core.windows.net/customers/urban/dist/img/gallery/models/rangeRoverSVR/gallery-3-lg.jpg',
      'https://smgassets.blob.core.windows.net/customers/urban/dist/img/kits/models/rangeRoverSVR/front.jpg',
      'https://smgassets.blob.core.windows.net/customers/urban/dist/img/kits/models/rangeRoverSVR/right.jpg',
      'https://smgassets.blob.core.windows.net/customers/urban/dist/img/kits/models/rangeRoverSVR/left.jpg',
      'https://smgassets.blob.core.windows.net/customers/urban/dist/img/kits/models/rangeRoverSVR/back.jpg',
      'https://smgassets.blob.core.windows.net/customers/urban/dist/img/gallery/models/rangeRoverSVR/gallery-1-lg.jpg',
      'https://smgassets.blob.core.windows.net/customers/urban/dist/img/gallery/models/rangeRoverSVR/gallery-6-lg.jpg',
      'https://smgassets.blob.core.windows.net/customers/urban/dist/img/gallery/models/rangeRoverSVR/gallery-7-lg.jpg',
    ],
  },
  'URB-ARC-25353072-V1': {
    image: '/images/shop/urban/kits/models/rangeRoverSVR/right.jpg',
    gallery: [
      '/images/shop/urban/kits/models/rangeRoverSVR/right.jpg',
      '/images/shop/urban/kits/models/rangeRoverSVR/left.jpg',
      '/images/shop/urban/carousel/models/rangeRoverSVR/carousel-1-1920.jpg',
      '/images/shop/urban/carousel/models/rangeRoverSVR/carousel-7-1920.jpg',
      'https://smgassets.blob.core.windows.net/customers/urban/dist/img/gallery/models/rangeRoverSVR/gallery-1-lg.jpg',
    ],
  },
  'URB-BOD-25353069-V1': {
    image: 'https://smgassets.blob.core.windows.net/customers/urban/dist/img/gallery/models/rangeRoverSVR/gallery-1-lg.jpg',
    gallery: [
      'https://smgassets.blob.core.windows.net/customers/urban/dist/img/gallery/models/rangeRoverSVR/gallery-1-lg.jpg',
      'https://smgassets.blob.core.windows.net/customers/urban/dist/img/kits/models/rangeRoverSVR/front.jpg',
      'https://smgassets.blob.core.windows.net/customers/urban/dist/img/kits/models/rangeRoverSVR/right.jpg',
      'https://smgassets.blob.core.windows.net/customers/urban/dist/img/kits/models/rangeRoverSVR/left.jpg',
      'https://smgassets.blob.core.windows.net/customers/urban/dist/img/kits/models/rangeRoverSVR/back.jpg',
      'https://smgassets.blob.core.windows.net/customers/urban/dist/img/gallery/models/rangeRoverSVR/gallery-3-lg.jpg',
      'https://smgassets.blob.core.windows.net/customers/urban/dist/img/gallery/models/rangeRoverSVR/gallery-6-lg.jpg',
      'https://smgassets.blob.core.windows.net/customers/urban/dist/img/gallery/models/rangeRoverSVR/gallery-7-lg.jpg',
      'https://smgassets.blob.core.windows.net/customers/urban/dist/img/carousel/models/rangeRoverSVR/carousel-9-1920.jpg',
      'https://smgassets.blob.core.windows.net/customers/urban/dist/img/carousel/models/rangeRoverSVR/carousel-10-1920.jpg',
      'https://smgassets.blob.core.windows.net/customers/urban/dist/img/carousel/models/rangeRoverSVR/carousel-11-1920.jpg',
      'https://smgassets.blob.core.windows.net/customers/urban/dist/img/carousel/models/rangeRoverSVR/carousel-12-1920.jpg',
    ],
  },
  'URB-BOD-25353070-V1': {
    image: 'https://smgassets.blob.core.windows.net/customers/urban/dist/img/gallery/models/rangeRoverSVR/gallery-6-lg.jpg',
    gallery: [
      'https://smgassets.blob.core.windows.net/customers/urban/dist/img/gallery/models/rangeRoverSVR/gallery-6-lg.jpg',
      'https://smgassets.blob.core.windows.net/customers/urban/dist/img/kits/models/rangeRoverSVR/front.jpg',
      'https://smgassets.blob.core.windows.net/customers/urban/dist/img/kits/models/rangeRoverSVR/back.jpg',
      'https://smgassets.blob.core.windows.net/customers/urban/dist/img/kits/models/rangeRoverSVR/right.jpg',
      'https://smgassets.blob.core.windows.net/customers/urban/dist/img/kits/models/rangeRoverSVR/left.jpg',
      'https://smgassets.blob.core.windows.net/customers/urban/dist/img/gallery/models/rangeRoverSVR/gallery-7-lg.jpg',
      'https://smgassets.blob.core.windows.net/customers/urban/dist/img/gallery/models/rangeRoverSVR/gallery-3-lg.jpg',
      'https://smgassets.blob.core.windows.net/customers/urban/dist/img/carousel/models/rangeRoverSVR/carousel-17-1920.jpg',
      'https://smgassets.blob.core.windows.net/customers/urban/dist/img/carousel/models/rangeRoverSVR/carousel-18-1920.jpg',
    ],
  },
  'URB-BOD-25353071-V1': {
    image: 'https://smgassets.blob.core.windows.net/customers/urban/dist/img/gallery/models/rangeRoverSVR/gallery-7-lg.jpg',
    gallery: [
      'https://smgassets.blob.core.windows.net/customers/urban/dist/img/gallery/models/rangeRoverSVR/gallery-7-lg.jpg',
      'https://smgassets.blob.core.windows.net/customers/urban/dist/img/kits/models/rangeRoverSVR/front.jpg',
      'https://smgassets.blob.core.windows.net/customers/urban/dist/img/kits/models/rangeRoverSVR/right.jpg',
      'https://smgassets.blob.core.windows.net/customers/urban/dist/img/kits/models/rangeRoverSVR/left.jpg',
      'https://smgassets.blob.core.windows.net/customers/urban/dist/img/kits/models/rangeRoverSVR/back.jpg',
      'https://smgassets.blob.core.windows.net/customers/urban/dist/img/gallery/models/rangeRoverSVR/gallery-1-lg.jpg',
      'https://smgassets.blob.core.windows.net/customers/urban/dist/img/gallery/models/rangeRoverSVR/gallery-3-lg.jpg',
      'https://smgassets.blob.core.windows.net/customers/urban/dist/img/carousel/models/rangeRoverSVR/carousel-13-1920.jpg',
    ],
  },
  'URB-BOD-25353141-V1': {
    image: '/images/shop/urban/hero/models/discovery2021Plus/hero-1-1920.jpg',
    gallery: [
      '/images/shop/urban/hero/models/discovery2021Plus/hero-1-1920.jpg',
      '/images/shop/urban/kits/models/discovery2021Plus/front.jpg',
      '/images/shop/urban/kits/models/discovery2021Plus/back.jpg',
      '/images/shop/urban/kits/models/discovery2021Plus/right.jpg',
      '/images/shop/urban/kits/models/discovery2021Plus/left.jpg',
      '/images/shop/urban/cols/models/discovery2021Plus/col-image-1-lg.jpg',
      '/images/shop/urban/cols/models/discovery2021Plus/col-image-2-lg.jpg',
      '/images/shop/urban/cols/models/discovery2021Plus/col-image-3-lg.jpg',
      '/images/shop/urban/banners/models/discovery2021Plus/banner-1-1920.jpg',
      '/images/shop/urban/banners/models/discovery2021Plus/banner-2-1920.jpg',
      '/images/shop/urban/banners/models/discovery2021Plus/banner-3-1920.jpg',
    ],
  },
  'URB-BOD-25353142-V1': {
    image: '/images/shop/urban/cols/models/discovery2021Plus/col-image-1-lg.jpg',
    gallery: [
      '/images/shop/urban/cols/models/discovery2021Plus/col-image-1-lg.jpg',
      '/images/shop/urban/kits/models/discovery2021Plus/front.jpg',
      '/images/shop/urban/kits/models/discovery2021Plus/back.jpg',
      '/images/shop/urban/kits/models/discovery2021Plus/right.jpg',
      '/images/shop/urban/kits/models/discovery2021Plus/left.jpg',
      '/images/shop/urban/hero/models/discovery2021Plus/hero-1-1920.jpg',
      '/images/shop/urban/cols/models/discovery2021Plus/col-image-2-lg.jpg',
      '/images/shop/urban/cols/models/discovery2021Plus/col-image-3-lg.jpg',
      '/images/shop/urban/banners/models/discovery2021Plus/banner-1-1920.jpg',
      '/images/shop/urban/banners/models/discovery2021Plus/banner-2-1920.jpg',
    ],
  },
  'URB-BUN-25358150-V1': {
    image: '/images/shop/urban/hero/models/continentalGT/hero-1-1920.jpg',
    gallery: [
      '/images/shop/urban/hero/models/continentalGT/hero-1-1920.jpg',
      '/images/shop/urban/kits/models/continentalGT/front.jpg',
      '/images/shop/urban/kits/models/continentalGT/left.jpg',
      '/images/shop/urban/kits/models/continentalGT/right.jpg',
      '/images/shop/urban/kits/models/continentalGT/back.jpg',
      '/images/shop/urban/carousel/models/continentalGT/carousel-1-1920.jpg',
      '/images/shop/urban/carousel/models/continentalGT/carousel-2-1920.jpg',
      '/images/shop/urban/carousel/models/continentalGT/carousel-3-1920.jpg',
      '/images/shop/urban/carousel/models/continentalGT/carousel-4-1920.jpg',
      '/images/shop/urban/carousel/models/continentalGT/carousel-5-1920.jpg',
      '/images/shop/urban/carousel/models/continentalGT/carousel-6-1920.jpg',
      '/images/shop/urban/carousel/models/continentalGT/carousel-7-1920.jpg',
      '/images/shop/urban/banners/models/continentalGT/banner-1-1920.jpg',
    ],
  },
  'URB-BUN-25358144-V1': {
    image: '/images/shop/urban/hero/models/cullinan/hero-1-1920.jpg',
    gallery: [
      '/images/shop/urban/hero/models/cullinan/hero-1-1920.jpg',
      '/images/shop/urban/cols/models/cullinan/col-image-1-lg.png',
      '/images/shop/urban/banners/models/cullinan/banner-1-1920.jpg',
      '/images/shop/urban/banners/models/cullinan/banner-2-1920.jpg',
      '/images/shop/urban/banners/models/cullinan/banner-3-1920.jpg',
      '/images/shop/urban/banners/models/cullinan/banner-4-1920.jpg',
      '/images/shop/urban/products/urus-se/Rolls-Royce_Cullinan.jpg',
      '/images/shop/urban/products/urus-se/Rolls-Royce_Cullinan_1.jpg',
      '/images/shop/urban/products/urus-se/Rolls-Royce_Cullinan_2.jpg',
    ],
  },
  'URB-BUN-25358147-V1': {
    image: '/images/shop/urban/hero/models/cullinanSeriesII/webp/urban-automotive-cullinan-profile-1920.webp',
    gallery: [
      '/images/shop/urban/hero/models/cullinanSeriesII/webp/urban-automotive-cullinan-profile-1920.webp',
      '/images/shop/urban/carousel/models/cullinanSeriesII/webp/urban-automotive-cullinan-series-ii-1-2560.webp',
      '/images/shop/urban/carousel/models/cullinanSeriesII/webp/urban-automotive-cullinan-series-ii-2-2560.webp',
      '/images/shop/urban/carousel/models/cullinanSeriesII/webp/urban-automotive-cullinan-series-ii-3-2560.webp',
      '/images/shop/urban/carousel/models/cullinanSeriesII/webp/urban-automotive-cullinan-series-ii-4-2560.webp',
      '/images/shop/urban/carousel/models/cullinanSeriesII/webp/urban-automotive-cullinan-series-ii-5-2560.webp',
      '/images/shop/urban/carousel/models/cullinanSeriesII/webp/urban-automotive-cullinan-series-ii-6-2560.webp',
      '/images/shop/urban/carousel/models/cullinanSeriesII/webp/urban-automotive-cullinan-series-ii-7-2560.webp',
      '/images/shop/urban/cols/models/cullinanSeriesII/webp/urban-automotive-rolls-royce-cullinan.webp',
      '/images/shop/urban/products/urus-se/Cullinan_Series_II.webp',
      '/images/shop/urban/products/urus-se/Urban_Automotive_Cullinan_Series_II_1.webp',
      '/images/shop/urban/products/urus-se/Urban_Automotive_Cullinan_Series_II_2.webp',
    ],
  },
  'URB-BUN-25358159-V1': {
    image: '/images/shop/urban/hero/models/t6-1/hero-1-1920.jpg',
    gallery: [
      '/images/shop/urban/hero/models/t6-1/hero-1-1920.jpg',
      '/images/shop/urban/kits/models/t6-1/front.jpg',
      '/images/shop/urban/kits/models/t6-1/left.jpg',
      '/images/shop/urban/kits/models/t6-1/right.jpg',
      '/images/shop/urban/kits/models/t6-1/back.jpg',
      '/images/shop/urban/carousel/models/t6-1/carousel-1-1920.jpg',
      '/images/shop/urban/carousel/models/t6-1/carousel-2-1920.jpg',
      '/images/shop/urban/carousel/models/t6-1/carousel-3-1920.jpg',
      '/images/shop/urban/carousel/models/t6-1/carousel-4-1920.jpg',
      '/images/shop/urban/gallery/models/t6-1/gallery-1-lg.jpg',
      '/images/shop/urban/gallery/models/t6-1/gallery-2-lg.jpg',
      '/images/shop/urban/gallery/models/t6-1/gallery-3-lg.jpg',
      '/images/shop/urban/gallery/models/t6-1/gallery-4-lg.jpg',
      '/images/shop/urban/gallery/models/t6-1/gallery-5-lg.jpg',
      '/images/shop/urban/gallery/models/t6-1/gallery-6-lg.jpg',
      '/images/shop/urban/banners/models/t6-1/banner-1-1920.jpg',
      '/images/shop/urban/products/urus-se/VW_Transporter_T61.jpg',
      '/images/shop/urban/products/urus-se/VW_Transporter_T61_1.jpg',
      '/images/shop/urban/products/urus-se/VW_Transporter_T61_2.jpg',
      '/images/shop/urban/products/urus-se/VW_Transporter_T61_Kit_Front.jpg',
      '/images/shop/urban/products/urus-se/VW_Transporter_T61_Kit_Left.jpg',
      '/images/shop/urban/products/urus-se/VW_Transporter_T61_Kit_Right.jpg',
      '/images/shop/urban/products/urus-se/VW_Transporter_T61_Kit_Back.jpg',
    ],
  },
  'URB-ACC-25358162-V1': {
    image: 'https://cdn.shopify.com/s/files/1/0733/4058/4242/files/Transporter_108b9d64-838e-422c-9d6a-879c28b99668.png?v=1776080792',
    gallery: [
      'https://cdn.shopify.com/s/files/1/0733/4058/4242/files/Transporter_108b9d64-838e-422c-9d6a-879c28b99668.png?v=1776080792',
      '/images/shop/urban/kits/models/t6-1/left.jpg',
      '/images/shop/urban/kits/models/t6-1/right.jpg',
      '/images/shop/urban/carousel/models/t6-1/carousel-3-1920.jpg',
      '/images/shop/urban/gallery/models/t6-1/gallery-4-lg.jpg',
    ],
  },
  'URB-ACC-25358163-V1': {
    image: 'https://cdn.shopify.com/s/files/1/0733/4058/4242/files/Transporter_ac824b99-ffaa-4aaa-b12c-efa7737b1fff.png?v=1776080822',
    gallery: [
      'https://cdn.shopify.com/s/files/1/0733/4058/4242/files/Transporter_ac824b99-ffaa-4aaa-b12c-efa7737b1fff.png?v=1776080822',
      '/images/shop/urban/kits/models/t6-1/back.jpg',
      '/images/shop/urban/carousel/models/t6-1/carousel-4-1920.jpg',
      '/images/shop/urban/gallery/models/t6-1/gallery-6-lg.jpg',
    ],
  },
  'URB-BUN-25358198-V1': {
    image: '/images/shop/urban/hero/models/gwagonSoftKit/hero-1-1920.jpg',
    gallery: [
      '/images/shop/urban/hero/models/gwagonSoftKit/hero-1-1920.jpg',
      '/images/shop/urban/kits/models/gwagonSoftKit/front.jpg',
      '/images/shop/urban/kits/models/gwagonSoftKit/left.jpg',
      '/images/shop/urban/kits/models/gwagonSoftKit/right.jpg',
      '/images/shop/urban/kits/models/gwagonSoftKit/back.jpg',
      '/images/shop/urban/carousel/models/gwagonSoftKit/carousel-1-1920.jpg',
      '/images/shop/urban/carousel/models/gwagonSoftKit/carousel-2-1920.jpg',
      '/images/shop/urban/carousel/models/gwagonSoftKit/carousel-3-1920.jpg',
      '/images/shop/urban/carousel/models/gwagonSoftKit/carousel-4-1920.jpg',
      '/images/shop/urban/carousel/models/gwagonSoftKit/carousel-5-1920.jpg',
      '/images/shop/urban/carousel/models/gwagonSoftKit/carousel-6-1920.jpg',
      '/images/shop/urban/products/urus-se/G-Wagon_Soft_Kit_2018.jpg',
      '/images/shop/urban/products/urus-se/G-Wagon_Soft_Kit_2018_1.jpg',
      '/images/shop/urban/products/urus-se/G-Wagon_Soft_Kit_2018_2.jpg',
      '/images/shop/urban/products/urus-se/G-Wagon_Soft_Kit_2018_3.jpg',
    ],
  },
  'URB-BUN-25358207-V1': {
    image: '/images/shop/urban/carousel/models/gwagonWidetrack2024/webp/urban-automotive-g-wagon-g63-w465-widetrack-1-2560.webp',
    gallery: [
      '/images/shop/urban/carousel/models/gwagonWidetrack2024/webp/urban-automotive-g-wagon-g63-w465-widetrack-1-2560.webp',
      '/images/shop/urban/products/urus-se/G-Wagon_Widetrack_2024.webp',
      '/images/shop/urban/carousel/models/gwagonWidetrack2024/webp/urban-automotive-g-wagon-g63-w465-widetrack-2-2560.webp',
      '/images/shop/urban/products/urus-se/Urban_Automotive_G-Wagon_G63_W465_Widetrack_2.webp',
      '/images/shop/urban/products/urus-se/G-Wagon_Widetrack_1.jpg',
      '/images/shop/urban/products/urus-se/G-Wagon_Widetrack_2.jpg',
      '/images/shop/urban/products/urus-se/G-Wagon_Widetrack_3.jpg',
      '/images/shop/urban/products/urus-se/Urban_Automotive_G-Wagon_G63_W465_Widetrack_1.webp',
      '/images/shop/urban/carousel/models/gwagonWidetrack2024/webp/urban-automotive-g-wagon-g63-w465-widetrack-5-2560.webp',
      '/images/shop/urban/carousel/models/gwagonWidetrack2024/webp/urban-automotive-g-wagon-g63-w465-widetrack-3-2560.webp',
      '/images/shop/urban/carousel/models/gwagonWidetrack2024/webp/urban-automotive-g-wagon-g63-w465-widetrack-4-2560.webp',
      '/images/shop/urban/carousel/models/gwagonWidetrack2024/webp/urban-automotive-g-wagon-g63-w465-widetrack-6-2560.webp',
      '/images/shop/urban/carousel/models/gwagonWidetrack2024/webp/urban-automotive-g-wagon-g63-w465-widetrack-7-2560.webp',
      '/images/shop/urban/carousel/models/gwagonWidetrack2024/webp/urban-automotive-g-wagon-g63-w465-widetrack-8-2560.webp',
      '/images/shop/urban/carousel/models/gwagonWidetrack2024/webp/urban-automotive-g-wagon-g63-w465-widetrack-9-2560.webp',
      '/images/shop/urban/carousel/models/gwagonWidetrack2024/webp/urban-automotive-g-wagon-g63-w465-widetrack-10-2560.webp',
      '/images/shop/urban/carousel/models/gwagonWidetrack2024/webp/urban-automotive-g-wagon-g63-w465-widetrack-11-2560.webp',
      '/images/shop/urban/carousel/models/gwagonWidetrack2024/webp/urban-automotive-g-wagon-g63-w465-widetrack-12-2560.webp',
    ],
  },
  'URB-HOO-25358201-V1': {
    image: '/images/shop/urban/products/urus-se/Urban_G-Wagon_Bullnose_Bonnet.webp',
    gallery: [
      '/images/shop/urban/products/urus-se/Urban_G-Wagon_Bullnose_Bonnet.webp',
      '/images/shop/urban/cols/models/gwagonAeroKit2024/webp/urban-g-wagon-aerokit-bullnose-bonnet.webp',
      '/images/shop/urban/carousel/models/gwagonAeroKit2024/webp/urban-automotive-g-wagon-g63-w465-aerokit-2-2560.webp',
    ],
  },
  'URB-ROO-25358202-V1': {
    image: '/images/shop/urban/products/urus-se/Urban_Automotive_G-Wagon_Light_Bar_1.webp',
    gallery: [
      '/images/shop/urban/products/urus-se/Urban_Automotive_G-Wagon_Light_Bar_1.webp',
      '/images/shop/urban/products/urus-se/Urban_Automotive_G-Wagon_Light_Bar.webp',
      '/images/shop/urban/carousel/models/gwagonAeroKit2024/webp/urban-automotive-g-wagon-g63-w465-aerokit-4-2560.webp',
    ],
  },
  'URB-SPO-25358203-V1': {
    image: '/images/shop/urban/products/urus-se/Urban_Automotive_G-Wagon_Rear_Spoiler.webp',
    gallery: [
      '/images/shop/urban/products/urus-se/Urban_Automotive_G-Wagon_Rear_Spoiler.webp',
      '/images/shop/urban/carousel/models/gwagonAeroKit2024/webp/urban-automotive-g-wagon-g63-w465-aerokit-5-2560.webp',
      '/images/shop/urban/products/urus-se/G-Wagon_Aero_Kit_2024.webp',
    ],
  },
  'URB-COV-25358204-V1': {
    image: '/images/shop/urban/products/urus-se/Urban_Automotive_G-Wagon_Rear_Wheel_Carrier.webp',
    gallery: [
      '/images/shop/urban/products/urus-se/Urban_Automotive_G-Wagon_Rear_Wheel_Carrier.webp',
      '/images/shop/urban/carousel/models/gwagonAeroKit2024/webp/urban-automotive-g-wagon-g63-w465-aerokit-5-2560.webp',
      '/images/shop/urban/products/urus-se/G-Wagon_Aero_Kit_2024.webp',
    ],
  },
  'URB-DEC-25358200-V1': {
    image: '/images/shop/urban/products/urus-se/Urban_G-Wagon_Urban_Branding.webp',
    gallery: [
      '/images/shop/urban/products/urus-se/Urban_G-Wagon_Urban_Branding.webp',
      '/images/shop/urban/carousel/models/gwagonAeroKit2024/webp/urban-automotive-g-wagon-g63-w465-aerokit-1-2560.webp',
    ],
  },
  'URB-SPL-25358199-V1': {
    image: '/images/shop/urban/products/urus-se/G-Wagon_Aero_Kit_2024.webp',
    gallery: [
      '/images/shop/urban/products/urus-se/G-Wagon_Aero_Kit_2024.webp',
      '/images/shop/urban/carousel/models/gwagonAeroKit2024/webp/urban-automotive-g-wagon-g63-w465-aerokit-3-2560.webp',
      '/images/shop/urban/carousel/models/gwagonAeroKit2024/webp/urban-automotive-g-wagon-g63-w465-aerokit-1-2560.webp',
    ],
  },
  'URB-TRI-25358205-V1': {
    image: '/images/shop/urban/products/urus-se/G-Wagon_Aero_Kit_2024.webp',
    gallery: [
      '/images/shop/urban/products/urus-se/G-Wagon_Aero_Kit_2024.webp',
      '/images/shop/urban/carousel/models/gwagonAeroKit2024/webp/urban-automotive-g-wagon-g63-w465-aerokit-1-2560.webp',
      '/images/shop/urban/products/urus-se/G-Wagon_Soft_Kit_2018_Kit_Front.jpg',
    ],
  },
  'URB-TRI-25358206-V1': {
    image: '/images/shop/urban/products/urus-se/G-Wagon_Aero_Kit_2024.webp',
    gallery: [
      '/images/shop/urban/products/urus-se/G-Wagon_Aero_Kit_2024.webp',
      '/images/shop/urban/carousel/models/gwagonAeroKit2024/webp/urban-automotive-g-wagon-g63-w465-aerokit-1-2560.webp',
      '/images/shop/urban/products/urus-se/G-Wagon_Soft_Kit_2018_Kit_Front.jpg',
    ],
  },
  'URB-WHE-26009280-V1': {
    image: '/images/shop/urban/products/urus-se/Urban_UC-4.webp',
    gallery: [
      '/images/shop/urban/products/urus-se/Urban_UC-4.webp',
      '/images/shop/urban/carousel/models/gwagonWidetrack2024/webp/urban-automotive-g-wagon-g63-w465-widetrack-5-2560.webp',
    ],
  },
  'URB-WHE-26009281-V1': {
    image: '/images/shop/urban/products/urus-se/UrbanUC-4_Satin_c.png',
    gallery: [
      '/images/shop/urban/products/urus-se/UrbanUC-4_Satin_c.png',
      '/images/shop/urban/carousel/models/gwagonWidetrack2024/webp/urban-automotive-g-wagon-g63-w465-widetrack-5-2560.webp',
    ],
  },
  'URB-WHE-26009286-V1': {
    image: '/images/shop/urban/products/urus-se/Urban_UC-9_2970e730-84c8-436d-9c2d-2cd8e4989cbd.webp',
    gallery: [
      '/images/shop/urban/products/urus-se/Urban_UC-9_2970e730-84c8-436d-9c2d-2cd8e4989cbd.webp',
      '/images/shop/urban/carousel/models/gwagonWidetrack2024/webp/urban-automotive-g-wagon-g63-w465-widetrack-5-2560.webp',
    ],
  },
  'CCRK-C4': {
    image: 'https://cdn11.bigcommerce.com/s-a06wg97csf/images/stencil/original/products/1845/1094/CCRK-C4__53202.1638317631.jpg?c=1',
  },
  'CCRK-C6': {
    image: 'https://cdn11.bigcommerce.com/s-a06wg97csf/images/stencil/original/products/1848/1097/CCRK-C6__46576.1638317631.jpg?c=1',
  },
  'CCRK1-133': {
    image: 'https://cdn11.bigcommerce.com/s-a06wg97csf/images/stencil/original/products/1848/1097/CCRK-C6__46576.1638317631.jpg?c=1',
  },
  'CCRK2-133': {
    image: 'https://cdn11.bigcommerce.com/s-a06wg97csf/images/stencil/original/products/1845/1094/CCRK-C4__53202.1638317631.jpg?c=1',
  },
  'A1-276': {
    image: 'https://cdn11.bigcommerce.com/s-a06wg97csf/images/stencil/original/products/3565/2545/408mm72v__87802.1677861756.jpg?c=1',
  },
};

function isGirodiscCatalogProduct(product: Pick<ShopProduct, 'brand' | 'vendor'>) {
  return normalizeBrandImageKey(product.brand) === 'GIRODISC' || normalizeBrandImageKey(product.vendor) === 'GIRODISC';
}

function isImageComingSoonAsset(value: string | null | undefined) {
  return /(?:^|[/_-])image-coming-soon(?:[/_.-]|$)/i.test(String(value ?? ''));
}

function applyShopProductImageOverrides(product: ShopProduct): ShopProduct {
  const override = SHOP_PRODUCT_IMAGE_OVERRIDES[String(product.sku ?? '').trim().toUpperCase()];
  const hasGirodiscPlaceholder =
    isGirodiscCatalogProduct(product) &&
    (isImageComingSoonAsset(product.image) || Boolean(product.gallery?.some(isImageComingSoonAsset)));

  if (!override && !hasGirodiscPlaceholder) {
    return product;
  }

  const image = override?.image ?? SHOP_PRODUCT_FALLBACK_IMAGE;
  const gallery = uniqueStrings(
    override?.gallery ??
      (hasGirodiscPlaceholder
        ? [image]
        : (product.gallery?.map((src) => (isImageComingSoonAsset(src) ? image : src)) ?? [image]))
  );

  if (
    product.image === image &&
    product.gallery?.length === gallery.length &&
    product.gallery.every((src, index) => src === gallery[index])
  ) {
    return product;
  }

  return {
    ...product,
    image,
    gallery,
  };
}

function normalizeBrandImageKey(value: string | null | undefined) {
  return String(value ?? '').trim().toUpperCase();
}

function hasCatalogPrice(
  product: Pick<ShopProduct, 'price'> | Pick<AdminShopProductRecord, 'priceEur' | 'priceUsd' | 'priceUah'>
) {
  if ('price' in product) {
    return [product.price.eur, product.price.usd, product.price.uah].some((value) => Number(value) > 0);
  }

  return [product.priceEur, product.priceUsd, product.priceUah].some((value) => Number(value) > 0);
}

function isFeedManagedBrandValue(value: string | null | undefined) {
  return FEED_MANAGED_BRANDS.has(normalizeBrandImageKey(value));
}

function isFeedManagedCatalogProduct(product: Pick<ShopProduct, 'brand' | 'vendor'>) {
  return isFeedManagedBrandValue(product.brand) || isFeedManagedBrandValue(product.vendor);
}

function hasUrbanGpPortalSource(product: Pick<ShopProduct, 'tags'>) {
  return (product.tags ?? []).some((tag) => String(tag).trim().toLowerCase() === 'urban-source:gp-portal');
}

function isUrbanCatalogProduct(product: Pick<ShopProduct, 'brand' | 'vendor' | 'tags' | 'slug'>) {
  const brandKey = normalizeBrandImageKey(product.brand);
  const vendorKey = normalizeBrandImageKey(product.vendor);
  const tags = product.tags ?? [];

  return (
    brandKey === 'URBAN' ||
    brandKey === 'URBAN AUTOMOTIVE' ||
    vendorKey === 'URBAN' ||
    vendorKey === 'URBAN AUTOMOTIVE' ||
    String(product.slug ?? '').startsWith('urb-') ||
    String(product.slug ?? '').startsWith('urban-') ||
    tags.some((tag) => {
      const normalizedTag = String(tag).trim().toLowerCase();
      return normalizedTag === 'store:urban' || normalizedTag.startsWith('urban-source:');
    })
  );
}

function shouldExposeCatalogProduct(product: Pick<ShopProduct, 'brand' | 'vendor' | 'tags' | 'slug'>) {
  return !isUrbanCatalogProduct(product) || hasUrbanGpPortalSource(product);
}

function resolveFeedManagedBrandKey(brand: string | null | undefined, vendor?: string | null) {
  const brandKey = normalizeBrandImageKey(brand);
  if (FEED_MANAGED_BRANDS.has(brandKey)) {
    return brandKey;
  }

  const vendorKey = normalizeBrandImageKey(vendor);
  return FEED_MANAGED_BRANDS.has(vendorKey) ? vendorKey : null;
}

function resolveBrandFallbackImage(brand: string | null | undefined, vendor?: string | null) {
  return (
    BRAND_FALLBACK_IMAGES[normalizeBrandImageKey(brand)] ??
    BRAND_FALLBACK_IMAGES[normalizeBrandImageKey(vendor)] ??
    undefined
  );
}

export function resolveFeedManagedCatalogImage(
  input: string | null | undefined,
  brand: string | null | undefined,
  vendor?: string | null
) {
  const src = String(input ?? '').trim();
  const brandKey = resolveFeedManagedBrandKey(brand, vendor);
  const fallbackImage = resolveBrandFallbackImage(brand, vendor);

  if (!brandKey || !fallbackImage) {
    return src;
  }

  if (!src) {
    return fallbackImage;
  }

  const expectedLocalPrefix = LOCAL_SHOP_BRAND_IMAGE_PREFIXES[brandKey];
  if (expectedLocalPrefix && src.startsWith(expectedLocalPrefix)) {
    return src;
  }

  const isOtherKnownBrandAsset = Object.entries(LOCAL_SHOP_BRAND_IMAGE_PREFIXES).some(
    ([key, prefix]) => key !== brandKey && src.startsWith(prefix)
  );

  return isOtherKnownBrandAsset ? fallbackImage : src;
}

function normalizeFeedManagedProductImages(product: ShopProduct): ShopProduct {
  if (!isFeedManagedCatalogProduct(product)) {
    return product;
  }

  const image = resolveFeedManagedCatalogImage(product.image, product.brand, product.vendor);
  const gallery = product.gallery
    ? uniqueStrings(product.gallery.map((src) => resolveFeedManagedCatalogImage(src, product.brand, product.vendor)))
    : product.gallery;
  const variants = product.variants?.map((variant) => {
    const variantImage = variant.image
      ? resolveFeedManagedCatalogImage(variant.image, product.brand, product.vendor)
      : variant.image;

    return variantImage === variant.image ? variant : { ...variant, image: variantImage };
  });

  const imageChanged = image !== product.image;
  const galleryChanged =
    Boolean(gallery) &&
    (gallery?.length !== product.gallery?.length || gallery?.some((src, index) => src !== product.gallery?.[index]));
  const variantsChanged =
    Boolean(variants) &&
    variants?.some((variant, index) => variant.image !== product.variants?.[index]?.image);

  if (!imageChanged && !galleryChanged && !variantsChanged) {
    return product;
  }

  return {
    ...product,
    image,
    gallery,
    variants,
  };
}

function normalizeCatalogAssetInput(input: string | null | undefined) {
  const raw = String(input ?? '').trim();
  if (!raw) {
    return '';
  }

  if (!raw.startsWith('http://') && !raw.startsWith('https://')) {
    return raw;
  }

  try {
    const parsed = new URL(raw);
    parsed.pathname = parsed.pathname.replace(/\/{2,}/g, '/');
    return parsed.toString();
  } catch {
    return raw;
  }
}

function resolveCatalogAssetUrl(input: string | null | undefined, fallbackSrc?: string) {
  const resolved = resolveUrbanThemeAssetUrl(normalizeCatalogAssetInput(input));
  if (!resolved && fallbackSrc) {
    return fallbackSrc;
  }
  if (fallbackSrc && isBrabusLocalImage(resolved) && shouldUseDeployedBrabusFallback) {
    return fallbackSrc;
  }
  return resolved;
}

function moneySet(input: Partial<ShopMoneySet> | null | undefined): ShopMoneySet {
  return {
    eur: Number(input?.eur ?? 0) || 0,
    usd: Number(input?.usd ?? 0) || 0,
    uah: Number(input?.uah ?? 0) || 0,
  };
}

function mapDbToCatalog(row: AdminShopProductRecord): ShopProduct {
  const num = (v: unknown) => (v != null && typeof v === 'number' ? v : v != null ? Number(v) : 0);
  const hl = row.highlights as { ua?: string[]; en?: string[] } | null;
  const highlightsArr = Array.isArray(hl?.ua)
    ? (hl.ua || []).map((text, i) => ({
        ua: text,
        en: hl.en?.[i] ?? text,
      }))
    : [];
  const primaryVariant = row.variants.find((variant) => variant.isDefault) ?? row.variants[0];
  const sortedMedia = [...row.media].sort((a, b) => a.position - b.position);
  const galleryFromMedia = sortedMedia.map((item) => item.src);
  const legacyGallery = Array.isArray(row.gallery) ? row.gallery.filter((item): item is string => typeof item === 'string') : [];
  const rawPrimaryImage = row.image ?? primaryVariant?.image ?? galleryFromMedia[0] ?? '';
  const brandFallbackImage = resolveBrandFallbackImage(row.brand, row.vendor);
  const brabusFallbackImage = resolveBrabusFallbackImage({
    brand: row.brand ?? row.vendor ?? '',
    slug: row.slug,
    sku: row.sku ?? primaryVariant?.sku ?? '',
    tags: row.tags ?? [],
    title: {
      ua: row.titleUa,
      en: row.titleEn,
    },
    collection: {
      ua: row.collectionUa ?? '',
      en: row.collectionEn ?? '',
    },
    image: rawPrimaryImage,
  });
  const catalogFallbackImage = brabusFallbackImage ?? brandFallbackImage;
  const resolvedPrimaryImage = resolveCatalogAssetUrl(rawPrimaryImage, catalogFallbackImage);
  const resolvedGallery = uniqueStrings(
    (legacyGallery.length ? legacyGallery : galleryFromMedia).map((url) =>
      resolveCatalogAssetUrl(url, catalogFallbackImage)
    )
  );
  const productGallery = resolvedGallery.length
    ? resolvedGallery
    : resolvedPrimaryImage
      ? [resolvedPrimaryImage]
      : [];
  const unsafeGpDescription = [
    row.shortDescUa,
    row.shortDescEn,
    row.longDescUa,
    row.longDescEn,
    row.bodyHtmlUa,
    row.bodyHtmlEn,
    row.seoDescriptionUa,
    row.seoDescriptionEn,
  ].some(isUnsafeUrbanGpDescription);
  const curatedUrbanDescription = getUrbanCuratedDescriptionOverride({
    slug: row.slug,
  });
  const poorUrbanUaDescription =
    !curatedUrbanDescription &&
    [row.titleUa, row.shortDescUa, row.longDescUa, row.bodyHtmlUa, row.seoDescriptionUa].some(hasPoorUrbanUaMachineCopy);
  const safeGpDescription = unsafeGpDescription
    ? buildUrbanGpSafeFallbackDescription({
        slug: row.slug,
        sku: row.sku ?? primaryVariant?.sku ?? '',
        titleUa: row.titleUa,
        titleEn: row.titleEn,
        categoryUa: row.categoryUa ?? row.category?.titleUa ?? '',
        categoryEn: resolveEnglishCategory(row.categoryEn, row.categoryUa) || row.category?.titleEn || '',
        collectionUa: row.collectionUa ?? '',
        collectionEn: row.collectionEn ?? '',
        brand: row.brand,
        vendor: row.vendor,
        productType: row.productType,
      })
    : null;
  const generatedUrbanUaDescription = poorUrbanUaDescription || unsafeGpDescription
    ? buildUrbanEditorialCopy({
        slug: row.slug,
        titleEn: row.titleEn,
        titleUa: row.titleUa,
        shortDescEn: row.shortDescEn,
        shortDescUa: row.shortDescUa,
        longDescEn: row.longDescEn,
        longDescUa: row.longDescUa,
        bodyHtmlEn: row.bodyHtmlEn,
        bodyHtmlUa: row.bodyHtmlUa,
        brand: row.brand,
        categoryEn: resolveEnglishCategory(row.categoryEn, row.categoryUa) || row.category?.titleEn || '',
        categoryUa: row.categoryUa ?? row.category?.titleUa ?? '',
        productType: row.productType,
        collectionEn: row.collectionEn ?? '',
        collectionUa: row.collectionUa ?? '',
        tags: row.tags ?? [],
      })
    : null;
  const productB2BPrice = moneySet({
    eur: num(row.priceEurB2b ?? primaryVariant?.priceEurB2b),
    usd: num(row.priceUsdB2b ?? primaryVariant?.priceUsdB2b),
    uah: num(row.priceUahB2b ?? primaryVariant?.priceUahB2b),
  });
  const productB2BCompareAt = moneySet({
    eur: num(row.compareAtEurB2b ?? primaryVariant?.compareAtEurB2b),
    usd: num(row.compareAtUsdB2b ?? primaryVariant?.compareAtUsdB2b),
    uah: num(row.compareAtUahB2b ?? primaryVariant?.compareAtUahB2b),
  });
  const bundleInventory = row.bundle
    ? resolveBundleInventory(
        row.bundle.items.map((item) => ({
          id: item.id,
          quantity: item.quantity,
          componentProduct: {
            id: item.componentProduct.id,
            slug: item.componentProduct.slug,
            scope: item.componentProduct.scope === 'moto' ? 'moto' : 'auto',
            brand: item.componentProduct.brand ?? '',
            image: resolveCatalogAssetUrl(item.componentProduct.image ?? ''),
            title: {
              ua: item.componentProduct.titleUa,
              en: item.componentProduct.titleEn,
            },
            collection: {
              ua: item.componentProduct.collectionUa ?? '',
              en: item.componentProduct.collectionEn ?? '',
            },
            collections: item.componentProduct.collections.map((entry) => ({
              id: entry.collection.id,
              handle: entry.collection.handle,
              title: {
                ua: entry.collection.titleUa,
                en: entry.collection.titleEn,
              },
              brand: entry.collection.brand,
              isUrban: entry.collection.isUrban,
              sortOrder: entry.sortOrder,
            })),
            tags: item.componentProduct.tags,
            stock: item.componentProduct.stock,
            defaultVariantInventoryQty:
              item.componentProduct.variants.find((variant) => variant.isDefault)?.inventoryQty ??
              item.componentProduct.variants[0]?.inventoryQty ??
              0,
          },
          componentVariant: item.componentVariant
            ? {
                id: item.componentVariant.id,
                title: item.componentVariant.title,
                inventoryQty: item.componentVariant.inventoryQty,
              }
            : null,
        }))
      )
    : null;

  return {
    id: row.id,
    slug: row.slug,
    sku: row.sku ?? primaryVariant?.sku ?? '',
    scope: row.scope as ShopScope,
    brand: row.brand ?? '',
    vendor: row.vendor ?? undefined,
    productType: row.productType ?? undefined,
    tags: row.tags ?? [],
    collections: row.collections.map((entry) => ({
      id: entry.collection.id,
      handle: entry.collection.handle,
      title: {
        ua: entry.collection.titleUa,
        en: entry.collection.titleEn,
      },
      brand: entry.collection.brand,
      isUrban: entry.collection.isUrban,
      sortOrder: entry.sortOrder,
    })),
    title: { ua: generatedUrbanUaDescription?.titleUa ?? row.titleUa, en: row.titleEn },
    category: {
      ua: row.categoryUa ?? row.category?.titleUa ?? '',
      en: resolveEnglishCategory(row.categoryEn, row.categoryUa) || row.category?.titleEn || '',
    },
    shortDescription: {
      ua: curatedUrbanDescription?.shortDescription.ua ?? generatedUrbanUaDescription?.shortDescUa ?? safeGpDescription?.shortDescription.ua ?? row.shortDescUa ?? '',
      en: curatedUrbanDescription?.shortDescription.en ?? safeGpDescription?.shortDescription.en ?? row.shortDescEn ?? '',
    },
    longDescription: {
      ua: sanitizeRichTextHtml(curatedUrbanDescription?.bodyHtml.ua ?? generatedUrbanUaDescription?.bodyHtmlUa ?? safeGpDescription?.bodyHtml.ua ?? row.bodyHtmlUa ?? row.longDescUa ?? ''),
      en: sanitizeRichTextHtml(curatedUrbanDescription?.bodyHtml.en ?? safeGpDescription?.bodyHtml.en ?? row.bodyHtmlEn ?? row.longDescEn ?? ''),
    },
    leadTime: { ua: row.leadTimeUa ?? '', en: row.leadTimeEn ?? '' },
    stock: (bundleInventory?.stock ?? (row.stock === 'preOrder' ? 'preOrder' : 'inStock')) as ShopStock,
    collection: { ua: row.collectionUa ?? '', en: row.collectionEn ?? '' },
    price: {
      eur: num(row.priceEur ?? primaryVariant?.priceEur),
      usd: num(row.priceUsd ?? primaryVariant?.priceUsd),
      uah: num(row.priceUah ?? primaryVariant?.priceUah),
    },
    b2bPrice:
      productB2BPrice.eur > 0 || productB2BPrice.usd > 0 || productB2BPrice.uah > 0
        ? productB2BPrice
        : undefined,
    compareAt:
      row.compareAtEur != null ||
      row.compareAtUsd != null ||
      row.compareAtUah != null ||
      primaryVariant?.compareAtEur != null ||
      primaryVariant?.compareAtUsd != null ||
      primaryVariant?.compareAtUah != null
        ? {
            eur: num(row.compareAtEur ?? primaryVariant?.compareAtEur),
            usd: num(row.compareAtUsd ?? primaryVariant?.compareAtUsd),
            uah: num(row.compareAtUah ?? primaryVariant?.compareAtUah),
          }
        : undefined,
    weightKg:
      (row as any).weight != null ? Number((row as any).weight) : (primaryVariant as any)?.weight != null ? Number((primaryVariant as any).weight) : null,
    length:
      (row as any).length != null ? Number((row as any).length) : (primaryVariant as any)?.length != null ? Number((primaryVariant as any).length) : null,
    width:
      (row as any).width != null ? Number((row as any).width) : (primaryVariant as any)?.width != null ? Number((primaryVariant as any).width) : null,
    height:
      (row as any).height != null ? Number((row as any).height) : (primaryVariant as any)?.height != null ? Number((primaryVariant as any).height) : null,
    b2bCompareAt:
      productB2BCompareAt.eur > 0 || productB2BCompareAt.usd > 0 || productB2BCompareAt.uah > 0
        ? productB2BCompareAt
        : undefined,
    image: resolvedPrimaryImage,
    gallery: productGallery,
    highlights: highlightsArr,
    variants: row.variants.map((variant) => {
      const variantB2BPrice = moneySet({
        eur: num(variant.priceEurB2b),
        usd: num(variant.priceUsdB2b),
        uah: num(variant.priceUahB2b),
      });
      const variantB2BCompareAt = moneySet({
        eur: num(variant.compareAtEurB2b),
        usd: num(variant.compareAtUsdB2b),
        uah: num(variant.compareAtUahB2b),
      });

      return {
        id: variant.id,
        title: variant.title,
        sku: variant.sku,
        position: variant.position,
        optionValues: [variant.option1Value, variant.option2Value, variant.option3Value].filter(
          (value): value is string => Boolean(value)
        ),
        inventoryQty: variant.inventoryQty,
        image: variant.image ? resolveCatalogAssetUrl(variant.image, brabusFallbackImage) : null,
        isDefault: variant.isDefault,
        price: moneySet({
          eur: num(variant.priceEur),
          usd: num(variant.priceUsd),
          uah: num(variant.priceUah),
        }),
        weightKg: (variant as any).weight != null ? Number((variant as any).weight) : null,
        length: (variant as any).length != null ? Number((variant as any).length) : null,
        width: (variant as any).width != null ? Number((variant as any).width) : null,
        height: (variant as any).height != null ? Number((variant as any).height) : null,
        b2bPrice:
          variantB2BPrice.eur > 0 || variantB2BPrice.usd > 0 || variantB2BPrice.uah > 0
            ? variantB2BPrice
            : undefined,
        compareAt:
          variant.compareAtEur != null || variant.compareAtUsd != null || variant.compareAtUah != null
            ? moneySet({
                eur: num(variant.compareAtEur),
                usd: num(variant.compareAtUsd),
                uah: num(variant.compareAtUah),
              })
            : undefined,
        b2bCompareAt:
          variantB2BCompareAt.eur > 0 || variantB2BCompareAt.usd > 0 || variantB2BCompareAt.uah > 0
            ? variantB2BCompareAt
            : undefined,
      };
    }),
    categoryNode: row.category
      ? {
          id: row.category.id,
          slug: row.category.slug,
          title: {
            ua: row.category.titleUa,
            en: row.category.titleEn,
          },
        }
      : null,
    bundle: row.bundle
      ? {
          id: row.bundle.id,
          availableQuantity: bundleInventory?.availableQuantity ?? 0,
          items: bundleInventory?.items ?? [],
        }
      : null,
  };
}

function normalizeCatalogProducts(products: ShopProduct[]) {
  const normalized: ShopProduct[] = [];
  const brabusBySku = new Map<string, ShopProduct>();

  for (const rawProduct of products) {
    const product = applyShopProductImageOverrides(normalizeFeedManagedProductImages(rawProduct));

    if (!shouldExposeCatalogProduct(product)) {
      continue;
    }

    if (isFeedManagedCatalogProduct(product) && !hasCatalogPrice(product)) {
      continue;
    }

    if (isLikelyBrabusOverviewProductLike({
      sku: product.sku,
      titleEn: product.title.en,
      priceEur: product.price.eur,
      priceUsd: product.price.usd,
      priceUah: product.price.uah,
    })) {
      continue;
    }

    const isBrabus = product.brand === 'Brabus' || product.vendor === 'Brabus';
    const skuKey = String(product.sku ?? '').trim().toLowerCase();

    if (!isBrabus || !skuKey) {
      normalized.push(product);
      continue;
    }

    const existing = brabusBySku.get(skuKey);
    const candidateScore = scoreBrabusProductCandidateLike({
      sku: product.sku,
      slug: product.slug,
      titleEn: product.title.en,
      titleUa: product.title.ua,
      image: product.image,
      gallery: product.gallery,
      priceEur: product.price.eur,
      priceUsd: product.price.usd,
      priceUah: product.price.uah,
    });
    const existingScore = existing
      ? scoreBrabusProductCandidateLike({
          sku: existing.sku,
          slug: existing.slug,
          titleEn: existing.title.en,
          titleUa: existing.title.ua,
          image: existing.image,
          gallery: existing.gallery,
          priceEur: existing.price.eur,
          priceUsd: existing.price.usd,
          priceUah: existing.price.uah,
        })
      : Number.NEGATIVE_INFINITY;

    if (!existing || candidateScore > existingScore) {
      brabusBySku.set(skuKey, product);
    }
  }

  return [...normalized, ...brabusBySku.values()];
}

let globalProductsCache: ShopProduct[] | null = null;
let lastCacheTime = 0;
let globalProductsPromise: Promise<ShopProduct[]> | null = null;
const SHOP_PRODUCTS_DEV_CACHE_VERSION = 4;

/** All products: from DB (published) then static catalog (by slug, DB wins). */
export async function getShopProductsServer(): Promise<ShopProduct[]> {
  const now = Date.now();
  // Memory cache for 45 seconds (prevents Vercel OOM during heavy static build)
  if (globalProductsCache && (now - lastCacheTime < 45000)) {
    return globalProductsCache;
  }
  if (globalProductsPromise) {
    return globalProductsPromise;
  }

  // File cache for local development to avoid repeated filesystem checks
  const isDev = process.env.NODE_ENV === 'development';
  const cachePath = isDev ? path.join(process.cwd(), '.shop-products-dev-cache.json') : '';
  
  if (isDev && fs.existsSync(cachePath)) {
    try {
      const stat = fs.statSync(cachePath);
      // Use file cache if it's less than 3 hours old
      if (now - stat.mtimeMs < 1000 * 60 * 60 * 3) {
        const fileContent = fs.readFileSync(cachePath, 'utf8');
        const parsedCache = JSON.parse(fileContent);
        const cachedProducts =
          parsedCache &&
          typeof parsedCache === 'object' &&
          parsedCache.version === SHOP_PRODUCTS_DEV_CACHE_VERSION &&
          Array.isArray(parsedCache.products)
            ? parsedCache.products
            : null;

        if (cachedProducts) {
          globalProductsCache = normalizeCatalogProducts(cachedProducts);
          lastCacheTime = stat.mtimeMs;
          return globalProductsCache as ShopProduct[];
        }
      }
    } catch {
      // ignore parse errors and fetch fresh
    }
  }

  globalProductsPromise = (async () => {
    let dbRows: AdminShopProductRecord[] = [];
    try {
      dbRows = await prisma.shopProduct.findMany({
        where: { isPublished: true },
        orderBy: { updatedAt: 'desc' },
        include: adminProductInclude,
      });
    } catch {
      // No DB or not migrated — use only static
      return normalizeCatalogProducts(SHOP_PRODUCTS);
    }

    const dbProducts = normalizeCatalogProducts(dbRows.map((row) => mapDbToCatalog(row)));
    const bySlug = new Map<string, ShopProduct>();
    dbProducts.forEach((product) => bySlug.set(product.slug, product));
    const liveFeedBrands = new Set(
      dbProducts
        .filter((product) => isFeedManagedCatalogProduct(product) && hasCatalogPrice(product))
        .flatMap((product) => [product.brand, product.vendor].map((value) => normalizeBrandImageKey(value)))
        .filter((value) => FEED_MANAGED_BRANDS.has(value))
    );
    SHOP_PRODUCTS.forEach((p) => {
      if (!shouldExposeCatalogProduct(p)) {
        return;
      }

      if (
        isFeedManagedCatalogProduct(p) &&
        [p.brand, p.vendor].some((value) => liveFeedBrands.has(normalizeBrandImageKey(value)))
      ) {
        return;
      }
      if (!bySlug.has(p.slug)) bySlug.set(p.slug, p);
    });

    globalProductsCache = Array.from(bySlug.values());
    lastCacheTime = Date.now();

    if (isDev && cachePath) {
      try {
        fs.writeFileSync(
          cachePath,
          JSON.stringify({
            version: SHOP_PRODUCTS_DEV_CACHE_VERSION,
            products: globalProductsCache,
          }),
          'utf8'
        );
      } catch {}
    }

    return globalProductsCache;
  })();

  try {
    return await globalProductsPromise;
  } finally {
    globalProductsPromise = null;
  }
}

/** One product by slug: DB first, then static. */
export async function getShopProductBySlugServer(slug: string): Promise<ShopProduct | undefined> {
  try {
    const row = await prisma.shopProduct.findFirst({
      where: { slug, isPublished: true },
      include: adminProductInclude,
    });
    if (row) {
      const product = applyShopProductImageOverrides(mapDbToCatalog(row));
      return shouldExposeCatalogProduct(product) ? product : undefined;
    }
  } catch {
    // ignore
  }
  if (process.env.NODE_ENV === 'development') {
    try {
      const cachePath = path.join(process.cwd(), '.shop-products-dev-cache.json');
      if (fs.existsSync(cachePath)) {
        const parsedCache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
        const cachedProducts =
          parsedCache &&
          typeof parsedCache === 'object' &&
          parsedCache.version === SHOP_PRODUCTS_DEV_CACHE_VERSION &&
          Array.isArray(parsedCache.products)
            ? normalizeCatalogProducts(parsedCache.products)
            : [];
        const cachedProduct = cachedProducts.find((product) => product.slug === slug);
        if (cachedProduct) return applyShopProductImageOverrides(cachedProduct);
      }
    } catch {
      // ignore stale local cache
    }
  }
  const staticProduct = getStaticBySlug(slug);
  if (!staticProduct || !shouldExposeCatalogProduct(staticProduct)) {
    return undefined;
  }

  return applyShopProductImageOverrides(staticProduct);
}
