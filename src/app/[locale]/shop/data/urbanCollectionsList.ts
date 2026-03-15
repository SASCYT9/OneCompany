/**
 * Urban collections grid — data from theme list-collections.json.
 * Used by /shop/urban/collections page.
 */

export type UrbanCollectionCard = {
  title: string;
  brand: string;
  collectionHandle: string;
  productCount?: string;
  externalImageUrl: string;
};

export const URBAN_COLLECTIONS_GRID_SETTINGS = {
  eyebrow: 'Urban Automotive',
  heading: 'Our Range',
  subheading:
    'Designed, developed and hand-assembled with the highest quality components, processes and finishes.',
  subheadingUk:
    'Спроєктовано, розроблено та зібрано вручну з найякіснішими комплектуючими, процесами та оздобленням.',
  heroImage:
    'https://smgassets.blob.core.windows.net/customers/urban/dist/img/hero/models/defender2020Plus/2025Updates/hero-1-1920.jpg',
  showFilters: true,
} as const;

export const URBAN_COLLECTION_CARDS: UrbanCollectionCard[] = [
  { title: 'Defender 110', brand: 'Land Rover', collectionHandle: 'land-rover-defender-110', externalImageUrl: 'https://smgassets.blob.core.windows.net/customers/urban/dist/img/carousel/models/defender2020Plus/2025Updates/webp/urban-automotive-defender-2020-onwards-1-2560.webp' },
  { title: 'Urus', brand: 'Lamborghini', collectionHandle: 'lamborghini-urus', externalImageUrl: 'https://smgassets.blob.core.windows.net/customers/urban/dist/img/carousel/models/urus/carousel-1-1920.jpg' },
  { title: 'Cullinan Series II', brand: 'Rolls-Royce', collectionHandle: 'rolls-royce-cullinan-series-ii', externalImageUrl: 'https://smgassets.blob.core.windows.net/customers/urban/dist/img/carousel/models/cullinanSeriesII/webp/urban-automotive-cullinan-series-ii-1-2560.webp' },
  { title: 'G-Wagon Widetrack', brand: 'Mercedes-Benz', collectionHandle: 'mercedes-g-wagon-w465-widetrack', externalImageUrl: 'https://smgassets.blob.core.windows.net/customers/urban/dist/img/carousel/models/gwagonWidetrack2024/webp/urban-automotive-g-wagon-g63-w465-widetrack-1-2560.webp' },
  { title: 'RS6 / RS7', brand: 'Audi', collectionHandle: 'audi-rs6-rs7', externalImageUrl: 'https://smgassets.blob.core.windows.net/customers/urban/dist/img/carousel/models/rs6/carousel-1-1920.jpg' },
  { title: 'Defender 90', brand: 'Land Rover', collectionHandle: 'land-rover-defender-90', externalImageUrl: 'https://smgassets.blob.core.windows.net/customers/urban/dist/img/carousel/models/defender2020Plus/2025Updates/webp/urban-automotive-defender-2020-onwards-3-2560.webp' },
  { title: 'Defender 130', brand: 'Land Rover', collectionHandle: 'land-rover-defender-130', externalImageUrl: 'https://smgassets.blob.core.windows.net/customers/urban/dist/img/carousel/models/defender2020Plus/2025Updates/webp/urban-automotive-defender-2020-onwards-5-2560.webp' },
  { title: 'Defender Octa', brand: 'Land Rover', collectionHandle: 'land-rover-defender-110-octa', externalImageUrl: 'https://smgassets.blob.core.windows.net/customers/urban/dist/img/carousel/models/defenderOcta/webp/urban-automotive-defender-octa-1-2560.webp' },
  { title: 'Urus S', brand: 'Lamborghini', collectionHandle: 'lamborghini-urus-s', externalImageUrl: 'https://smgassets.blob.core.windows.net/customers/urban/dist/img/hero/models/urusS/hero-1-1920.jpg' },
  { title: 'Urus Performante', brand: 'Lamborghini', collectionHandle: 'lamborghini-urus-performante', externalImageUrl: 'https://smgassets.blob.core.windows.net/customers/urban/dist/img/hero/models/urusPerformante/hero-1-1920.jpg' },
  { title: 'Aventador S', brand: 'Lamborghini', collectionHandle: 'lamborghini-aventador-s', externalImageUrl: 'https://smgassets.blob.core.windows.net/customers/urban/dist/img/carousel/models/aventador/carousel-1-1920.jpg' },
  { title: 'RSQ8 Facelift', brand: 'Audi', collectionHandle: 'audi-rsq8-facelift', externalImageUrl: 'https://smgassets.blob.core.windows.net/customers/urban/dist/img/carousel/models/rsq82024/webp/urban-aero-kit-daytona-2025-audi-rsq8-1-2560.webp' },
  { title: 'RSQ8', brand: 'Audi', collectionHandle: 'audi-rsq8', externalImageUrl: 'https://smgassets.blob.core.windows.net/customers/urban/dist/img/carousel/models/rsq8/carousel-1-1920.jpg' },
  { title: 'RS4 B9.5', brand: 'Audi', collectionHandle: 'audi-rs4', externalImageUrl: 'https://smgassets.blob.core.windows.net/customers/urban/dist/img/carousel/models/rs4/carousel-1-1920.jpg' },
  { title: 'RS3', brand: 'Audi', collectionHandle: 'audi-rs3', externalImageUrl: 'https://smgassets.blob.core.windows.net/customers/urban/dist/img/carousel/models/rs3-saloon/carousel-1-1920.jpg' },
  { title: 'Cullinan', brand: 'Rolls-Royce', collectionHandle: 'rolls-royce-cullinan', externalImageUrl: 'https://smgassets.blob.core.windows.net/customers/urban/dist/img/hero/models/cullinan/hero-1-1920.jpg' },
  { title: 'Ghost Series II', brand: 'Rolls-Royce', collectionHandle: 'rolls-royce-ghost-series-ii', externalImageUrl: 'https://smgassets.blob.core.windows.net/customers/urban/dist/img/carousel/models/ghost/carousel-1-1920.jpg' },
  { title: 'G-Wagon Aerokit', brand: 'Mercedes-Benz', collectionHandle: 'mercedes-g-wagon-w465-aerokit', externalImageUrl: 'https://smgassets.blob.core.windows.net/customers/urban/dist/img/carousel/models/gwagonAeroKit2024/webp/urban-automotive-g-wagon-g63-w465-aerokit-1-2560.webp' },
  { title: 'G-Wagon Softkit', brand: 'Mercedes-Benz', collectionHandle: 'mercedes-g-wagon-softkit', externalImageUrl: 'https://smgassets.blob.core.windows.net/customers/urban/dist/img/carousel/models/gwagonSoftKit/carousel-1-1920.jpg' },
  { title: 'EQC', brand: 'Mercedes-Benz', collectionHandle: 'mercedes-eqc', externalImageUrl: 'https://smgassets.blob.core.windows.net/customers/urban/dist/img/carousel/models/eqc/carousel-1-1920.jpg' },
  { title: 'Range Rover L460', brand: 'Range Rover', collectionHandle: 'range-rover-l460', externalImageUrl: 'https://smgassets.blob.core.windows.net/customers/urban/dist/img/carousel/models/rangeRover2022Plus/webp/urban-range-rover-mk-dons-1-1920.webp' },
  { title: 'Sport L461', brand: 'Range Rover', collectionHandle: 'range-rover-sport-l461', externalImageUrl: 'https://smgassets.blob.core.windows.net/customers/urban/dist/img/cols/models/rangeRoverSportL461/col-image-1-lg.jpg' },
  { title: 'Sport L494 SVR', brand: 'Range Rover', collectionHandle: 'range-rover-sport-l494', externalImageUrl: 'https://smgassets.blob.core.windows.net/customers/urban/dist/img/carousel/models/rangeRoverSVR/carousel-1-1920.jpg' },
  { title: 'Continental GT', brand: 'Bentley', collectionHandle: 'bentley-continental-gt', externalImageUrl: 'https://smgassets.blob.core.windows.net/customers/urban/dist/img/carousel/models/continentalGT/carousel-1-1920.jpg' },
  { title: 'Discovery 5', brand: 'Land Rover', collectionHandle: 'land-rover-discovery-5', externalImageUrl: 'https://smgassets.blob.core.windows.net/customers/urban/dist/img/hero/models/discovery2021Plus/hero-1-1920.jpg' },
  { title: 'Golf R', brand: 'Volkswagen', collectionHandle: 'volkswagen-golf-r', externalImageUrl: 'https://smgassets.blob.core.windows.net/customers/urban/dist/img/carousel/models/golfRMk8/carousel-1-1920.jpg' },
  { title: 'Transporter T6.1', brand: 'Volkswagen', collectionHandle: 'volkswagen-transporter-t6-1', externalImageUrl: 'https://smgassets.blob.core.windows.net/customers/urban/dist/img/carousel/models/t6-1/carousel-1-1920.jpg' },
];

export const URBAN_COLLECTION_BRANDS = [
  'Land Rover', 'Lamborghini', 'Rolls-Royce', 'Mercedes-Benz', 'Audi', 'Range Rover', 'Bentley', 'Volkswagen',
] as const;
