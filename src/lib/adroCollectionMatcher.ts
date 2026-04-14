import type { ShopProduct } from '@/lib/shopCatalog';

/**
 * Maps collection handles to ADRO title matching patterns.
 * ADRO products usually do not have standard tags, so we match by title patterns.
 */
const COLLECTION_TITLE_MAP: Record<string, { patterns: string[] }> = {
  'bmw-m4': { patterns: ['BMW M4', 'BMW M3', 'G80', 'G82', 'G8X'] },
  'bmw-m4-widebody': { patterns: ['Widebody', 'Wide body'] },
  'porsche-gt3': { patterns: ['Porsche 911 GT3', '992 GT3'] },
  'toyota-supra': { patterns: ['GR Supra', 'Supra'] },
  'tesla-model3': { patterns: ['Tesla Model 3', 'Model 3'] },
  'porsche-718': { patterns: ['Porsche 718', 'Cayman', 'Boxster'] },
  'bmw-x5m': { patterns: ['X5M', 'F95'] },
  'ford-mustang': { patterns: ['Mustang'] },
  'kia-stinger': { patterns: ['Stinger'] },
  'civic-type-r': { patterns: ['Civic Type R', 'FL5'] },
};

/**
 * Returns products that belong to a specific ADRO collection handle.
 * Uses the COLLECTION_TITLE_MAP to match product titles since tags are often empty.
 */
export function getProductsForAdroCollection(products: ShopProduct[], handle: string) {
  const mapping = COLLECTION_TITLE_MAP[handle];

  return products.filter((p) => {
    if (p.brand?.toLowerCase() !== 'adro') return false;
    
    if (!mapping) {
      // Fallback: match by handle in title if no specific mapping
      const normalizedTitle = (p.title?.en || '').toLowerCase();
      const searchTerms = handle.replace(/-/g, ' ').split(' ');
      return searchTerms.some(term => normalizedTitle.includes(term.toLowerCase()));
    }
    
    // Match ANY of the specified patterns in the title
    const normalizedTitle = (p.title?.en || '').toLowerCase();
    return mapping.patterns.some(pattern => normalizedTitle.includes(pattern.toLowerCase()));
  });
}
