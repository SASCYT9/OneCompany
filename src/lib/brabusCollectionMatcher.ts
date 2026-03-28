import type { ShopProduct } from '@/lib/shopCatalog';

/**
 * Maps collection handles to actual product tag patterns.
 * Products use German-style tags (G-Klasse, S-Klasse) and explicit brand tags.
 */
const COLLECTION_TAG_MAP: Record<string, { tags: string[]; matchAny?: boolean }> = {
  'g-class': { tags: ['G-Klasse'] },
  's-class': { tags: ['S-Klasse'] },
  'porsche': { tags: ['Porsche'] },
  'rolls-royce': { tags: ['Rolls-Royce', 'Bentley'], matchAny: true },
  'wheels': { tags: ['Monoblock', 'Felge'] },
  // Specific model handles
  'g-class-w463a': { tags: ['G-Klasse', 'W 463A'] },
  'g-class-w465': { tags: ['G-Klasse', 'W 465'] },
  's-class-w223': { tags: ['S-Klasse', 'W 223'] },
  'porsche-911': { tags: ['Porsche 911 Turbo'] },
  'porsche-taycan': { tags: ['Porsche Taycan'] },
  'rolls-royce-cullinan': { tags: ['Rolls-Royce Cullinan'] },
  'rolls-royce-ghost': { tags: ['Rolls-Royce Ghost'] },
  'range-rover': { tags: ['Range Rover'] },
  'bentley': { tags: ['Bentley'] },
  'lamborghini': { tags: ['Lamborghini'] },
  'smart': { tags: ['smart'] },
  'gt-class': { tags: ['GT-Klasse'] },
  'v-class': { tags: ['V-Klasse'] },
  'gls-class': { tags: ['GLS-Klasse'] },
  'gle-class': { tags: ['GLE-Klasse'] },
  'glc-class': { tags: ['GLC-Klasse'] },
  'e-class': { tags: ['E-Klasse'] },
  'c-class': { tags: ['C-Klasse'] },
  'a-class': { tags: ['A-Klasse'] },
  'sl-class': { tags: ['SL-Klasse'] },
  'eqs-class': { tags: ['EQS-Klasse'] },
  'cls-class': { tags: ['CLS-Klasse'] },
  'glb-class': { tags: ['GLB-Klasse'] },
  'eqc-class': { tags: ['EQC-Klasse'] },
};

/**
 * Returns products that belong to a specific Brabus collection handle.
 * Uses the COLLECTION_TAG_MAP to match product tags.
 */
export function getProductsForBrabusCollection(products: ShopProduct[], handle: string) {
  const mapping = COLLECTION_TAG_MAP[handle];
  
  if (!mapping) {
    // Fallback: try exact handle match in tags
    return products.filter((p) => p.brand?.toLowerCase() === 'brabus' && p.tags?.includes(handle));
  }

  return products.filter((p) => {
    if (p.brand?.toLowerCase() !== 'brabus') return false;
    const productTags = p.tags || [];
    
    if (mapping.matchAny) {
      // Match ANY of the specified tags (e.g., Rolls-Royce OR Bentley)
      return mapping.tags.some(tag => productTags.includes(tag));
    }
    
    // Match ALL of the specified tags
    return mapping.tags.every(tag => productTags.includes(tag));
  });
}

export function buildShopProductPathBrabus(locale: string, product: ShopProduct) {
  return `/${locale}/shop/brabus/products/${product.slug}`;
}
