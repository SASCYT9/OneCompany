// src/lib/brands.ts

export type BrandCategory = 'usa' | 'europe' | 'oem' | 'racing' | 'moto' | 'auto';

export type CountryOfOrigin = 
  | 'USA' 
  | 'Japan' 
  | 'Germany' 
  | 'Italy' 
  | 'UK' 
  | 'Australia' 
  | 'Netherlands'
  | 'Czech Republic'
  | 'Spain'
  | 'Austria'
  | 'France'
  | 'Belgium'
  | 'Hong Kong'
  | 'Slovenia'
  | 'Taiwan'
  | 'Sweden'
  | 'Poland'
  | 'China'
  | 'New Zealand'
  | 'Lithuania'
  | 'Hungary';

export type ProductSubcategory = 
  | 'Engine'
  | 'Exterior'
  | 'Suspension'
  | 'Brakes'
  | 'Wheels'
  | 'Exhaust'
  | 'Electronics'
  | 'Interior'
  | 'Drivetrain'
  | 'Cooling'
  | 'Fuel Systems'
  | 'Aero'
  | 'Racing Components'
  | 'Full Vehicle';

export interface BrandMetadata {
  country: CountryOfOrigin;
  subcategory: ProductSubcategory;
}

// Localized country names
export const countryNames: Record<CountryOfOrigin, { en: string; ua: string }> = {
  'USA': { en: 'USA', ua: 'США' },
  'Japan': { en: 'Japan', ua: 'Японія' },
  'Germany': { en: 'Germany', ua: 'Німеччина' },
  'Italy': { en: 'Italy', ua: 'Італія' },
  'UK': { en: 'UK', ua: 'Велика Британія' },
  'Australia': { en: 'Australia', ua: 'Австралія' },
  'Netherlands': { en: 'Netherlands', ua: 'Нідерланди' },
  'Czech Republic': { en: 'Czech Republic', ua: 'Чехія' },
  'Spain': { en: 'Spain', ua: 'Іспанія' },
  'Austria': { en: 'Austria', ua: 'Австрія' },
  'France': { en: 'France', ua: 'Франція' },
  'Belgium': { en: 'Belgium', ua: 'Бельгія' },
  'Hong Kong': { en: 'Hong Kong', ua: 'Гонконг' },
  'Slovenia': { en: 'Slovenia', ua: 'Словенія' },
  'Taiwan': { en: 'Taiwan', ua: 'Тайвань' },
  'Sweden': { en: 'Sweden', ua: 'Швеція' },
  'Poland': { en: 'Poland', ua: 'Польща' },
  'China': { en: 'China', ua: 'Китай' },
  'New Zealand': { en: 'New Zealand', ua: 'Нова Зеландія' },
  'Lithuania': { en: 'Lithuania', ua: 'Литва' },
  'Hungary': { en: 'Hungary', ua: 'Угорщина' },
};

// Localized subcategory names
export const subcategoryNames: Record<ProductSubcategory, { en: string; ua: string }> = {
  'Engine': { en: 'Engine', ua: 'Двигун' },
  'Exterior': { en: 'Exterior', ua: 'Екстер\'єр' },
  'Suspension': { en: 'Suspension', ua: 'Підвіска' },
  'Brakes': { en: 'Brakes', ua: 'Гальма' },
  'Wheels': { en: 'Wheels', ua: 'Диски' },
  'Exhaust': { en: 'Exhaust', ua: 'Вихлоп' },
  'Electronics': { en: 'Electronics', ua: 'Електроніка' },
  'Interior': { en: 'Interior', ua: 'Інтер\'єр' },
  'Drivetrain': { en: 'Drivetrain', ua: 'Трансмісія' },
  'Cooling': { en: 'Cooling', ua: 'Охолодження' },
  'Fuel Systems': { en: 'Fuel Systems', ua: 'Паливна система' },
  'Aero': { en: 'Aero', ua: 'Аеродинаміка' },
  'Racing Components': { en: 'Racing Components', ua: 'Спортивні компоненти' },
  'Full Vehicle': { en: 'Full Vehicle', ua: 'Комплексні рішення' },
};

// Local simplified brand type for static data
export interface LocalBrand {
  name: string;
  slug?: string;
  description?: string; // Optional description
  logoUrl?: string; // Optional path to logo
  category?: BrandCategory;
  website?: string;
  specialties?: string[];
}

