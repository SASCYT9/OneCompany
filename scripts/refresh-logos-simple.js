/**
 * Simple Logo Refresh Script
 * Downloads official logos for automotive brands
 * Run with: node scripts/refresh-logos-simple.js
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const LOGO_DIR = path.join(process.cwd(), 'public', 'logos');

// Auto brands with their official domains (extracted from brands.ts)
const AUTO_BRANDS = [
  { name: '1221 wheels', domain: '1221wheels.com' },
  { name: '1016 Industries', domain: '1016industries.com' },
  { name: '5150 Autosport', domain: '5150autosport.com' },
  { name: 'ADV.1 wheels', domain: 'adv1wheels.com' },
  { name: 'Airlift Performance', domain: 'airliftperformance.com' },
  { name: 'AL13 wheels', domain: 'al13wheels.com' },
  { name: 'AMS / Alpha Performance', domain: 'amsperformance.com' },
  { name: 'American Racing Headers', domain: 'americanracingheaders.com' },
  { name: 'ANRKY wheels', domain: 'anrkywheels.com' },
  { name: 'APR', domain: 'goapr.com' },
  { name: 'Avantgarde Wheels', domain: 'avantgardewheels.com' },
  { name: 'BE bearings', domain: 'bebearings.com' },
  { name: 'BBi Autosport', domain: 'bbiautosport.com' },
  { name: 'Big Boost', domain: 'bigboostllc.com' },
  { name: 'BimmerWorld', domain: 'bimmerworld.com' },
  { name: 'BootMod3', domain: 'bootmod3.net' },
  { name: 'Borla', domain: 'borla.com' },
  { name: 'Brixton wheels', domain: 'brixtonforged.com' },
  { name: 'Burger Motorsport', domain: 'burgertuning.com' },
  { name: 'Circle D', domain: 'circledspecialties.com' },
  { name: 'Cobb tuning', domain: 'cobbtuning.com' },
  { name: 'CSF', domain: 'csfrace.com' },
  { name: 'DarwinPro', domain: 'darwinproaero.com' },
  { name: 'Deatschwerks', domain: 'deatschwerks.com' },
  { name: 'Dorch Engineering', domain: 'dorchengineering.com' },
  { name: 'Duke Dynamics', domain: 'dukedynamics.com' },
  { name: 'Eterna Motorworks', domain: 'eternamotorworks.com' },
  { name: 'Fabspeed', domain: 'fabspeed.com' },
  { name: 'Fall-Line Motorsports', domain: 'fall-linemotorsports.com' },
  { name: 'Fore Innovations', domain: 'foreinnovations.com' },
  { name: 'Fragola Performance Systems', domain: 'fragolaperformance.com' },
  { name: 'Full-Race', domain: 'full-race.com' },
  { name: 'Girodisc', domain: 'girodisc.com' },
  { name: 'GTHaus', domain: 'gthaus.com' },
  { name: 'HRE wheels', domain: 'hrewheels.com' },
  { name: 'Injector Dynamics', domain: 'injectordynamics.com' },
  { name: 'JXB Performance', domain: 'jxbperformance.com' },
  { name: 'Killer B Motorsport', domain: 'killerbmotorsport.com' },
  { name: 'KLM Race', domain: 'klmrace.com' },
  { name: 'Kooks Headers', domain: 'kooksheaders.com' },
  { name: 'Lingenfelter', domain: 'lingenfelter.com' },
  { name: 'Mickey Thompson', domain: 'mickeythompsontires.com' },
  { name: 'Motiv Motorsport', domain: 'motivmotorsport.com' },
  { name: 'Moser Engineering', domain: 'moserengineering.com' },
  { name: 'Mountune', domain: 'mountune.com' },
  { name: 'MV Forged', domain: 'mvforged.com' },
  { name: 'Paragon brakes', domain: 'paragonperformancebrakes.com' },
  { name: 'Paramount transmissions', domain: 'paramountperformanceproducts.com' },
  { name: 'Premier Tuning Group', domain: 'premiertuninggroup.com' },
  { name: 'Project 6GR', domain: 'project6gr.com' },
  { name: 'Pure Drivetrain Solutions', domain: 'puredrivetrain.com' },
  { name: 'Pure Turbos', domain: 'pureturbos.com' },
  { name: 'Renntech', domain: 'renntechmercedes.com' },
  { name: 'RK Autowerks', domain: 'rkautowerks.com' },
  { name: 'RPM Transmissions', domain: 'rpmtransmissions.com' },
  { name: 'RKP', domain: 'rkpcomposites.com' },
  { name: 'RW Carbon', domain: 'rwcarbon.com' },
  { name: 'RYFT', domain: 'ryft.co' },
  { name: 'Seibon Carbon', domain: 'seibon.com' },
  { name: 'ShepTrans', domain: 'sheptrans.com' },
  { name: 'Silly Rabbit Motorsport', domain: 'sillyrabbitmotorsport.com' },
  { name: 'Southern Hotrod', domain: 'southernhotrod.com' },
  { name: 'Spool Performance', domain: 'spoolperformance.com' },
  { name: 'SPL Parts', domain: 'splparts.com' },
  { name: 'Strasse wheels', domain: 'strassewheels.com' },
  { name: 'Stoptech', domain: 'stoptech.com' },
  { name: 'Stillen', domain: 'stillen.com' },
  { name: 'Titan Motorsport', domain: 'titanmotorsports.com' },
  { name: 'TireRack', domain: 'tirerack.com' },
  { name: 'Turner Motorsport', domain: 'turnermotorsport.com' },
  { name: 'Vargas Turbo', domain: 'vargasturbo.com' },
  { name: 'Velos Wheels', domain: 'velosdesignwerks.com' },
  { name: 'VF Engineering', domain: 'vfengineering.com' },
  { name: 'VP Racing Fuel', domain: 'vpracingfuels.com' },
  { name: 'Vorsteiner', domain: 'vorsteiner.com' },
  { name: 'Wavetrac', domain: 'wavetrac.net' },
  { name: 'Weistec Engineering', domain: 'weistec.com' },
  { name: 'Whipple Superchargers', domain: 'whipplesuperchargers.com' },
  { name: 'XDI fuel systems', domain: 'xtreme-di.com' },
  // Europe brands
  { name: '3D Design', domain: '3ddesign.jp' },
  { name: 'ABT', domain: 'abt-sportsline.com' },
  { name: 'AC Schnitzer', domain: 'ac-schnitzer.de' },
  { name: 'ADRO', domain: 'adro.com' },
  { name: 'Akrapovic', domain: 'akrapovic.com' },
  { name: 'Alpha-N', domain: 'alpha-n.de' },
  { name: 'ARMA Speed', domain: 'armaspeed.com' },
  { name: 'Armytrix', domain: 'armytrix.com' },
  { name: 'Black Boost', domain: 'blackboost.ae' },
  { name: 'BMC filters', domain: 'bmcairfilters.com' },
  { name: 'Brabus', domain: 'brabus.com' },
  { name: 'Brembo', domain: 'brembo.com' },
  { name: 'BC Racing', domain: 'bcracing-na.com' },
  { name: 'Capristo', domain: 'capristo.de' },
  { name: 'CT Carbon', domain: 'ct-carbon.co.uk' },
  { name: 'Dahler', domain: 'dahler.com' },
  { name: 'DMC', domain: 'dmc.ag' },
  { name: 'do88', domain: 'do88.se' },
  { name: 'DTE Systems', domain: 'dte-systems.com' },
  { name: 'ESS Tuning', domain: 'esstuning.com' },
  { name: 'Eventuri', domain: 'eventuri.net' },
  { name: 'FI Exhaust', domain: 'fi-exhaust.com' },
  { name: 'Gruppe-M', domain: 'gruppem.co.jp' },
  { name: 'Hamann', domain: 'hamann-motorsport.de' },
  { name: 'Heico', domain: 'heicosportiv.de' },
  { name: 'Hardrace', domain: 'hardrace.com' },
  { name: 'Harrop', domain: 'harrop.com.au' },
  { name: 'iPE exhaust', domain: 'ipe-innotech.com' },
  { name: 'KAHN design', domain: 'kahndesign.com' },
  { name: 'Karbonius', domain: 'karbonius.net' },
  { name: 'Keyvany', domain: 'keyvany.com' },
  { name: 'Kline Innovation', domain: 'klineinnovation.com' },
  { name: 'KW Suspension', domain: 'kwsuspensions.com' },
  { name: 'Lamspeed', domain: 'lamspeed.com.au' },
  { name: 'Larte Design', domain: 'larte-design.com' },
  { name: 'Liberty Walk', domain: 'libertywalk.co.jp' },
  { name: 'LOBA Motorsport', domain: 'loba-motorsport.com' },
  { name: 'Lorinser', domain: 'lorinser.com' },
  { name: 'Lumma', domain: 'lumma-design.com' },
  { name: 'Manhart', domain: 'manhart-performance.de' },
  { name: 'Mansory', domain: 'mansory.com' },
  { name: 'Mamba turbo', domain: 'mambaturbo.com' },
  { name: "Matt's carbon", domain: 'mattscarbon.com' },
  { name: 'Milltek', domain: 'millteksport.com' },
  { name: 'MST Performance', domain: 'mst-performance.com' },
  { name: 'Novitec', domain: 'novitecgroup.com' },
  { name: 'Nitron Suspension', domain: 'nitron.co.uk' },
  { name: 'ONE COMPANY forged', domain: 'one-company.com.ua' },
  { name: 'Onyx Concept', domain: 'onyxconcept.com' },
  { name: 'Power Division', domain: 'power-division.pl' },
  { name: 'ProTrack Wheels', domain: 'protrackwheels.de' },
  { name: 'Pulsar turbo', domain: 'pulsarturbo.com' },
  { name: 'R44 Performance', domain: 'r44performance.com' },
  { name: 'Remus', domain: 'remus.eu' },
  { name: 'RES Exhaust', domain: 'resexhaust.com' },
  { name: 'RS-R', domain: 'rs-r.com' },
  { name: 'Sachs Performance', domain: 'sachsperformance.com' },
  { name: 'Schrick', domain: 'schrick.com' },
  { name: 'Sterckenn', domain: 'sterckenn.com' },
  { name: 'Supersprint', domain: 'supersprint.com' },
  { name: 'Tubi Style', domain: 'tubistyle.it' },
  { name: 'TTE Turbos', domain: 'theturboengineers.com' },
  { name: 'TTH turbos', domain: 'tth-turbo.de' },
  { name: 'Urban Automotive', domain: 'urbanautomotive.co.uk' },
  { name: 'Wagner Tuning', domain: 'wagner-tuning.com' },
  { name: 'WALD', domain: 'wald.co.jp' },
  { name: 'WheelForce', domain: 'wheelforce.de' },
  { name: 'Zacoe', domain: 'zacoe.com' },
  // OEM
  { name: 'Aston Martin', domain: 'astonmartin.com' },
  { name: 'Ferrari', domain: 'ferrari.com' },
  { name: 'Lamborghini', domain: 'lamborghini.com' },
  { name: 'Maserati', domain: 'maserati.com' },
  { name: 'McLaren', domain: 'mclaren.com' },
  { name: 'Rolls Royce', domain: 'rolls-roycemotorcars.com' },
  // Racing
  { name: 'AIM Sportline', domain: 'aim-sportline.com' },
  { name: 'ARE dry sump', domain: 'drysump.com' },
  { name: 'Bell Intercoolers', domain: 'bellintercoolers.com' },
  { name: 'Drenth Gearboxes', domain: 'drenth.nl' },
  { name: 'Extreme tyres', domain: 'extreme-tyres.com' },
  { name: 'Link ECU', domain: 'linkecu.com' },
  { name: 'Lithiumax batteries', domain: 'lithiumax.com.au' },
  { name: 'MCA Suspension', domain: 'mcasuspension.com' },
  { name: 'Samsonas Motorsport', domain: 'samsonas.com' },
];

// Moto brands to skip (preserve existing)
const MOTO_BRANDS = [
  'Accossato', 'AEM Factory', 'AIM Tech', 'Akrapovic', 'Alpha Racing', 'ARP Racingparts',
  'Arrow', 'Austin Racing', 'AXP', 'Bikesplast', 'Bitubo', 'Bonamici', 'Brembo', 'BT Moto',
  'Capit', 'Ceracarbon', 'CNC Racing', 'Cobra Sport', 'Cordona', 'DB-Race', 'Dominator Exhaust',
  'Domino', 'ECUStudio', 'EVR', 'Evotech', 'Evolution Bike', 'Febur', 'FlashTune',
  'Fullsix Carbon', 'GBracing', 'Gilles Tooling', 'GPR Stabilizer', 'Healtech', 'HM Quickshifter',
  'HyperPro', 'Ilmberger Carbon', 'IXIL', 'Jetprime', 'Marchesini', 'Melotti Racing',
  'New Rage Cycles', 'Ohlins', 'OZ Racing', 'P3 Carbon', 'Racefoxx', 'R&G Racing', 'Rizoma',
  'Rotobox', 'S2 Concept', 'Samco Sport', 'SC-Project', 'Sebimoto', 'SparkExhaust',
  'Sprint Filter', 'Starlane', 'STM Italy', 'Stompgrip', 'Termignoni', 'Thermal Technology',
  'TOCE Exhaust', 'Translogic', 'TSS', 'TWM', 'ValterMoto', 'Vandemon', 'X-GRIP', 'ZARD Exhaust'
];

const slugify = (text) => {
  return text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w\-]+/g, '').replace(/\-\-+/g, '-').replace(/^-+/, '').replace(/-+$/, '');
};

const downloadFile = (url, dest) => {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const timeout = setTimeout(() => {
      reject(new Error('Timeout'));
    }, 10000);
    
    const req = protocol.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
      }
    }, (res) => {
      clearTimeout(timeout);
      
      if (res.statusCode === 301 || res.statusCode === 302) {
        downloadFile(res.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        if (buffer.length > 200) {
          fs.writeFileSync(dest, buffer);
          resolve(buffer.length);
        } else {
          reject(new Error('File too small'));
        }
      });
      res.on('error', reject);
    });
    
    req.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
};

const downloadLogo = async (brand) => {
  const slug = slugify(brand.name);
  const domain = brand.domain;
  
  // Try Logo.dev PNG (most reliable)
  const sources = [
    { url: `https://img.logo.dev/${domain}?token=pk_X-FqniF5QEWLDfaalwQ0mA&format=png&size=400`, ext: '.png' },
    { url: `https://logo.clearbit.com/${domain}`, ext: '.png' },
  ];
  
  for (const source of sources) {
    const dest = path.join(LOGO_DIR, `${slug}${source.ext}`);
    try {
      const size = await downloadFile(source.url, dest);
      return { path: `/logos/${slug}${source.ext}`, size };
    } catch (e) {
      // Try next source
    }
  }
  
  return null;
};

const delay = (ms) => new Promise(r => setTimeout(r, ms));

const main = async () => {
  console.log('🚀 Starting logo download...\n');
  
  if (!fs.existsSync(LOGO_DIR)) {
    fs.mkdirSync(LOGO_DIR, { recursive: true });
  }
  
  const logoMap = {};
  let success = 0, failed = 0;
  
  // Read existing brandLogos.ts to preserve moto entries
  const existingContent = fs.readFileSync(path.join(process.cwd(), 'src', 'lib', 'brandLogos.ts'), 'utf-8');
  const motoSet = new Set(MOTO_BRANDS.map(b => b.toLowerCase()));
  
  // Extract existing moto logos
  const regex = /'([^']+)':\s*'([^']+)'/g;
  let match;
  while ((match = regex.exec(existingContent)) !== null) {
    if (motoSet.has(match[1].toLowerCase())) {
      logoMap[match[1]] = match[2];
    }
  }
  
  console.log(`📋 Preserved ${Object.keys(logoMap).length} moto logos\n`);
  
  for (let i = 0; i < AUTO_BRANDS.length; i++) {
    const brand = AUTO_BRANDS[i];
    
    // Skip if it's also a moto brand
    if (motoSet.has(brand.name.toLowerCase())) {
      console.log(`[${i+1}/${AUTO_BRANDS.length}] ${brand.name} - Skipped (moto)`);
      continue;
    }
    
    console.log(`[${i+1}/${AUTO_BRANDS.length}] ${brand.name}...`);
    
    const result = await downloadLogo(brand);
    
    if (result) {
      logoMap[brand.name] = result.path;
      console.log(`  ✅ Downloaded (${result.size} bytes)`);
      success++;
    } else {
      // Keep existing path
      logoMap[brand.name] = `/logos/${slugify(brand.name)}.png`;
      console.log(`  ❌ Failed, keeping existing`);
      failed++;
    }
    
    await delay(500);
  }
  
  // Generate new brandLogos.ts
  console.log('\n📝 Generating brandLogos.ts...');
  
  let content = `// This file is auto-generated by scripts/refresh-logos-simple.js\n\n`;
  content += `export const BRAND_LOGO_MAP: Record<string, string> = {\n`;
  
  const sorted = Object.entries(logoMap).sort((a, b) => a[0].localeCompare(b[0]));
  for (const [name, logoPath] of sorted) {
    content += `  '${name.replace(/'/g, "\\'")}': '${logoPath}',\n`;
  }
  
  content += `};\n\n`;
  content += `const NORMALIZED_BRAND_LOGO_MAP: Record<string, string> = Object.fromEntries(\n`;
  content += `  Object.entries(BRAND_LOGO_MAP).map(([key, value]) => [key.toLowerCase(), value])\n`;
  content += `);\n\n`;
  content += `export const getBrandLogo = (brandName: string): string => {\n`;
  content += `  if (!brandName) {\n`;
  content += `    return '/logos/placeholder.svg';\n`;
  content += `  }\n\n`;
  content += `  const normalizedName = brandName.trim().toLowerCase();\n`;
  content += `  return (\n`;
  content += `    BRAND_LOGO_MAP[brandName] ||\n`;
  content += `    NORMALIZED_BRAND_LOGO_MAP[normalizedName] ||\n`;
  content += `    '/logos/placeholder.svg'\n`;
  content += `  );\n`;
  content += `};\n`;
  
  fs.writeFileSync(path.join(process.cwd(), 'src', 'lib', 'brandLogos.ts'), content);
  
  console.log('\n' + '='.repeat(40));
  console.log(`✅ Success: ${success}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`🏍️ Moto preserved: ${MOTO_BRANDS.length}`);
  console.log('='.repeat(40));
  console.log('\n✨ Done!');
};

main().catch(console.error);
