const fs = require('fs');
const path = require('path');

const logosDir = path.join(__dirname, '../public/logos');
const outputFile = path.join(__dirname, '../src/lib/brandLogos.ts');

// Read all logo files
const logoFiles = fs.readdirSync(logosDir)
  .filter(file => file !== 'placeholder.svg')
  .sort();

console.log(`Found ${logoFiles.length} logo files`);

// Create brand name from filename
function filenameToBrandName(filename) {
  const nameWithoutExt = filename.replace(/\.(png|svg|jpg|jpeg|webp)$/i, '');
  
  // Special cases mapping
  const specialCases = {
    'akrapovic': 'Akrapovic',
    'sc-project': 'SC-Project',
    'rizoma': 'Rizoma',
    'brembo': 'Brembo',
    'arrow': 'Arrow',
    'termignoni': 'Termignoni',
    'yoshimura': 'Yoshimura',
    'scorpion': 'Scorpion',
    'alpha-racing': 'Alpha Racing',
    'cnc-racing': 'CNC Racing',
    'kw-suspension': 'KW Suspension',
    'fi-exhaust': 'FI Exhaust',
    'eventuri': 'Eventuri',
    'bbs': 'BBS',
    'ohlins': 'Ohlins',
    'rotiform': 'Rotiform',
    'vossen': 'Vossen',
    'hre-wheels': 'HRE Wheels',
    'mansory': 'Mansory',
    'liberty-walk': 'Liberty Walk',
    'vorsteiner': 'Vorsteiner',
    'urban-automotive': 'Urban Automotive',
    'milltek': 'Milltek',
    'remus': 'Remus',
    'ipe-exhaust': 'IPE Exhaust',
    'capristo': 'Capristo',
    'armytrix': 'Armytrix',
    'givi': 'Givi',
    'arai': 'Arai',
    'shoei': 'Shoei',
    'dainese': 'Dainese',
    'alpinestars': 'Alpinestars',
    'recaro': 'Recaro',
    'forge-motorsport': 'Forge Motorsport',
    'h-r': 'H&R',
    'bc-racing': 'BC Racing',
    'mca-suspension': 'MCA Suspension',
    'nitron-suspension': 'Nitron Suspension',
    'hyperpro': 'HyperPro',
    'bitubo-suspension': 'Bitubo Suspension',
    'rotobox': 'Rotobox',
    'ilmberger-carbon': 'Ilmberger Carbon',
    'austin-racing': 'Austin Racing',
    'evotech': 'Evotech Performance',
    'gbracing': 'GB Racing',
    'domino': 'Domino',
    'bonamici': 'Bonamici Racing',
    'valtermoto': 'Valtermoto',
    'gilles-tooling': 'Gilles Tooling',
    'stompgrip': 'Stompgrip',
    'evr': 'EVR',
    'febur': 'Febur',
    'new-rage-cycles': 'New Rage Cycles',
    'red-star-exhaust': 'Red Star Exhaust',
    'vandemon': 'Vandemon',
    'starlane': 'Starlane',
    'healtech': 'Healtech',
    'jetprime': 'Jetprime',
    'hm-quickshifter': 'HM Quickshifter',
    'gpr-stabilizer': 'GPR Stabilizer',
    'flashtune': 'FlashTune',
    'evolution-bike': 'Evolution Bike',
    'crc-fairings': 'CRC Fairings',
    'bikesplast': 'Bikesplast',
    'wrs': 'WRS',
    'dbholders': 'DBHolders',
    'stm-italy': 'STM Italy',
    'accossato': 'Accossato',
    'aem-factory': 'AEM Factory',
    'brabus': 'Brabus',
    'novitec': 'Novitec',
    'hamann': 'Hamann',
    'manhart': 'Manhart',
    'lumma': 'Lumma Design',
    'ac-schnitzer': 'AC Schnitzer',
    'dmc': 'DMC',
    'larte-design': 'Larte Design',
    'topcar-design': 'TopCar Design',
    'renegade-design': 'Renegade Design',
    'keyvany': 'Keyvany',
    'kahn-design': 'Kahn Design',
    'duke-dynamics': 'Duke Dynamics',
    'onyx-concept': 'Onyx Concept',
    'adro': 'ADRO',
    'cmst': 'CMST',
    'zacoe': 'Zacoe',
    'darwinpro': 'DarwinPRO',
    'future-design': 'Future Design',
    'wald': 'Wald International',
    'renntech': 'RENNtech',
    'lorinser': 'Lorinser',
    'carlsson': 'Carlsson',
    'techart': 'TechArt',
    'gemballa': 'Gemballa',
    '3d-design': '3D Design',
    'abt': 'ABT Sportsline',
    'apr': 'APR',
    'cobb-tuning': 'Cobb Tuning',
    'bootmod3': 'BootMod3',
    'burger-motorsport': 'Burger Motorsport',
    'ess-tuning': 'ESS Tuning',
    'vf-engineering': 'VF Engineering',
    'weistec-engineering': 'Weistec Engineering',
    'mountune': 'Mountune',
    'rw-carbon': 'RW Carbon',
    'seibon': 'Seibon Carbon',
    'csf': 'CSF Radiators',
    'do88': 'do88',
    'wagner-tuning': 'Wagner Tuning',
    'gruppe-m': 'Gruppe M',
    'agency-power': 'Agency Power',
    'fabspeed': 'Fabspeed Motorsport',
    'supersprint': 'Supersprint',
    'borla': 'Borla',
    'tubi-style': 'Tubi Style',
    'larini': 'Larini Systems',
    'kooks-headers': 'Kooks Headers',
    'american-racing-headers': 'American Racing Headers',
    'bbi-autosport': 'BBi Autosport',
    'kline-innovation': 'Kline Innovation',
    'quicksilver': 'QuickSilver Exhausts',
    'gthaus': 'GTHAUS',
    'res-exhaust': 'RES Exhaust',
    'fi': 'Fi Exhaust',
    'stoptech': 'StopTech',
    'girodisc': 'Girodisc',
    'essex': 'Essex Designed',
    'endless': 'Endless',
    'carbotech': 'Carbotech',
    'paragon-brakes': 'Paragon Performance',
    'airlift-performance': 'Air Lift Performance',
    'hardrace': 'Hardrace',
    'spulen': 'Spulen',
    'strasse-wheels': 'Strasse Wheels',
    'adv1-wheels': 'ADV.1 Wheels',
    'brixton-wheels': 'Brixton Forged',
    'velos-wheels': 'Velos Designwerks',
    'project-6gr': 'Project 6GR',
    'anrky-wheels': 'ANRKY Wheels',
    'rotifor': 'Rotiform',
    'al13-wheels': 'AL13 Wheels',
    'protrack-wheels': 'ProTrack',
    'mv-forged': 'MV Forged',
    'vr-forged': 'VR Forged',
    'raliw-forged': 'Raliw Forged',
    '1221-wheels': '1221 Wheels',
    'avantgarde-wheels': 'Avantgarde',
    'wheelforce': 'WheelForce',
  };
  
  // Check special cases first
  if (specialCases[nameWithoutExt]) {
    return specialCases[nameWithoutExt];
  }
  
  // Default: capitalize each word
  return nameWithoutExt
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Generate the map
const brandLogoMap = {};
logoFiles.forEach(file => {
  const brandName = filenameToBrandName(file);
  brandLogoMap[brandName] = `/logos/${file}`;
});

// Generate TypeScript file content
const tsContent = `// Auto-generated by scripts/update-brand-logos.js
// Run: node scripts/update-brand-logos.js

export const BRAND_LOGO_MAP: Record<string, string> = ${JSON.stringify(brandLogoMap, null, 2)};

const NORMALIZED_BRAND_LOGO_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(BRAND_LOGO_MAP).map(([key, value]) => [key.toLowerCase(), value])
);

export const getBrandLogo = (brandName: string): string => {
  if (!brandName) {
    return '/logos/placeholder.svg';
  }

  const normalizedName = brandName.trim().toLowerCase();
  return (
    BRAND_LOGO_MAP[brandName] ||
    NORMALIZED_BRAND_LOGO_MAP[normalizedName] ||
    '/logos/placeholder.svg'
  );
};
`;

// Write to file
fs.writeFileSync(outputFile, tsContent, 'utf8');

console.log(`✅ Generated ${Object.keys(brandLogoMap).length} brand logo mappings`);
console.log(`📝 Updated: ${outputFile}`);

// Print some examples
console.log('\n📋 Sample mappings:');
Object.entries(brandLogoMap).slice(0, 10).forEach(([brand, path]) => {
  console.log(`  "${brand}" => "${path}"`);
});
