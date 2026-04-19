import type { AdminEditorNavSection } from '@/components/admin/AdminPrimitives';

export const ADMIN_PRODUCT_EDITOR_SECTIONS: AdminEditorNavSection[] = [
  {
    id: 'overview',
    label: 'Overview',
    description: 'Identity, storefront ownership, and collection assignments.',
  },
  {
    id: 'content',
    label: 'Content',
    description: 'Localized copy and source HTML.',
  },
  {
    id: 'pricing',
    label: 'Pricing',
    description: 'Base B2C and B2B pricing bands.',
  },
  {
    id: 'dimensions',
    label: 'Dimensions',
    description: 'Shipping dimensions and AI-estimated flags.',
  },
  {
    id: 'seo',
    label: 'SEO',
    description: 'Search metadata used by storefront pages.',
  },
  {
    id: 'media',
    label: 'Media',
    description: 'Product gallery and uploads.',
  },
  {
    id: 'options',
    label: 'Options',
    description: 'Variant option definitions and generation seeds.',
  },
  {
    id: 'variants',
    label: 'Variants',
    description: 'Per-variant stock, pricing, and dimensions.',
  },
  {
    id: 'metafields',
    label: 'Metafields',
    description: 'Theme-specific structured data.',
  },
  {
    id: 'danger-zone',
    label: 'Danger zone',
    description: 'Archive-only destructive actions.',
  },
];
