/**
 * Download logos using Clearbit Logo API (free, no auth needed)
 * Clearbit returns PNG logos based on domain
 * Run: node scripts/download-logos-clearbit.js
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const LOGOS_DIR = path.join(__dirname, '..', 'public', 'logos');

// Auto brands with their domains (from brands.ts)
const AUTO_BRANDS = {
  // USA brands
  '1221 wheels': '1221wheels.com',
  '1016 Industries': '1016industries.com',
  '5150 Autosport': '5150autosport.com',
  'ADV.1 wheels': 'adv1wheels.com',
  'Airlift Performance': 'airliftperformance.com',
  'AL13 wheels': 'al13wheels.com',
  'AMS / Alpha Performance': 'amsperformance.com',
  'American Racing Headers': 'americanracingheaders.com',
  'ANRKY wheels': 'anrkywheels.com',
  'APR': 'goapr.com',
  'ARE dry sump': 'drysump.com',
  'Avantgarde Wheels': 'ag-wheels.com',
  'BBi Autosport': 'bbiautosport.com',
  'BE bearings': 'bebearings.com',
  'Big Boost': 'bigboost.com',
  'BimmerWorld': 'bimmerworld.com',
  'BootMod3': 'bootmod3.net',
  'Borla': 'borla.com',
  'Brixton wheels': 'brixtonforged.com',
  'Burger Motorsport': 'burgertuning.com',
  'Circle D': 'circleddynamics.com',
  'Cobb tuning': 'cobbtuning.com',
  'CSF': 'csfrace.com',
  'DarwinPro': 'darwinpro.com',
  'Deatschwerks': 'deatschwerks.com',
  'Duke Dynamics': 'dukedynamics.com',
  'Fabspeed': 'fabspeed.com',
  'Fall-Line Motorsports': 'falllinemotorsports.com',
  'Fore Innovations': 'foreinnovations.com',
  'Fragola Performance Systems': 'fragolapipe.com',
  'Full-Race': 'full-race.com',
  'Girodisc': 'girodisc.com',
  'HRE wheels': 'hrewheels.com',
  'Injector Dynamics': 'injectordynamics.com',
  'JXB Performance': 'jxbperformance.com',
  'Killer B Motorsport': 'killerbmotorsport.com',
  'KLM Race': 'klmrace.com',
  'Kooks Headers': 'kooksheaders.com',
  'Lingenfelter': 'lingenfelter.com',
  'Mickey Thompson': 'mickeythompsontires.com',
  'Moser Engineering': 'moserengineering.com',
  'Motiv Motorsport': 'motivmotorsport.com',
  'Mountune': 'mountuneusa.com',
  'MV Forged': 'mvforged.com',
  'Paragon brakes': 'paragonproductsusa.com',
  'Paramount transmissions': 'paramount-transmission.com',
  'Premier Tuning Group': 'premiertuninggroup.com',
  'Project 6GR': 'project6gr.com',
  'Pure Drivetrain Solutions': 'puredrivtrainsolutions.com',
  'Pure Turbos': 'pureturbos.com',
  'Renntech': 'renntechmercedes.com',
  'RK Autowerks': 'rkautowerks.com',
  'RPM Transmissions': 'rpmtransmissions.com',
  'RKP': 'rkpcomposites.com',
  'RW Carbon': 'rwcarbon.com',
  'RYFT': 'ryftexhaust.com',
  'Seibon Carbon': 'seibon.com',
  'ShepTrans': 'sheptrans.com',
  'Silly Rabbit Motorsport': 'sillyrabbitmotorsports.com',
  'Southern Hotrod': 'southern-hotrod.com',
  'Spool Performance': 'spoolimportperformance.com',
  'SPL Parts': 'splparts.com',
  'Strasse wheels': 'strassewheels.com',
  'Stoptech': 'stoptech.com',
  'Stillen': 'stillen.com',
  'Titan Motorsport': 'titanmotorsports.com',
  'TireRack': 'tirerack.com',
  'Turner Motorsport': 'turnermotorsport.com',
  'Vargas Turbo': 'vargasturbo.com',
  'Velos Wheels': 'velosdesignwerks.com',
  'VF Engineering': 'vf-engineering.com',
  'VP Racing Fuel': 'vpracingfuels.com',
  'Vorsteiner': 'vorsteiner.com',
  'Wavetrac': 'wavetrac.net',
  'Weistec Engineering': 'weistec.com',
  'Whipple Superchargers': 'whipplesuperchargers.com',
  'XDI fuel systems': 'xdi-pdi.com',
  // European brands
  '3D Design': '3ddesign.jp',
  'ABT': 'abt-sportsline.com',
  'AC Schnitzer': 'ac-schnitzer.de',
  'ADRO': 'adrodesigns.com',
  'Alpha-N': 'alpha-n.de',
  'ARMA Speed': 'armaspeed.com',
  'Armytrix': 'armytrix.com',
  'Black Boost': 'blackboostlab.com',
  'BMC filters': 'bmcairfilters.com',
  'Brabus': 'brabus.com',
  'BC Racing': 'bcracing.com',
  'Capristo': 'capristo.de',
  'CT Carbon': 'carbontuning.eu',
  'Dahler': 'dahler.com',
  'DMC': 'dmc-tuning.com',
  'do88': 'do88.com',
  'DTE Systems': 'dte-systems.com',
  'ESS Tuning': 'esstuning.com',
  'Eventuri': 'eventuri.net',
  'FI Exhaust': 'fi-exhaust.com',
  'Future Design': 'futuredesigncarbon.com',
  'Gemballa': 'gemballa.com',
  'G-Power': 'g-power.de',
  'GTHaus': 'gthaus.com',
  'Gruppe-M': 'gruppemdirect.com',
  'H&R': 'hrsprings.com',
  'Hamann': 'hamann-motorsport.de',
  'Hartge': 'hartge.de',
  'IPe exhaust': 'ipeexhaust.com',
  'Kelleners Sport': 'kelleners-sport.com',
  'KW': 'kwsuspensions.com',
  'Litchfield': 'litchfieldmotors.com',
  'Lorinser': 'lorinser.com',
  'Lumma': 'lumma-design.com',
  'Manhart': 'manhart-performance.de',
  'Mansory': 'mansory.com',
  'Milltek': 'millteksport.com',
  'MTM': 'mtm-online.de',
  'Novitec': 'novitecgroup.com',
  'Ohlins': 'ohlins.com',
  'Pogea Racing': 'pogea-racing.com',
  'PP Performance': 'pp-performance.de',
  'Prior Design': 'priordesign.de',
  'Recaro': 'recaro-automotive.com',
  'Remus': 'remus.eu',
  'Rotiform': 'rotiform.com',
  'RevoZport': 'revozport.com',
  'Startech': 'startech.de',
  'Sterckenn': 'sterckenn.com',
  'Supersprint': 'supersprint.com',
  'Techart': 'techart.de',
  'TTE Turbos': 'theturboengineer.com',
  'Vossen': 'vossenwheels.com',
  'Wagner Tuning': 'wagnertuning.com',
  // OEM Performance
  'Mercedes-AMG': 'mercedes-amg.com',
  'BMW M': 'bmw-m.com',
  'Audi Sport': 'audi.com',
  'Porsche Motorsport': 'porsche.com',
  'Nismo': 'nismo.co.jp',
  'Polestar': 'polestar.com',
  // Racing
  'AP Racing': 'apracing.com',
  'ARP': 'arp-bolts.com',
  'Bilstein': 'bilstein.com',
  'BBS': 'bbs.com',
  'Cosworth': 'cosworth.com',
  'CP-Carrillo': 'cp-carrillo.com',
  'Eagles Racing': 'eaglesracing.com',
  'Eibach': 'eibach.com',
  'Enkei': 'enkei.com',
  'Garrett': 'garrettmotion.com',
  'Magnaflow': 'magnaflow.com',
  'Mishimoto': 'mishimoto.com',
  'MoTec': 'motec.com.au',
  'NGK': 'ngk.com',
  'OZ Racing': 'ozracing.com',
  'Quaife': 'quaife.co.uk',
  'Rays': 'rays.co.jp',
  'Sparco': 'sparco-official.com',
  'Titan 7': 'titan7.com',
  'Weld': 'weldwheels.com',
  'Work Wheels': 'workwheels.com',
  // Additional brands
  'Flowmaster': 'flowmastermufflers.com',
  'Forge Motorsport': 'forgemotorsport.co.uk',
  'Liberty Walk': 'libertywalk.shop',
  'Rocket Bunny': 'rocket-bunny.jp',
  'Hennessey': 'hennesseyperformance.com',
  'Roush': 'roushperformance.com',
  'Shelby': 'shelby.com',
  'Saleen': 'saleen.com',
  'Dinan': 'dinancars.com',
  'Unitronic': 'getunitronic.com',
  'Accuair': 'accuair.com',
  'Tein': 'tein.com',
  'Alcon': 'alcon.co.uk',
  'Forgiato': 'forgiato.com',
  'fifteen52': 'fifteen52.com',
  'BC Forged': 'bcforged.com',
  'Ferrada': 'ferradawheels.com',
  'AWE': 'awe-tuning.com',
  'Soul Performance': 'soulpp.com',
  'Varis': 'varisna.com',
  'Vivid Racing': 'vividracing.com',
};

// Moto brands to skip
const MOTO_BRANDS = [
  'Akrapovič', 'AGV', 'Alpinestars', 'Arai', 'Arrow exhausts', 'Bell',
  'Brembo', 'Dainese', 'Gilles Tooling', 'Givi', 'HP Corse', 'Icon',
  'Klim', 'LeoVince', 'Lightech', 'Mivv', 'Öhlins', 'Pirelli Moto',
  'Pista Performance', 'Remus Moto', 'Rev\'It', 'Rizoma', 'SC-Project',
  'Scorpion', 'Sena', 'Shoei', 'SW-Motech', 'Termignoni', 'Yoshimura'
];

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[&]/g, 'and')
    .replace(/[']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    
    https.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        // Follow redirect
        downloadFile(response.headers.location, destPath)
          .then(resolve)
          .catch(reject);
        return;
      }
      
      if (response.statusCode !== 200) {
        fs.unlink(destPath, () => {});
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        // Check if file is valid (not error page)
        const stats = fs.statSync(destPath);
        if (stats.size < 500) {
          fs.unlink(destPath, () => {});
          reject(new Error('File too small'));
          return;
        }
        resolve();
      });
      
      file.on('error', (err) => {
        fs.unlink(destPath, () => {});
        reject(err);
      });
    }).on('error', (err) => {
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
}

async function downloadLogo(brandName, domain) {
  const slug = slugify(brandName);
  const destPath = path.join(LOGOS_DIR, `${slug}.png`);
  
  // Clearbit Logo API - returns 128px PNG
  const url = `https://logo.clearbit.com/${domain}?size=512`;
  
  try {
    await downloadFile(url, destPath);
    return { success: true, path: destPath };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('🚀 Starting logo download with Clearbit API...\n');
  
  // Ensure logos directory exists
  if (!fs.existsSync(LOGOS_DIR)) {
    fs.mkdirSync(LOGOS_DIR, { recursive: true });
  }
  
  const brands = Object.entries(AUTO_BRANDS);
  let success = 0;
  let failed = 0;
  const logoMap = {};
  
  // Load existing brandLogos.ts to preserve moto logos
  const brandLogosPath = path.join(__dirname, '..', 'src', 'lib', 'brandLogos.ts');
  let existingContent = '';
  try {
    existingContent = fs.readFileSync(brandLogosPath, 'utf-8');
  } catch (e) {}
  
  // Extract moto logo paths to preserve
  const motoLogoPaths = {};
  for (const motoBrand of MOTO_BRANDS) {
    const regex = new RegExp(`['"]${motoBrand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]:\\s*['"]([^'"]+)['"]`, 'i');
    const match = existingContent.match(regex);
    if (match) {
      motoLogoPaths[motoBrand] = match[1];
    }
  }
  
  console.log(`📋 Preserved ${Object.keys(motoLogoPaths).length} moto logos\n`);
  
  for (let i = 0; i < brands.length; i++) {
    const [name, domain] = brands[i];
    const slug = slugify(name);
    
    process.stdout.write(`[${i + 1}/${brands.length}] ${name}... `);
    
    // Skip moto brands
    if (MOTO_BRANDS.some(m => name.toLowerCase().includes(m.toLowerCase()))) {
      console.log('⏭️ Skipped (moto)');
      continue;
    }
    
    const result = await downloadLogo(name, domain);
    
    if (result.success) {
      console.log('✅ Downloaded');
      logoMap[name] = `/logos/${slug}.png`;
      success++;
    } else {
      console.log(`❌ ${result.error}`);
      // Keep existing logo if available
      const existingPath = path.join(LOGOS_DIR, `${slug}.png`);
      const existingSvg = path.join(LOGOS_DIR, `${slug}.svg`);
      if (fs.existsSync(existingPath)) {
        logoMap[name] = `/logos/${slug}.png`;
      } else if (fs.existsSync(existingSvg)) {
        logoMap[name] = `/logos/${slug}.svg`;
      }
      failed++;
    }
    
    // Rate limiting - be nice to Clearbit
    await sleep(200);
  }
  
  console.log('\n📊 Results:');
  console.log(`   ✅ Success: ${success}`);
  console.log(`   ❌ Failed: ${failed}`);
  
  // Merge moto logos back
  Object.assign(logoMap, motoLogoPaths);
  
  // Generate brandLogos.ts
  const sortedEntries = Object.entries(logoMap).sort((a, b) => 
    a[0].toLowerCase().localeCompare(b[0].toLowerCase())
  );
  
  const tsContent = `// Auto-generated by download-logos-clearbit.js
// Last updated: ${new Date().toISOString()}

export const BRAND_LOGO_MAP: Record<string, string> = {
${sortedEntries.map(([name, path]) => `  '${name.replace(/'/g, "\\'")}': '${path}'`).join(',\n')}
};

export function getBrandLogo(brandName: string): string {
  // Try exact match first
  if (BRAND_LOGO_MAP[brandName]) {
    return BRAND_LOGO_MAP[brandName];
  }
  
  // Try case-insensitive match
  const lowerName = brandName.toLowerCase();
  for (const [key, value] of Object.entries(BRAND_LOGO_MAP)) {
    if (key.toLowerCase() === lowerName) {
      return value;
    }
  }
  
  // Return placeholder
  return '/images/logo-placeholder.svg';
}
`;
  
  fs.writeFileSync(brandLogosPath, tsContent);
  console.log(`\n📝 Updated brandLogos.ts with ${sortedEntries.length} entries`);
}

main().catch(console.error);
