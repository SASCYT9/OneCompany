import { NextRequest, NextResponse } from 'next/server';
import { getTurn14AccessToken } from '@/lib/turn14';

const TURN14_API_BASE = 'https://api.turn14.com/v1';

/**
 * GET /api/shop/turn14/fitment
 * 
 * Cascading vehicle fitment lookup:
 * - No params → returns years list (1990–current+1)
 * - ?year=2021 → returns makes for that year
 * - ?year=2021&make=BMW → returns models
 * - ?year=2021&make=BMW&model=M3 → returns submodels/engines
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');
    const make = searchParams.get('make');
    const model = searchParams.get('model');

    // Level 0: Return years
    if (!year) {
      const currentYear = new Date().getFullYear() + 1;
      const years = Array.from({ length: currentYear - 1990 + 1 }, (_, i) => (currentYear - i).toString());
      return NextResponse.json({ type: 'years', data: years });
    }

    const token = await getTurn14AccessToken();

    // Level 1: Year → Makes
    if (year && !make) {
      // Try Turn14 fitment endpoint for makes
      const res = await fetch(`${TURN14_API_BASE}/items?year=${year}&page=1`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      
      if (res.ok) {
        const data = await res.json();
        const items = data.data || [];
        // Extract unique brands/makes from item attributes
        const makesSet = new Set<string>();
        for (const item of items) {
          const attrs = item.attributes || {};
          if (attrs.vehicle_make) makesSet.add(attrs.vehicle_make);
        }

        // If the fitment data is sparse, supplement with common makes
        const COMMON_MAKES = [
          'Acura', 'Alfa Romeo', 'Audi', 'BMW', 'Buick', 'Cadillac',
          'Chevrolet', 'Chrysler', 'Dodge', 'Ferrari', 'Fiat', 'Ford',
          'Genesis', 'GMC', 'Honda', 'Hyundai', 'Infiniti', 'Jaguar',
          'Jeep', 'Kia', 'Lamborghini', 'Land Rover', 'Lexus', 'Lincoln',
          'Maserati', 'Mazda', 'McLaren', 'Mercedes-Benz', 'Mini',
          'Mitsubishi', 'Nissan', 'Porsche', 'Ram', 'Rolls-Royce',
          'Subaru', 'Tesla', 'Toyota', 'Volkswagen', 'Volvo'
        ];

        const allMakes = [...new Set([...makesSet, ...COMMON_MAKES])].sort();
        return NextResponse.json({ type: 'makes', year, data: allMakes });
      }

      // Fallback
      return NextResponse.json({ type: 'makes', year, data: COMMON_MAKES_FALLBACK });
    }

    // Level 2: Year + Make → Models
    if (year && make && !model) {
      const res = await fetch(
        `${TURN14_API_BASE}/items?year=${year}&make=${encodeURIComponent(make)}&page=1`,
        { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }
      );

      if (res.ok) {
        const data = await res.json();
        const items = data.data || [];
        const modelsSet = new Set<string>();
        for (const item of items) {
          const attrs = item.attributes || {};
          if (attrs.vehicle_model) modelsSet.add(attrs.vehicle_model);
        }

        // Supplement with known models for popular makes
        const knownModels = KNOWN_MODELS_BY_MAKE[make] || [];
        const allModels = [...new Set([...modelsSet, ...knownModels])].sort();
        return NextResponse.json({ type: 'models', year, make, data: allModels });
      }

      return NextResponse.json({ type: 'models', year, make, data: KNOWN_MODELS_BY_MAKE[make] || [] });
    }

    // Level 3: Year + Make + Model → Submodels / Engines
    if (year && make && model) {
      const res = await fetch(
        `${TURN14_API_BASE}/items?year=${year}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&page=1`,
        { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }
      );

      if (res.ok) {
        const data = await res.json();
        const items = data.data || [];
        const enginesSet = new Set<string>();
        for (const item of items) {
          const attrs = item.attributes || {};
          if (attrs.vehicle_submodel) enginesSet.add(attrs.vehicle_submodel);
          if (attrs.vehicle_engine) enginesSet.add(attrs.vehicle_engine);
        }

        const engines = [...enginesSet].sort();
        return NextResponse.json({ type: 'submodels', year, make, model, data: engines });
      }

      return NextResponse.json({ type: 'submodels', year, make, model, data: [] });
    }

    return NextResponse.json({ data: [] });
  } catch (error: any) {
    console.error('[Fitment API]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Fallback makes list
const COMMON_MAKES_FALLBACK = [
  'Acura', 'Alfa Romeo', 'Audi', 'BMW', 'Buick', 'Cadillac',
  'Chevrolet', 'Chrysler', 'Dodge', 'Ferrari', 'Fiat', 'Ford',
  'Genesis', 'GMC', 'Honda', 'Hyundai', 'Infiniti', 'Jaguar',
  'Jeep', 'Kia', 'Lamborghini', 'Land Rover', 'Lexus', 'Lincoln',
  'Maserati', 'Mazda', 'McLaren', 'Mercedes-Benz', 'Mini',
  'Mitsubishi', 'Nissan', 'Porsche', 'Ram', 'Rolls-Royce',
  'Subaru', 'Tesla', 'Toyota', 'Volkswagen', 'Volvo'
];

const KNOWN_MODELS_BY_MAKE: Record<string, string[]> = {
  BMW: ['1 Series', '2 Series', '3 Series', '4 Series', '5 Series', '6 Series', '7 Series', '8 Series', 'M2', 'M3', 'M4', 'M5', 'M8', 'X1', 'X3', 'X5', 'X6', 'X7', 'Z4'],
  Audi: ['A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'Q3', 'Q5', 'Q7', 'Q8', 'R8', 'RS3', 'RS5', 'RS6', 'RS7', 'S3', 'S4', 'S5', 'TT'],
  'Mercedes-Benz': ['A-Class', 'C-Class', 'CLA', 'CLS', 'E-Class', 'G-Class', 'GLA', 'GLC', 'GLE', 'GLS', 'S-Class', 'AMG GT'],
  Toyota: ['86', 'Camry', 'Corolla', 'GR86', 'GR Corolla', 'GR Supra', 'Highlander', 'Land Cruiser', 'RAV4', 'Tacoma', 'Tundra'],
  Honda: ['Accord', 'Civic', 'Civic Type R', 'CR-V', 'Fit', 'HR-V', 'Integra', 'S2000'],
  Nissan: ['240SX', '300ZX', '350Z', '370Z', 'Altima', 'GT-R', 'Maxima', 'Pathfinder', 'Sentra', 'Z'],
  Ford: ['Bronco', 'Edge', 'Escape', 'Explorer', 'F-150', 'Fiesta ST', 'Focus RS', 'Focus ST', 'Mustang', 'Ranger'],
  Chevrolet: ['Camaro', 'Colorado', 'Corvette', 'Malibu', 'Silverado', 'Suburban', 'Tahoe', 'Traverse'],
  Subaru: ['BRZ', 'Crosstrek', 'Forester', 'Impreza', 'Legacy', 'Outback', 'WRX', 'WRX STI'],
  Porsche: ['718 Boxster', '718 Cayman', '911', 'Cayenne', 'Macan', 'Panamera', 'Taycan'],
  Dodge: ['Challenger', 'Charger', 'Durango', 'Ram', 'Viper'],
  Volkswagen: ['Atlas', 'Golf', 'Golf GTI', 'Golf R', 'ID.4', 'Jetta', 'Jetta GLI', 'Passat', 'Tiguan'],
  Lexus: ['ES', 'GS', 'GX', 'IS', 'IS 500', 'LC', 'LS', 'LX', 'NX', 'RC', 'RC F', 'RX'],
  Mazda: ['CX-30', 'CX-5', 'CX-50', 'CX-9', 'Mazda3', 'Mazda6', 'MX-5 Miata', 'RX-7', 'RX-8'],
  Mitsubishi: ['Eclipse', 'Eclipse Cross', 'Lancer', 'Lancer Evolution', 'Outlander'],
  Hyundai: ['Elantra', 'Elantra N', 'Ioniq 5', 'Kona', 'Santa Fe', 'Sonata', 'Tucson', 'Veloster N'],
  Kia: ['Forte', 'K5', 'Seltos', 'Sorento', 'Soul', 'Sportage', 'Stinger', 'Telluride'],
  Jeep: ['Cherokee', 'Compass', 'Gladiator', 'Grand Cherokee', 'Renegade', 'Wrangler'],
  Infiniti: ['G35', 'G37', 'Q50', 'Q60', 'QX50', 'QX60', 'QX80'],
  Acura: ['ILX', 'Integra', 'MDX', 'NSX', 'RDX', 'TLX', 'TSX'],
  Tesla: ['Model 3', 'Model S', 'Model X', 'Model Y'],
  Volvo: ['S60', 'S90', 'V60', 'V90', 'XC40', 'XC60', 'XC90'],
};
