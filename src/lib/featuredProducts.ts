export interface FeaturedProductItem {
  id: string;
  name: string;
  brand: string; // brand display name
  brandLogo: string; // path to logo asset
  category: string; // human readable category
  categorySlug: string; // normalized slug (exhaust, suspension ...)
  description: string;
  price: string; // already formatted (e.g. '$3,490')
  image: string; // product image path (placeholder for now)
  url?: string; // optional deep-link / product / partner page
  highlight?: boolean; // used for slightly larger emphasis
}

// NOTE: Using placeholder images until real product imagery is added.
// Replace `image` paths with actual assets under `public/images/products/...` later.
export const featuredProducts: FeaturedProductItem[] = [
  {
    id: 'eventuri-carbon-intake',
    name: 'Carbon Fiber Intake System',
    brand: 'Eventuri',
    brandLogo: '/logos/eventuri.png',
    category: 'Intake',
    categorySlug: 'intake',
    description: 'Patented Venturi housing delivering dyno-proven gains, sharper throttle and immersive induction sound.',
    price: '$1,890',
    image: '/images/placeholder-product.svg',
    url: '/eventuri',
    highlight: true,
  },
  {
    id: 'fi-titanium-exhaust',
    name: 'Titanium Valved Exhaust System',
    brand: 'Fi Exhaust',
    brandLogo: '/logos/fi-exhaust.png',
    category: 'Exhaust',
    categorySlug: 'exhaust',
    description: 'F1-grade titanium construction, active valves and signature tone with dramatic weight reduction.',
    price: '$6,450',
    image: '/images/placeholder-product.svg',
    url: '/fi',
    highlight: true,
  },
  {
    id: 'kw-v3-coilovers',
    name: 'Variant 3 Adjustable Coilovers',
    brand: 'KW Suspension',
    brandLogo: '/logos/kw.svg',
    category: 'Suspension',
    categorySlug: 'suspension',
    description: 'Independently adjustable rebound & compression damping for ultimate chassis balance.',
    price: '$3,490',
    image: '/images/placeholder-product.svg',
    url: '/kw',
  },
  {
    id: 'brembo-gt-brake-kit',
    name: 'GT Big Brake Kit (Front Axle)',
    brand: 'Brembo',
    brandLogo: '/logos/brembo.png',
    category: 'Brakes',
    categorySlug: 'brakes',
    description: 'Monobloc calipers, floating discs and race-grade pads for relentless, fade-free stopping power.',
    price: '$4,250',
    image: '/images/placeholder-product.svg',
  },
  {
    id: 'akrapovic-slipon',
    name: 'Titanium Slip-On Exhaust',
    brand: 'Akrapovič',
    brandLogo: '/logos/akrapovi.png',
    category: 'Exhaust',
    categorySlug: 'exhaust',
    description: 'Ultra-lightweight titanium architecture engineered for power, tone and precision craftsmanship.',
    price: '$3,990',
    image: '/images/placeholder-product.svg',
  },
  {
    id: 'bbs-forged-wheel',
    name: 'Forged Performance Wheel (Single)',
    brand: 'BBS',
    brandLogo: '/logos/bbs.png',
    category: 'Wheels',
    categorySlug: 'wheels',
    description: 'Motorsport-grade forged aluminum: strength, featherweight mass and iconic structural purity.',
    price: '$1,250',
    image: '/images/placeholder-product.svg',
  },
  {
    id: 'hre-monoblock-set',
    name: 'Forged Monoblock Wheel Set',
    brand: 'HRE Wheels',
    brandLogo: '/logos/hre-wheels.png',
    category: 'Wheels',
    categorySlug: 'wheels',
    description: 'Bespoke offsets, pristine finish quality and uncompromising structural integrity.',
    price: '$7,800',
    image: '/images/placeholder-product.svg',
  },
  {
    id: 'recaro-racing-seat',
    name: 'Composite Racing Seat',
    brand: 'Recaro',
    brandLogo: '/logos/recaro.png',
    category: 'Interior',
    categorySlug: 'interior',
    description: 'Ergonomic shell with FIA-compliant safety and premium material trim options.',
    price: '$1,590',
    image: '/images/placeholder-product.svg',
  },
  {
    id: 'forge-intercooler-kit',
    name: 'High-Efficiency Intercooler Kit',
    brand: 'Forge Motorsport',
    brandLogo: '/logos/forge-motorsport.png',
    category: 'Performance',
    categorySlug: 'performance',
    description: 'Bar & plate core architecture reducing charge temps for sustained, repeatable power.',
    price: '$1,350',
    image: '/images/placeholder-product.svg',
  },
  {
    id: 'ohlins-dfv-dampers',
    name: 'DFV Performance Dampers',
    brand: 'Ohlins',
    brandLogo: '/logos/ohlins.png',
    category: 'Suspension',
    categorySlug: 'suspension',
    description: 'Dual Flow Valve technology delivering refined ride compliance and razor-edged control.',
    price: '$2,990',
    image: '/images/placeholder-product.svg',
  },
].slice(0, 10); // ensure exactly 10 items