// Helper function to generate slug from brand name
export function getBrandSlug(brand: LocalBrand | string): string {
  const name = typeof brand === 'string' ? brand : brand.slug || brand.name;
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Helper function to find a brand by slug
export function getBrandBySlug(slug: string): LocalBrand | undefined {
  const allBrands = [...allAutomotiveBrands, ...allMotoBrands];
  return allBrands.find(brand => getBrandSlug(brand) === slug);
}

// Helper to get brand with category info
export function getBrandWithCategory(slug: string): (LocalBrand & { category: BrandCategory }) | undefined {
  // Check automotive categories
  const automotiveCategories = ['usa', 'europe', 'oem', 'racing', 'auto'] as const;
  for (const category of automotiveCategories) {
    const brands = getBrandsByCategory(category);
    const brand = brands.find(b => getBrandSlug(b) === slug);
    if (brand) {
      return { ...brand, category };
    }
  }
  
  // Check moto
  const motoBrand = brandsMoto.find(b => getBrandSlug(b) === slug);
  if (motoBrand) {
    return { ...motoBrand, category: 'moto' };
  }
  
  return undefined;
}

export const brandsUsa: LocalBrand[] = [
  { name: '1221 wheels' },
  { name: '1016 Industries' },
  { name: '5150 Autosport' },
  { name: 'AE Design' },
  { name: 'ADV.1 wheels' },
  { name: 'Agency Power' },
  { name: 'Airlift Performance' },
  { name: 'AL13 wheels' },
  { name: 'AMS / Alpha Performance' },
  { name: 'American Racing Headers' },
  { name: 'ANRKY wheels' },
  { name: 'APR' },
  { name: 'Avantgarde Wheels' },
  { name: 'BE bearings' },
  { name: 'BBi Autosport' },
  { name: 'Big Boost' },
  { name: 'BimmerWorld' },
  { name: 'BootMod3' },
  { name: 'Borla' },
  { name: 'Brixton wheels' },
  { name: 'Burger Motorsport' },
  { name: 'Circle D' },
  { name: 'Cobb tuning' },
  { name: 'CMST' },
  { name: 'CSF' },
  { name: 'DarwinPro' },
  { name: 'Deatschwerks' },
  { name: 'Dorch Engineering' },
  { name: 'Driveshaftshop' },
  { name: 'Duke Dynamics' },
  { name: 'Eterna Motorworks' },
  { name: 'Fabspeed' },
  { name: 'Fall-Line Motorsports' },
  { name: 'Fore Innovations' },
  { name: 'Fragola Performance Systems' },
  { name: 'Full-Race' },
  { name: 'Future Design' },
  { name: 'Girodisc' },
  { name: 'HRE wheels' },
  { name: 'Injector Dynamics' },
  { name: 'JXB Performance' },
  { name: 'Karbel' },
  { name: 'Killer B Motorsport' },
  { name: 'KLM Race' },
  { name: 'Kooks Headers' },
  { name: 'Lingenfelter' },
  { name: 'Mega3 Performance' },
  { name: 'Mickey Thompson' },
  { name: 'Motiv Motorsport' },
  { name: 'Moser Engineering' },
  { name: 'Mountune' },
  { name: 'MV Forged' },
  { name: 'Paragon brakes' },
  { name: 'Premier Tuning Group' },
  { name: 'Project 6GR' },
  { name: 'Pure Drivetrain Solutions' },
  { name: 'Pure Turbos' },
  { name: 'Renntech' },
  { name: 'RK Autowerks' },
  { name: 'RPM Transmissions' },
  { name: 'RKP' },
  { name: 'RYFT' },
  { name: 'Seibon' },
  { name: 'ShepTrans' },
  { name: 'Southern Hotrod' },
  { name: 'Spool Performance' },
  { name: 'SPL Parts' },
  { name: 'Strasse wheels' },
  { name: 'Stoptech' },
  { name: 'Stillen' },
  { name: 'Titan Motorsport' },
  { name: 'TireRack' },
  { name: 'Turner Motorsport' },
  { name: 'Vargas Turbo' },
  { name: 'Velos Wheels' },
  { name: 'VF Engineering' },
  { name: 'VP Racing Fuel' },
  { name: 'VR Aero' },
  { name: 'VR Bespoke' },
  { name: 'VR Forged' },
  { name: 'VR Performance' },
  { name: 'Vorsteiner' },
  { name: 'Wavetrac' },
  { name: 'Weistec Engineering' },
  { name: 'Whipple Superchargers' },
  { name: 'XDI fuel systems' },
];

export const brandsEurope: LocalBrand[] = [
  { name: '3D Design' },
  { name: 'ABT' },
  { name: 'AC Schnitzer' },
  { name: 'ADRO' },
  { name: 'Akrapovic' },
  { name: 'Alpha-N' },
  { name: 'ARMA Speed' },
  { name: 'Armytrix' },
  { name: 'Black Boost' },
  { name: 'BMC filters' },
  { name: 'Brabus' },
  { name: 'Brembo' },
  { name: 'BC Racing' },
  { name: 'Capristo' },
  { name: 'CT Carbon' },
  { name: 'Custom Cages' },
  { name: 'Dahler' },
  { name: 'DMC' },
  { name: 'do88' },
  { name: 'DTE Systems' },
  { name: 'ESS Tuning' },
  { name: 'Eventuri' },
  { name: 'FI Exhaust' },
  { name: 'GTHaus' },
  { name: 'Gruppe-M' },
  { name: 'Hamann' },
  { name: 'Hardrace' },
  { name: 'Harrop' },
  { name: 'IPe exhaust' },
  { name: 'ItalianRP' },
  { name: 'KAHN design' },
  { name: 'Karbonius' },
  { name: 'Keyvany' },
  { name: 'Kline Innovation' },
  { name: 'KW Suspension' },
  { name: 'Lamspeed' },
  { name: 'Larte Design' },
  { name: 'Liberty Walk' },
  { name: 'LOBA Motorsport' },
  { name: 'Lorinser' },
  { name: 'Lumma' },
  { name: 'Manhart' },
  { name: 'Mansory' },
  { name: 'Mamba turbo' },
  { name: "Matts Carbon" },
  { name: 'Milltek' },
  { name: 'MST Performance' },
  { name: 'Novitec' },
  { name: 'Nitron Suspension' },
  { name: 'Onyx Concept' },
  { name: 'Pagid' },
  { name: 'Power Division' },
  { name: 'ProTrack Wheels' },
  { name: 'R44 Performance' },
  { name: 'Remus' },
  { name: 'RES Exhaust' },
  { name: 'RS-R' },
  { name: 'RW Carbon' },
  { name: 'Sachs Performance' },
  { name: 'Schrick' },
  { name: 'Sterckenn' },
  { name: 'STOPART ceramic' },
  { name: 'Supersprint' },
  { name: 'Tubi Style' },
  { name: 'TTE Turbos' },
  { name: 'TTH turbos' },
  { name: 'Urban Automotive' },
  { name: 'Wagner Tuning' },
  { name: 'WALD' },
  { name: 'WheelForce' },
  { name: 'xHP' },
  { name: 'Zacoe' },
];

export const brandsOem: LocalBrand[] = [
  { name: 'Aston Martin' },
  { name: 'Ferrari' },
  { name: 'Lamborghini' },
  { name: 'Maserati' },
  { name: 'McLaren' },
  { name: 'Rolls Royce' },
];

export const brandsRacing: LocalBrand[] = [
  { name: 'AIM Sportline' },
  { name: 'ARE dry sump' },
  { name: 'Bell Intercoolers' },
  { name: 'Drenth Gearboxes' },
  { name: 'Driftworks' },
  { name: 'Extreme tyres' },
  { name: 'ISA Racing' },
  { name: 'Link ECU' },
  { name: 'Lithiumax batteries' },
  { name: 'MCA Suspension' },
  { name: 'Modena Engineering' },
  { name: 'Samsonas Motorsport' },
  { name: 'Sandtler' },
  { name: 'Summit Racing' },
  { name: 'Team Oreca' },
];

export const brandsMoto: LocalBrand[] = [
  { name: 'Accossato', description: 'High-performance braking components and controls from Italy.' },
  { name: 'AEM Factory', description: 'Premium billet aluminum parts and accessories.' },
  { name: 'AIM Tech', description: 'Data acquisition and racing dashboards.' },
  { name: 'Akrapovic', description: 'The world leader in high-performance exhaust systems.' },
  { name: 'Alpha Racing', description: 'Specialized performance parts for BMW Motorrad.' },
  { name: 'ARP Racingparts', description: 'High-quality rearsets and clip-ons for racing.' },
  { name: 'Arrow', description: 'Iconic Italian exhaust systems for road and track.' },
  { name: 'Austin Racing', description: 'Bespoke GP-style exhaust systems.' },
  { name: 'AXP', description: 'Reinforced protection for off-road and adventure bikes.' },
  { name: 'Bikesplast', description: 'Lightweight fiberglass racing fairings.' },
  { name: 'Bitubo', description: 'Advanced suspension solutions for racing and street.' },
  { name: 'Bonamici', description: 'Precision-engineered racing components and rearsets.' },
  { name: 'Brembo', description: 'The global leader in braking technology.' },
  { name: 'BT Moto', description: 'ECU flashing and performance tuning solutions.' },
  { name: 'Capit', description: 'Professional tire warmers for racing teams.' },
  { name: 'Ceracarbon', description: 'Ultra-lightweight carbon-ceramic sprockets and forks.' },
  { name: 'CNC Racing', description: 'Premium billet accessories for Ducati and MV Agusta.' },
  { name: 'Cobra Sport', description: 'Performance exhausts made in the UK.' },
  { name: 'Cordona', description: 'Precision quickshifters for racing applications.' },
  { name: 'DB-Race', description: 'Custom mirrors and billet accessories.' },
  { name: 'Dominator Exhaust', description: 'Affordable performance exhausts with aggressive sound.' },
  { name: 'Domino', description: 'World-class grips, throttles, and controls.' },
  { name: 'ECUStudio', description: 'Advanced ECU tuning software and hardware.' },
  { name: 'EVR', description: 'Slipper clutches and carbon airboxes.' },
  { name: 'Evotech', description: 'High-quality protection and accessories.' },
  { name: 'Evolution Bike', description: 'Specialized racing parts and electronics.' },
  { name: 'Febur', description: 'Racing radiators and swingarms.' },
  { name: 'FlashTune', description: 'ECU tuning interfaces for Yamaha and others.' },
  { name: 'Fullsix Carbon', description: 'Premium structural carbon fiber bodywork.' },
  { name: 'GBracing', description: 'FIM-approved engine protection covers.' },
  { name: 'Gilles Tooling', description: 'Adjustable rearsets and ergonomic parts.' },
  { name: 'GPR Stabilizer', description: 'Rotary steering stabilizers for control.' },
  { name: 'Healtech', description: 'Smart electronics and quickshifters.' },
  { name: 'HM Quickshifter', description: 'Strain gauge quickshifter technology.' },
  { name: 'HyperPro', description: 'Progressive suspension and steering dampers.' },
  { name: 'Ilmberger Carbon', description: 'TUV-certified carbon fiber parts.' },
  { name: 'IXIL', description: 'Distinctive exhaust designs from Spain.' },
  { name: 'Jetprime', description: 'Racing switch panels and throttle bodies.' },
  { name: 'Marchesini', description: 'Legendary forged magnesium and aluminum wheels.' },
  { name: 'Melotti Racing', description: 'High-quality CNC milled racing components.' },
  { name: 'New Rage Cycles', description: 'Plug-and-play fender eliminators and signals.' },
  { name: 'Ohlins', description: 'The gold standard in suspension technology.' },
  { name: 'OZ Racing', description: 'Championship-winning forged wheels.' },
  { name: 'P3 Carbon', description: 'Durable carbon fiber protection guards.' },
  { name: 'Racefoxx', description: 'Racing accessories and tire warmers.' },
  { name: 'R&G Racing', description: 'Crash protection and tail tidies.' },
  { name: 'Rizoma', description: 'Italian design meets motorcycle accessories.' },
  { name: 'Rotobox', description: 'Ultra-light carbon fiber wheels.' },
  { name: 'S2 Concept', description: 'Custom fairings and aesthetic parts.' },
  { name: 'Samco Sport', description: 'High-performance silicone radiator hoses.' },
  { name: 'SC-Project', description: 'MotoGP World Champion exhaust systems.' },
  { name: 'Sebimoto', description: 'Racing fairings and carbon parts.' },
  { name: 'SparkExhaust', description: 'High-performance Italian exhaust systems.' },
  { name: 'Sprint Filter', description: 'Polyester air filters for maximum airflow.' },
  { name: 'Starlane', description: 'GPS laptimers and quickshifters.' },
  { name: 'STM Italy', description: 'Slipper clutches and racing components.' },
  { name: 'Stompgrip', description: 'Tank grips for rider control.' },
  { name: 'Termignoni', description: 'The sound of Italian racing history.' },
  { name: 'Thermal Technology', description: 'High-end tire warmers and carbon covers.' },
  { name: 'TOCE Exhaust', description: 'Aggressive American exhaust systems.' },
  { name: 'Translogic', description: 'Quickshifters and blip-assist systems.' },
  { name: 'TSS', description: 'Slipper clutches and subframes.' },
  { name: 'TWM', description: 'Quick-action fuel caps and levers.' },
  { name: 'ValterMoto', description: 'Racing components and paddock equipment.' },
  { name: 'Vandemon', description: 'Titanium exhaust systems for premium bikes.' },
  { name: 'X-GRIP', description: 'Off-road tires and mousses.' },
  { name: 'ZARD Exhaust', description: 'Handcrafted exhausts with unique style.' },
];

export const allAutomotiveBrands: LocalBrand[] = [
  ...brandsUsa,
  ...brandsEurope,
  ...brandsOem,
  ...brandsRacing,
].sort((a, b) => a.name.localeCompare(b.name));

export const allMotoBrands: LocalBrand[] = [...brandsMoto].sort((a, b) => a.name.localeCompare(b.name));

export function getBrandsByCategory(category: BrandCategory): LocalBrand[] {
  switch (category) {
    case 'usa':
      return brandsUsa;
    case 'europe':
      return brandsEurope;
    case 'oem':
      return brandsOem;
    case 'racing':
      return brandsRacing;
    case 'moto':
      return brandsMoto;
    case 'auto':
      return allAutomotiveBrands;
  }
  // Fallback for unexpected values
  return allAutomotiveBrands;
}

export function getBrandsByNames(names: string[], category: BrandCategory = 'auto'): LocalBrand[] {
  const pool = category === 'moto' ? allMotoBrands : getBrandsByCategory(category);
  return names
    .map(name => {
      const normalized = name.trim().toLowerCase();
      return pool.find(brand => brand.name.trim().toLowerCase() === normalized);
    })
    .filter((brand): brand is LocalBrand => Boolean(brand));
}

export function getBrandMetadata(brandName: string): BrandMetadata | undefined {
  return brandMetadata[brandName];
}

export function getLocalizedCountry(country: CountryOfOrigin, locale: 'en' | 'ua'): string {
  return countryNames[country]?.[locale] || country;
}

export function getLocalizedSubcategory(subcategory: ProductSubcategory, locale: 'en' | 'ua'): string {
  return subcategoryNames[subcategory]?.[locale] || subcategory;
}

// Brand metadata mapping (country of origin and product subcategory)
export const brandMetadata: Record<string, BrandMetadata> = {
  // USA Brands
  '1221 wheels': { country: 'USA', subcategory: 'Wheels' },
  '1016 Industries': { country: 'USA', subcategory: 'Exterior' },
  '5150 Autosport': { country: 'USA', subcategory: 'Engine' },
  'AE Design': { country: 'USA', subcategory: 'Exterior' },
  'ADV.1 wheels': { country: 'USA', subcategory: 'Wheels' },
  'Agency Power': { country: 'USA', subcategory: 'Engine' },
  'Airlift Performance': { country: 'USA', subcategory: 'Suspension' },
  'AL13 wheels': { country: 'USA', subcategory: 'Wheels' },
  'AMS / Alpha Performance': { country: 'USA', subcategory: 'Engine' },
  'American Racing Headers': { country: 'USA', subcategory: 'Exhaust' },
  'ANRKY wheels': { country: 'USA', subcategory: 'Wheels' },
  'APR': { country: 'USA', subcategory: 'Engine' },
  'Avantgarde Wheels': { country: 'USA', subcategory: 'Wheels' },
  'BE bearings': { country: 'USA', subcategory: 'Drivetrain' },
  'BBi Autosport': { country: 'USA', subcategory: 'Engine' },
  'Big Boost': { country: 'USA', subcategory: 'Engine' },
  'BimmerWorld': { country: 'USA', subcategory: 'Engine' },
  'BootMod3': { country: 'USA', subcategory: 'Electronics' },
  'Borla': { country: 'USA', subcategory: 'Exhaust' },
  'Brixton wheels': { country: 'USA', subcategory: 'Wheels' },
  'Burger Motorsport': { country: 'USA', subcategory: 'Electronics' },
  'Circle D': { country: 'USA', subcategory: 'Drivetrain' },
  'Cobb tuning': { country: 'USA', subcategory: 'Electronics' },
  'CMST': { country: 'USA', subcategory: 'Exterior' },
  'CSF': { country: 'USA', subcategory: 'Cooling' },
  'DarwinPro': { country: 'USA', subcategory: 'Exterior' },
  'Deatschwerks': { country: 'USA', subcategory: 'Fuel Systems' },
  'Dorch Engineering': { country: 'USA', subcategory: 'Engine' },
  'Driveshaftshop': { country: 'USA', subcategory: 'Drivetrain' },
  'Duke Dynamics': { country: 'USA', subcategory: 'Exterior' },
  'Eterna Motorworks': { country: 'USA', subcategory: 'Engine' },
  'Fabspeed': { country: 'USA', subcategory: 'Exhaust' },
  'Fall-Line Motorsports': { country: 'USA', subcategory: 'Engine' },
  'Fore Innovations': { country: 'USA', subcategory: 'Fuel Systems' },
  'Fragola Performance Systems': { country: 'USA', subcategory: 'Fuel Systems' },
  'Full-Race': { country: 'USA', subcategory: 'Engine' },
  'Future Design': { country: 'USA', subcategory: 'Exterior' },
  'Girodisc': { country: 'USA', subcategory: 'Brakes' },
  'HRE wheels': { country: 'USA', subcategory: 'Wheels' },
  'Injector Dynamics': { country: 'USA', subcategory: 'Fuel Systems' },
  'JXB Performance': { country: 'USA', subcategory: 'Engine' },
  'Karbel': { country: 'USA', subcategory: 'Exterior' },
  'Killer B Motorsport': { country: 'USA', subcategory: 'Engine' },
  'KLM Race': { country: 'USA', subcategory: 'Engine' },
  'Kooks Headers': { country: 'USA', subcategory: 'Exhaust' },
  'Lingenfelter': { country: 'USA', subcategory: 'Engine' },
  'Mega3 Performance': { country: 'USA', subcategory: 'Engine' },
  'Mickey Thompson': { country: 'USA', subcategory: 'Wheels' },
  'Motiv Motorsport': { country: 'USA', subcategory: 'Wheels' },
  'Moser Engineering': { country: 'USA', subcategory: 'Drivetrain' },
  'Mountune': { country: 'USA', subcategory: 'Engine' },
  'MV Forged': { country: 'USA', subcategory: 'Wheels' },
  'Paragon brakes': { country: 'USA', subcategory: 'Brakes' },
  'Premier Tuning Group': { country: 'USA', subcategory: 'Engine' },
  'Project 6GR': { country: 'USA', subcategory: 'Wheels' },
  'Pure Drivetrain Solutions': { country: 'USA', subcategory: 'Drivetrain' },
  'Pure Turbos': { country: 'USA', subcategory: 'Engine' },
  'Renntech': { country: 'USA', subcategory: 'Engine' },
  'RK Autowerks': { country: 'USA', subcategory: 'Engine' },
  'RPM Transmissions': { country: 'USA', subcategory: 'Drivetrain' },
  'RKP': { country: 'USA', subcategory: 'Engine' },
  'RYFT': { country: 'USA', subcategory: 'Suspension' },
  'Seibon': { country: 'USA', subcategory: 'Exterior' },
  'ShepTrans': { country: 'USA', subcategory: 'Drivetrain' },
  'Southern Hotrod': { country: 'USA', subcategory: 'Engine' },
  'Spool Performance': { country: 'USA', subcategory: 'Drivetrain' },
  'SPL Parts': { country: 'USA', subcategory: 'Suspension' },
  'Strasse wheels': { country: 'USA', subcategory: 'Wheels' },
  'Stoptech': { country: 'USA', subcategory: 'Brakes' },
  'Stillen': { country: 'USA', subcategory: 'Engine' },
  'Titan Motorsport': { country: 'USA', subcategory: 'Engine' },
  'TireRack': { country: 'USA', subcategory: 'Wheels' },
  'Turner Motorsport': { country: 'USA', subcategory: 'Engine' },
  'Vargas Turbo': { country: 'USA', subcategory: 'Engine' },
  'Velos Wheels': { country: 'USA', subcategory: 'Wheels' },
  'VF Engineering': { country: 'USA', subcategory: 'Engine' },
  'VP Racing Fuel': { country: 'USA', subcategory: 'Fuel Systems' },
  'VR Aero': { country: 'USA', subcategory: 'Aero' },
  'VR Bespoke': { country: 'USA', subcategory: 'Exterior' },
  'VR Forged': { country: 'USA', subcategory: 'Wheels' },
  'VR Performance': { country: 'USA', subcategory: 'Engine' },
  'Vorsteiner': { country: 'USA', subcategory: 'Exterior' },
  'Wavetrac': { country: 'USA', subcategory: 'Drivetrain' },
  'Weistec Engineering': { country: 'USA', subcategory: 'Engine' },
  'Whipple Superchargers': { country: 'USA', subcategory: 'Engine' },
  'XDI fuel systems': { country: 'USA', subcategory: 'Fuel Systems' },

  // Europe Brands
  '3D Design': { country: 'Japan', subcategory: 'Exterior' },
  'ABT': { country: 'Germany', subcategory: 'Engine' },
  'AC Schnitzer': { country: 'Germany', subcategory: 'Exterior' },
  'ADRO': { country: 'USA', subcategory: 'Exterior' },
  'Akrapovic': { country: 'Slovenia', subcategory: 'Exhaust' },
  'Alpha-N': { country: 'Germany', subcategory: 'Exterior' },
  'ARMA Speed': { country: 'Taiwan', subcategory: 'Engine' },
  'Armytrix': { country: 'Taiwan', subcategory: 'Exhaust' },
  'Black Boost': { country: 'Germany', subcategory: 'Engine' },
  'BMC filters': { country: 'Italy', subcategory: 'Engine' },
  'Brabus': { country: 'Germany', subcategory: 'Full Vehicle' },
  'Brembo': { country: 'Italy', subcategory: 'Brakes' },
  'BC Racing': { country: 'Taiwan', subcategory: 'Suspension' },
  'Capristo': { country: 'Germany', subcategory: 'Exhaust' },
  'CT Carbon': { country: 'UK', subcategory: 'Exterior' },
  'Custom Cages': { country: 'UK', subcategory: 'Interior' },
  'Dahler': { country: 'Germany', subcategory: 'Engine' },
  'DMC': { country: 'Germany', subcategory: 'Exterior' },
  'do88': { country: 'Sweden', subcategory: 'Cooling' },
  'DTE Systems': { country: 'Germany', subcategory: 'Electronics' },
  'ESS Tuning': { country: 'USA', subcategory: 'Engine' },
  'Eventuri': { country: 'UK', subcategory: 'Engine' },
  'FI Exhaust': { country: 'Taiwan', subcategory: 'Exhaust' },
  'GTHaus': { country: 'USA', subcategory: 'Exhaust' },
  'Gruppe-M': { country: 'Japan', subcategory: 'Engine' },
  'Hamann': { country: 'Germany', subcategory: 'Exterior' },
  'Hardrace': { country: 'Taiwan', subcategory: 'Suspension' },
  'Harrop': { country: 'Australia', subcategory: 'Engine' },
  'IPe exhaust': { country: 'Taiwan', subcategory: 'Exhaust' },
  'ItalianRP': { country: 'Italy', subcategory: 'Engine' },
  'KAHN design': { country: 'UK', subcategory: 'Exterior' },
  'Karbonius': { country: 'Spain', subcategory: 'Exterior' },
  'Keyvany': { country: 'Germany', subcategory: 'Exterior' },
  'Kline Innovation': { country: 'Germany', subcategory: 'Exhaust' },
  'KW Suspension': { country: 'Germany', subcategory: 'Suspension' },
  'Lamspeed': { country: 'Australia', subcategory: 'Engine' },
  'Larte Design': { country: 'Germany', subcategory: 'Exterior' },
  'Liberty Walk': { country: 'Japan', subcategory: 'Exterior' },
  'LOBA Motorsport': { country: 'Germany', subcategory: 'Engine' },
  'Lorinser': { country: 'Germany', subcategory: 'Exterior' },
  'Lumma': { country: 'Germany', subcategory: 'Exterior' },
  'Manhart': { country: 'Germany', subcategory: 'Full Vehicle' },
  'Mansory': { country: 'Germany', subcategory: 'Full Vehicle' },
  'Mamba turbo': { country: 'Taiwan', subcategory: 'Engine' },
  "Matts Carbon": { country: 'UK', subcategory: 'Exterior' },
  'Milltek': { country: 'UK', subcategory: 'Exhaust' },
  'MST Performance': { country: 'Taiwan', subcategory: 'Engine' },
  'Novitec': { country: 'Germany', subcategory: 'Exterior' },
  'Nitron Suspension': { country: 'UK', subcategory: 'Suspension' },
  'Onyx Concept': { country: 'UK', subcategory: 'Exterior' },
  'Pagid': { country: 'Germany', subcategory: 'Brakes' },
  'Power Division': { country: 'Poland', subcategory: 'Engine' },
  'ProTrack Wheels': { country: 'Germany', subcategory: 'Wheels' },
  'R44 Performance': { country: 'UK', subcategory: 'Exterior' },
  'Remus': { country: 'Austria', subcategory: 'Exhaust' },
  'RES Exhaust': { country: 'China', subcategory: 'Exhaust' },
  'RS-R': { country: 'Japan', subcategory: 'Suspension' },
  'RW Carbon': { country: 'USA', subcategory: 'Exterior' },
  'Sachs Performance': { country: 'Germany', subcategory: 'Suspension' },
  'Schrick': { country: 'Germany', subcategory: 'Engine' },
  'Sterckenn': { country: 'UK', subcategory: 'Exterior' },
  'STOPART ceramic' : { country: 'Poland', subcategory: 'Brakes' },
  'Supersprint': { country: 'Italy', subcategory: 'Exhaust' },
  'Tubi Style': { country: 'Italy', subcategory: 'Exhaust' },
  'TTE Turbos': { country: 'Germany', subcategory: 'Engine' },
  'TTH turbos': { country: 'Germany', subcategory: 'Engine' },
  'Urban Automotive': { country: 'UK', subcategory: 'Exterior' },
  'Wagner Tuning': { country: 'Germany', subcategory: 'Engine' },
  'WALD': { country: 'Japan', subcategory: 'Exterior' },
  'WheelForce': { country: 'Germany', subcategory: 'Wheels' },
  'xHP': { country: 'Germany', subcategory: 'Electronics' },
  'Zacoe': { country: 'Taiwan', subcategory: 'Exterior' },

  // OEM Brands
  'Aston Martin': { country: 'UK', subcategory: 'Full Vehicle' },
  'Ferrari': { country: 'Italy', subcategory: 'Full Vehicle' },
  'Lamborghini': { country: 'Italy', subcategory: 'Full Vehicle' },
  'Maserati': { country: 'Italy', subcategory: 'Full Vehicle' },
  'McLaren': { country: 'UK', subcategory: 'Full Vehicle' },
  'Rolls Royce': { country: 'UK', subcategory: 'Full Vehicle' },

  // Racing Brands
  'AIM Sportline': { country: 'Italy', subcategory: 'Electronics' },
  'ARE dry sump': { country: 'USA', subcategory: 'Engine' },
  'Bell Intercoolers': { country: 'USA', subcategory: 'Cooling' },
  'Drenth Gearboxes': { country: 'Netherlands', subcategory: 'Drivetrain' },
  'Driftworks': { country: 'UK', subcategory: 'Suspension' },
  'Extreme tyres': { country: 'Germany', subcategory: 'Wheels' },
  'ISA Racing': { country: 'Germany', subcategory: 'Racing Components' },
  'Link ECU': { country: 'New Zealand', subcategory: 'Electronics' },
  'Lithiumax batteries': { country: 'Australia', subcategory: 'Electronics' },
  'MCA Suspension': { country: 'Australia', subcategory: 'Suspension' },
  'Modena Engineering': { country: 'Australia', subcategory: 'Drivetrain' },
  'Samsonas Motorsport': { country: 'Lithuania', subcategory: 'Drivetrain' },
  'Sandtler': { country: 'Germany', subcategory: 'Racing Components' },
  'Summit Racing': { country: 'USA', subcategory: 'Racing Components' },
  'Team Oreca': { country: 'France', subcategory: 'Racing Components' },

  // Moto Brands
  'Accossato': { country: 'Italy', subcategory: 'Brakes' },
  'AEM Factory': { country: 'Italy', subcategory: 'Racing Components' },
  'AIM Tech': { country: 'Italy', subcategory: 'Electronics' },
  'Alpha Racing': { country: 'Germany', subcategory: 'Racing Components' },
  'ARP Racingparts': { country: 'Czech Republic', subcategory: 'Racing Components' },
  'Arrow': { country: 'Italy', subcategory: 'Exhaust' },
  'Austin Racing': { country: 'UK', subcategory: 'Exhaust' },
  'AXP': { country: 'France', subcategory: 'Exterior' },
  'Bikesplast': { country: 'Czech Republic', subcategory: 'Exterior' },
  'Bitubo': { country: 'Italy', subcategory: 'Suspension' },
  'Bonamici': { country: 'Italy', subcategory: 'Racing Components' },
  'BT Moto': { country: 'USA', subcategory: 'Electronics' },
  'Capit': { country: 'Italy', subcategory: 'Racing Components' },
  'Ceracarbon': { country: 'Netherlands', subcategory: 'Drivetrain' },
  'CNC Racing': { country: 'Italy', subcategory: 'Racing Components' },
  'Cobra Sport': { country: 'UK', subcategory: 'Exhaust' },
  'Cordona': { country: 'Italy', subcategory: 'Electronics' },
  'DB-Race': { country: 'Italy', subcategory: 'Exterior' },
  'Dominator Exhaust': { country: 'Poland', subcategory: 'Exhaust' },
  'Domino': { country: 'Italy', subcategory: 'Racing Components' },
  'ECUStudio': { country: 'Italy', subcategory: 'Electronics' },
  'EVR': { country: 'Italy', subcategory: 'Drivetrain' },
  'Evotech': { country: 'UK', subcategory: 'Racing Components' },
  'Evolution Bike': { country: 'Italy', subcategory: 'Racing Components' },
  'Febur': { country: 'Italy', subcategory: 'Cooling' },
  'FlashTune': { country: 'USA', subcategory: 'Electronics' },
  'Fullsix Carbon': { country: 'Slovenia', subcategory: 'Exterior' },
  'GBracing': { country: 'UK', subcategory: 'Engine' },
  'Gilles Tooling': { country: 'Germany', subcategory: 'Racing Components' },
  'GPR Stabilizer': { country: 'USA', subcategory: 'Suspension' },
  'Healtech': { country: 'Hungary', subcategory: 'Electronics' },
  'HM Quickshifter': { country: 'UK', subcategory: 'Electronics' },
  'HyperPro': { country: 'Netherlands', subcategory: 'Suspension' },
  'Ilmberger Carbon': { country: 'Germany', subcategory: 'Exterior' },
  'IXIL': { country: 'Spain', subcategory: 'Exhaust' },
  'Jetprime': { country: 'Italy', subcategory: 'Electronics' },
  'Marchesini': { country: 'Italy', subcategory: 'Wheels' },
  'Melotti Racing': { country: 'Italy', subcategory: 'Racing Components' },
  'New Rage Cycles': { country: 'USA', subcategory: 'Exterior' },
  'Ohlins': { country: 'Sweden', subcategory: 'Suspension' },
  'OZ Racing': { country: 'Italy', subcategory: 'Wheels' },
  'P3 Carbon': { country: 'USA', subcategory: 'Exterior' },
  'Racefoxx': { country: 'Germany', subcategory: 'Racing Components' },
  'R&G Racing': { country: 'UK', subcategory: 'Racing Components' },
  'Rizoma': { country: 'Italy', subcategory: 'Racing Components' },
  'Rotobox': { country: 'Slovenia', subcategory: 'Wheels' },
  'S2 Concept': { country: 'France', subcategory: 'Exterior' },
  'Samco Sport': { country: 'UK', subcategory: 'Cooling' },
  'SC-Project': { country: 'Italy', subcategory: 'Exhaust' },
  'Sebimoto': { country: 'Czech Republic', subcategory: 'Exterior' },
  'SparkExhaust': { country: 'Italy', subcategory: 'Exhaust' },
  'Sprint Filter': { country: 'Italy', subcategory: 'Engine' },
  'Starlane': { country: 'Italy', subcategory: 'Electronics' },
  'STM Italy': { country: 'Italy', subcategory: 'Drivetrain' },
  'Stompgrip': { country: 'USA', subcategory: 'Exterior' },
  'Termignoni': { country: 'Italy', subcategory: 'Exhaust' },
  'Thermal Technology': { country: 'Italy', subcategory: 'Racing Components' },
  'TOCE Exhaust': { country: 'USA', subcategory: 'Exhaust' },
  'Translogic': { country: 'UK', subcategory: 'Electronics' },
  'TSS': { country: 'Czech Republic', subcategory: 'Drivetrain' },
  'TWM': { country: 'Italy', subcategory: 'Racing Components' },
  'ValterMoto': { country: 'Italy', subcategory: 'Racing Components' },
  'Vandemon': { country: 'Australia', subcategory: 'Exhaust' },
  'X-GRIP': { country: 'Austria', subcategory: 'Wheels' },
  'ZARD Exhaust': { country: 'Italy', subcategory: 'Exhaust' },
};
