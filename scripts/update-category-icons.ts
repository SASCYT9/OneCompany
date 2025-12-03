import * as fs from 'fs';
import * as path from 'path';

const AUTO_DIR = path.join(__dirname, '../src/app/[locale]/auto/categories');
const MOTO_DIR = path.join(__dirname, '../src/app/[locale]/moto/categories');

const autoIconMappings: Record<string, Record<string, string>> = {
  cooling: {
    Thermometer: 'RadiatorIcon',
    Snowflake: 'IntercoolerIcon',
    Droplets: 'WaterPumpIcon',
    Circle: 'AirFilterIcon',
    Wind: 'TurboIcon',
    Waves: 'EngineIcon',
  },
  exterior: {
    Car: 'BodyKitIcon',
    ArrowDown: 'SpoilerIcon',
    ChevronDown: 'CarbonIcon',
    Trophy: 'WheelIcon',
    Wrench: 'BrakeDiscIcon',
    Sparkles: 'ExhaustSystemIcon',
  },
  performance: {
    Cpu: 'ECUIcon',
    Wind: 'TurboIcon',
    Zap: 'EngineIcon',
    Wrench: 'IntercoolerIcon',
    Fuel: 'ExhaustSystemIcon',
    BarChart3: 'AirFilterIcon',
  },
};

const motoIconMappings: Record<string, Record<string, string>> = {
  'moto-exhaust': {
    Trophy: 'ExhaustSystemIcon',
    Wrench: 'MufflerIcon',
    Flame: 'TurboIcon',
    Circle: 'CatIcon',
    CheckCircle: 'EngineIcon',
    Flag: 'SpoilerIcon',
  },
  'moto-electronics': {
    BarChart3: 'ECUIcon',
    Settings: 'IntercoolerIcon',
    Zap: 'TurboIcon',
    Smartphone: 'WaterPumpIcon',
    Target: 'EngineIcon',
    Cable: 'ExhaustSystemIcon',
  },
  'moto-suspension': {
    Wrench: 'ShockAbsorberIcon',
    Cog: 'CoiloverIcon',
    Trophy: 'BrakeDiscIcon',
    Target: 'WheelIcon',
    ArrowUpDown: 'TireIcon',
    Microscope: 'SwaybарIcon',
  },
  'moto-wheels': {
    Circle: 'WheelIcon',
    Diamond: 'TireIcon',
    Wrench: 'BrakeDiscIcon',
    RotateCcw: 'CaliperIcon',
    Cog: 'CoiloverIcon',
    Link2: 'SpoilerIcon',
  },
  'moto-carbon': {
    Bike: 'CarbonIcon',
    Shield: 'AlcantaraIcon',
    Wrench: 'SteeringWheelIcon',
    Cog: 'LeatherIcon',
    Link2: 'SeatIcon',
    Flame: 'RollCageIcon',
  },
  'moto-controls': {
    Footprints: 'TireIcon',
    Bike: 'WheelIcon',
    Hand: 'SteeringWheelIcon',
    Zap: 'ECUIcon',
    Wrench: 'SeatIcon',
    Cog: 'CaliperIcon',
  },
};

function updateCategoryFile(baseDir: string, categoryName: string, iconMap: Record<string, string>) {
  const filePath = path.join(baseDir, categoryName, 'page.tsx');
  
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  File not found: ${filePath}`);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf-8');

  // Replace import statement
  const lucideImportRegex = /import \{ [^}]+ \} from 'lucide-react';/;
  const customIcons = Array.from(new Set(Object.values(iconMap))).join(', ');
  const newImport = `import { ${customIcons} } from '@/components/icons/CategoryIcons';`;
  
  content = content.replace(lucideImportRegex, newImport);

  // Replace icon references in types array
  Object.entries(iconMap).forEach(([oldIcon, newIcon]) => {
    const iconRegex = new RegExp(`icon:\\s*${oldIcon},`, 'g');
    content = content.replace(iconRegex, `icon: ${newIcon},`);
  });

  fs.writeFileSync(filePath, content, 'utf-8');
  console.log(`✅ Updated ${categoryName}/page.tsx`);
}

console.log('🔄 Updating AUTO category icons...\n');
Object.entries(autoIconMappings).forEach(([category, iconMap]) => {
  updateCategoryFile(AUTO_DIR, category, iconMap);
});

console.log('\n🏍️  Updating MOTO category icons...\n');
Object.entries(motoIconMappings).forEach(([category, iconMap]) => {
  updateCategoryFile(MOTO_DIR, category, iconMap);
});

console.log('\n✨ Done!');
