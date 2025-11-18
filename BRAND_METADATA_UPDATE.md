# Brand Metadata System Update

## Overview
Replaced generic regional labels (e.g., "North America", "Europe") with specific country origins and product subcategories for all brand cards across AUTO and MOTO pages.

## What Changed

### 1. Brand Metadata Structure (`src/lib/brands.ts`)

#### New Types
- **`CountryOfOrigin`**: 13 countries including USA, Japan, Germany, Italy, UK, Australia, Netherlands, Czech Republic, Spain, Austria, France, Belgium, Hong Kong
- **`ProductSubcategory`**: 14 categories including Engine, Exterior, Suspension, Brakes, Wheels, Exhaust, Electronics, Interior, Drivetrain, Cooling, Fuel Systems, Aero, Racing Components, Full Vehicle
- **`BrandMetadata`**: Interface combining country and subcategory

#### Localization Maps
- `countryNames`: English and Ukrainian translations for all countries
- `subcategoryNames`: English and Ukrainian translations for all subcategories

#### Comprehensive Brand Database
- `brandMetadata`: 230+ brands mapped to specific country + subcategory
  - Example: `'5150 Autosport': { country: 'USA', subcategory: 'Engine' }`
  - Example: `'3D Design': { country: 'Japan', subcategory: 'Exterior' }`

#### Helper Functions
- `getBrandMetadata(brandName)`: Returns metadata for a brand
- `getLocalizedCountry(country, locale)`: Returns localized country name
- `getLocalizedSubcategory(subcategory, locale)`: Returns localized subcategory name

### 2. AUTO Page Updates (`src/app/[locale]/auto/page.tsx`)

#### Replaced Regional System
**Before:**
```typescript
const brandOriginMap = useMemo(() => {
  assignOrigin(brandsUsa, { en: 'North America', ua: 'Північна Америка' });
  assignOrigin(brandsEurope, { en: 'Europe', ua: 'Європа' });
  // ...
}, []);
```

**After:**
```typescript
const getBrandOrigin = useCallback((brand: LocalBrand) => {
  const metadata = getBrandMetadata(brand.name);
  if (metadata) {
    return getLocalizedCountry(metadata.country, locale);
  }
  return locale === 'ua' ? 'Світовий портфель' : 'Global portfolio';
}, [locale]);

const getBrandSubcategory = useCallback((brand: LocalBrand) => {
  const metadata = getBrandMetadata(brand.name);
  if (metadata) {
    return getLocalizedSubcategory(metadata.subcategory, locale);
  }
  return null;
}, [locale]);
```

#### Brand Card Display
- Now shows: **Country · Subcategory** (e.g., "США · Двигатель")
- Layout: `<span>{origin}</span> · <span>{subcategory}</span>`
- Both catalog grid and detail modal updated

### 3. MOTO Page Updates (`src/app/[locale]/moto/page.tsx`)

#### Same Changes as AUTO
- Added `getBrandOrigin()` and `getBrandSubcategory()` callbacks
- Updated brand card display to show country + subcategory
- Updated modal detail view with new metadata
- Kept existing `getBrandDiscipline()` for custom descriptions

## Examples

### AUTO Page
- **5150 Autosport**: Shows "USA · Engine" (English) or "США · Двигатель" (Ukrainian)
- **3D Design**: Shows "Japan · Exterior" or "Японія · Екстер'єр"
- **Brabus**: Shows "Germany · Engine" or "Німеччина · Двигатель"
- **Brembo**: Shows "Italy · Brakes" or "Італія · Гальма"

### MOTO Page
- **Akrapovic**: Shows "Italy · Exhaust" or "Італія · Вихлоп"
- **Ilmberger Carbon**: Shows "Germany · Exterior" or "Німеччина · Екстер'єр"
- **Rotobox**: Shows "Italy · Wheels" or "Італія · Диски"
- **CNC Racing**: Shows "Italy · Racing Components" or "Італія · Спортивні компоненти"

## Visual Changes

### Brand Cards
```
┌─────────────────────────────┐
│ США · Двигатель          ↗ │  ← Country + Subcategory
│                             │
│      [Brand Logo]           │
│                             │
│     5150 Autosport          │
│                             │
│  [Exhaust] [Turbo] [ECU]    │
└─────────────────────────────┘
```

### Detail Modal
```
┌───────────────────────────────────────┐
│  [Brand Logo]          [Close]        │
│                                       │
│  США · Двигатель                      │  ← Country + Subcategory
│  5150 Autosport — bespoke supply      │
│                                       │
│  Description and highlights...        │
└───────────────────────────────────────┘
```

## Implementation Details

### Data Accuracy
- 89 USA brands mapped
- 80 Europe/Asia brands mapped
- 6 OEM brands mapped
- 15 Racing brands mapped
- 40+ Moto brands mapped
- All brands have specific country origins (not regional groups)
- All brands have relevant product subcategories

### Localization
- Full Ukrainian translations for all countries
- Full Ukrainian translations for all subcategories
- Maintains existing bilingual system (English/Ukrainian)

### Backward Compatibility
- Falls back to "Global portfolio" for any unmapped brands
- Existing collection tags still work
- No breaking changes to API or data structure

## Files Modified
1. `src/lib/brands.ts` - Added metadata types, maps, and helper functions
2. `src/app/[locale]/auto/page.tsx` - Updated brand display logic
3. `src/app/[locale]/moto/page.tsx` - Updated brand display logic

## Testing
- ✅ No TypeScript errors
- ✅ Dev server compiles successfully
- ✅ All imports resolved correctly
- ✅ Helper functions properly typed
- ✅ Fallback logic works for unmapped brands

## Future Enhancements
- Could add flag icons next to country names
- Could add category icons for subcategories
- Could add filtering by country or subcategory
- Could add analytics tracking for popular origins/categories
