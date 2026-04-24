export type AdminNavSectionKey =
  | 'overview'
  | 'orders'
  | 'customers'
  | 'catalog'
  | 'imports'
  | 'logistics'
  | 'content'
  | 'system';

export type AdminNavIconKey =
  | 'dashboard'
  | 'orders'
  | 'customers'
  | 'catalog'
  | 'inventory'
  | 'categories'
  | 'collections'
  | 'bundles'
  | 'media'
  | 'pricing'
  | 'seo'
  | 'imports'
  | 'csv'
  | 'turn14'
  | 'audit'
  | 'logistics'
  | 'taxes'
  | 'content'
  | 'messages'
  | 'blog'
  | 'settings'
  | 'users'
  | 'backups'
  | 'crm';

export type AdminNavItemDefinition = {
  href: string;
  label: string;
  description: string;
  icon: AdminNavIconKey;
  exactMatch?: boolean;
};

export type AdminNavSectionDefinition = {
  key: AdminNavSectionKey;
  label: string;
  description: string;
  items: AdminNavItemDefinition[];
};

export const ADMIN_NAV_SECTIONS: AdminNavSectionDefinition[] = [
  {
    key: 'overview',
    label: 'Overview',
    description: 'System health and commerce pulse.',
    items: [
      {
        href: '/admin',
        label: 'Dashboard',
        description: 'Company-wide metrics and current alerts.',
        icon: 'dashboard',
        exactMatch: true,
      },
    ],
  },
  {
    key: 'orders',
    label: 'Orders',
    description: 'Operational order management.',
    items: [
      {
        href: '/admin/shop/orders',
        label: 'Order center',
        description: 'Shop orders, manual creation, and status flow.',
        icon: 'orders',
      },
    ],
  },
  {
    key: 'customers',
    label: 'Customers',
    description: 'B2C, B2B, and CRM relationships.',
    items: [
      {
        href: '/admin/shop/customers',
        label: 'Customers',
        description: 'Shop customer records and account states.',
        icon: 'customers',
      },
      {
        href: '/admin/crm',
        label: 'CRM dashboard',
        description: 'Airtable CRM drilldowns and customer context.',
        icon: 'crm',
      },
    ],
  },
  {
    key: 'catalog',
    label: 'Catalog',
    description: 'Products, structure, media, and pricing.',
    items: [
      {
        href: '/admin/shop',
        label: 'Products',
        description: 'Primary product catalog and merchandising state.',
        icon: 'catalog',
        exactMatch: true,
      },
      {
        href: '/admin/shop/inventory',
        label: 'Inventory',
        description: 'Variant stock, quantities, and warehouse readiness.',
        icon: 'inventory',
      },
      {
        href: '/admin/shop/categories',
        label: 'Categories',
        description: 'Structured catalog taxonomy.',
        icon: 'categories',
      },
      {
        href: '/admin/shop/collections',
        label: 'Collections',
        description: 'Merchandising collections and landing assignments.',
        icon: 'collections',
      },
      {
        href: '/admin/shop/bundles',
        label: 'Bundles',
        description: 'Multi-product packages and assembly logic.',
        icon: 'bundles',
      },
      {
        href: '/admin/shop/media',
        label: 'Media',
        description: 'Product imagery and uploaded assets.',
        icon: 'media',
      },
      {
        href: '/admin/shop/quality',
        label: 'Quality center',
        description: 'Catalog gaps, SEO issues, and bulk-fix triage.',
        icon: 'seo',
      },
      {
        href: '/admin/shop/pricing',
        label: 'Pricing',
        description: 'B2C and B2B pricing control.',
        icon: 'pricing',
      },
      {
        href: '/admin/shop/seo',
        label: 'SEO AI',
        description: 'Catalog SEO generation and QA tooling.',
        icon: 'seo',
      },
    ],
  },
  {
    key: 'imports',
    label: 'Imports & Integrations',
    description: 'Inbound catalog flows and supplier syncs.',
    items: [
      {
        href: '/admin/shop/import',
        label: 'Import center',
        description: 'CSV imports, dry-runs, and result review.',
        icon: 'imports',
      },
      {
        href: '/admin/shop/stock',
        label: 'CSV import',
        description: 'Legacy stock import and column mapping.',
        icon: 'csv',
      },
      {
        href: '/admin/shop/feed',
        label: 'Feed exports',
        description: 'Distributor product and stock export URLs.',
        icon: 'csv',
      },
      {
        href: '/admin/shop/turn14',
        label: 'Turn14',
        description: 'Supplier proxy, brand markups, and sync control.',
        icon: 'turn14',
      },
      {
        href: '/admin/shop/audit',
        label: 'Import audit',
        description: 'Catalog change history and import traceability.',
        icon: 'audit',
      },
    ],
  },
  {
    key: 'logistics',
    label: 'Logistics',
    description: 'Warehouses, shipping zones, and taxes.',
    items: [
      {
        href: '/admin/shop/logistics',
        label: 'Warehouses & zones',
        description: 'Warehouse configuration and delivery geography.',
        icon: 'logistics',
        exactMatch: true,
      },
      {
        href: '/admin/shop/logistics/taxes',
        label: 'Regional taxes',
        description: 'Regional tax rules and destination logic.',
        icon: 'taxes',
      },
    ],
  },
  {
    key: 'content',
    label: 'Content',
    description: 'Editorial content and inbound messages.',
    items: [
      {
        href: '/admin/messages',
        label: 'Messages',
        description: 'Inbound contact forms and lead follow-up.',
        icon: 'messages',
      },
      {
        href: '/admin/blog',
        label: 'Blog',
        description: 'Editorial posts and publishing workflow.',
        icon: 'blog',
      },
    ],
  },
  {
    key: 'system',
    label: 'System',
    description: 'Configuration, access, and recovery.',
    items: [
      {
        href: '/admin/settings',
        label: 'Settings',
        description: 'Global configuration and business rules.',
        icon: 'settings',
      },
      {
        href: '/admin/shop/settings',
        label: 'Shop settings',
        description: 'Commerce-specific settings and defaults.',
        icon: 'settings',
      },
      {
        href: '/admin/users',
        label: 'Users & access',
        description: 'Internal access controls.',
        icon: 'users',
      },
      {
        href: '/admin/backups',
        label: 'Backups',
        description: 'Operational backup and restore guardrails.',
        icon: 'backups',
      },
    ],
  },
];

export function flattenAdminNavItems(sections: AdminNavSectionDefinition[] = ADMIN_NAV_SECTIONS) {
  return sections.flatMap((section) =>
    section.items.map((item) => ({
      ...item,
      sectionKey: section.key,
      sectionLabel: section.label,
    }))
  );
}

export function isAdminNavItemActive(pathname: string, item: AdminNavItemDefinition) {
  if (item.exactMatch) {
    return pathname === item.href;
  }

  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function getActiveAdminNavItem(pathname: string) {
  return flattenAdminNavItems().find((item) => isAdminNavItemActive(pathname, item)) ?? null;
}

export function getActiveAdminNavSection(pathname: string) {
  const activeItem = getActiveAdminNavItem(pathname);
  if (!activeItem) {
    return null;
  }

  return ADMIN_NAV_SECTIONS.find((section) => section.key === activeItem.sectionKey) ?? null;
}
