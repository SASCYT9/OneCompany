export type AdminNavSectionKey =
  | 'overview'
  | 'orders'
  | 'customers'
  | 'catalog'
  | 'imports'
  | 'logistics'
  | 'content'
  | 'marketing'
  | 'operations'
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
  | 'crm'
  | 'tag'
  | 'returns'
  | 'drafts'
  | 'email'
  | 'segments'
  | 'integrations';

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
    label: 'Огляд',
    description: 'Стан системи та активність бізнесу.',
    items: [
      {
        href: '/admin',
        label: 'Дашборд',
        description: 'Метрики компанії та поточні сповіщення.',
        icon: 'dashboard',
        exactMatch: true,
      },
    ],
  },
  {
    key: 'orders',
    label: 'Замовлення',
    description: 'Робота з замовленнями.',
    items: [
      {
        href: '/admin/shop/orders',
        label: 'Центр замовлень',
        description: 'Замовлення магазину, ручне створення, рух статусів.',
        icon: 'orders',
      },
      {
        href: '/admin/shop/drafts',
        label: 'Чернетки та котирування',
        description: 'B2B котирування, ціни на замовлення, посилання для клієнта.',
        icon: 'drafts',
      },
    ],
  },
  {
    key: 'customers',
    label: 'Клієнти',
    description: 'B2C, B2B та CRM-зв’язки.',
    items: [
      {
        href: '/admin/shop/customers',
        label: 'Клієнти',
        description: 'Записи клієнтів магазину та стани акаунтів.',
        icon: 'customers',
      },
      {
        href: '/admin/shop/customers/segments',
        label: 'Сегменти',
        description: 'Збережені правила для фільтрації та таргетингу.',
        icon: 'segments',
      },
      {
        href: '/admin/crm',
        label: 'CRM-дашборд',
        description: 'Деталізація з Airtable CRM та контекст клієнта.',
        icon: 'crm',
      },
    ],
  },
  {
    key: 'catalog',
    label: 'Каталог',
    description: 'Товари, структура, медіа та ціни.',
    items: [
      {
        href: '/admin/shop',
        label: 'Товари',
        description: 'Головний каталог товарів та стан мерчандайзингу.',
        icon: 'catalog',
        exactMatch: true,
      },
      {
        href: '/admin/shop/inventory',
        label: 'Склад',
        description: 'Залишки варіантів, кількості, готовність складу.',
        icon: 'inventory',
      },
      {
        href: '/admin/shop/categories',
        label: 'Категорії',
        description: 'Структурована таксономія каталогу.',
        icon: 'categories',
      },
      {
        href: '/admin/shop/collections',
        label: 'Колекції',
        description: 'Маркетингові колекції та прив’язки до сторінок.',
        icon: 'collections',
      },
      {
        href: '/admin/shop/bundles',
        label: 'Комплекти',
        description: 'Багатотоварні набори та правила збірки.',
        icon: 'bundles',
      },
      {
        href: '/admin/shop/media',
        label: 'Медіа',
        description: 'Зображення товарів та завантажені файли.',
        icon: 'media',
      },
      {
        href: '/admin/shop/quality',
        label: 'Контроль якості',
        description: 'Прогалини в каталозі, SEO-проблеми та масові виправлення.',
        icon: 'seo',
      },
      {
        href: '/admin/shop/pricing',
        label: 'Ціни',
        description: 'Керування B2C та B2B цінами.',
        icon: 'pricing',
      },
      {
        href: '/admin/shop/seo',
        label: 'SEO AI',
        description: 'AI-генерація SEO для каталогу та QA-інструменти.',
        icon: 'seo',
      },
    ],
  },
  {
    key: 'imports',
    label: 'Імпорти та інтеграції',
    description: 'Вхідні потоки каталогу та синхронізації постачальників.',
    items: [
      {
        href: '/admin/shop/import',
        label: 'Центр імпортів',
        description: 'CSV-імпорти, тестові прогони та результати.',
        icon: 'imports',
      },
      {
        href: '/admin/shop/stock',
        label: 'CSV-імпорт',
        description: 'Старий імпорт залишків та зіставлення колонок.',
        icon: 'csv',
      },
      {
        href: '/admin/shop/feed',
        label: 'Експорт фідів',
        description: 'URL-адреси експорту товарів та залишків для дистриб’юторів.',
        icon: 'csv',
      },
      {
        href: '/admin/shop/turn14',
        label: 'Turn14',
        description: 'Проксі постачальника, націнки на бренди, керування синхронізацією.',
        icon: 'turn14',
      },
      {
        href: '/admin/shop/audit',
        label: 'Аудит імпортів',
        description: 'Історія змін каталогу та трасування імпортів.',
        icon: 'audit',
      },
    ],
  },
  {
    key: 'logistics',
    label: 'Логістика',
    description: 'Склади, зони доставки та податки.',
    items: [
      {
        href: '/admin/shop/logistics',
        label: 'Склади та зони',
        description: 'Налаштування складів та географія доставки.',
        icon: 'logistics',
        exactMatch: true,
      },
      {
        href: '/admin/shop/logistics/taxes',
        label: 'Регіональні податки',
        description: 'Податкові правила за регіонами доставки.',
        icon: 'taxes',
      },
    ],
  },
  {
    key: 'content',
    label: 'Контент',
    description: 'Редакційний контент та вхідні повідомлення.',
    items: [
      {
        href: '/admin/messages',
        label: 'Повідомлення',
        description: 'Вхідні форми зв’язку та робота з лідами.',
        icon: 'messages',
      },
      {
        href: '/admin/blog',
        label: 'Блог',
        description: 'Редакційні матеріали та робочий процес публікації.',
        icon: 'blog',
      },
    ],
  },
  {
    key: 'marketing',
    label: 'Маркетинг',
    description: 'Промокоди, кампанії, email-автоматизація.',
    items: [
      {
        href: '/admin/shop/discounts',
        label: 'Промокоди',
        description: 'Промо, BOGO-правила, кампанії тільки для B2B.',
        icon: 'tag',
      },
      {
        href: '/admin/marketing/email-rules',
        label: 'Email-автоматизація',
        description: 'Тригери, шаблони, журнал розсилок.',
        icon: 'email',
      },
    ],
  },
  {
    key: 'operations',
    label: 'Операції',
    description: 'Повернення, RMA, виконання замовлень.',
    items: [
      {
        href: '/admin/shop/returns',
        label: 'Повернення / RMA',
        description: 'Запити на повернення, відстеження поповнення, B2C+B2B процеси.',
        icon: 'returns',
      },
    ],
  },
  {
    key: 'system',
    label: 'Система',
    description: 'Налаштування, доступи, бекапи.',
    items: [
      {
        href: '/admin/settings',
        label: 'Налаштування',
        description: 'Глобальні параметри та бізнес-правила.',
        icon: 'settings',
      },
      {
        href: '/admin/shop/settings',
        label: 'Налаштування магазину',
        description: 'Параметри електронної комерції та значення за замовчуванням.',
        icon: 'settings',
      },
      {
        href: '/admin/users',
        label: 'Користувачі та доступи',
        description: 'Внутрішні контролі доступу.',
        icon: 'users',
      },
      {
        href: '/admin/settings/integrations',
        label: 'Інтеграції',
        description: 'Mailchimp, Meta Ads, Google-сервіси.',
        icon: 'integrations',
      },
      {
        href: '/admin/backups',
        label: 'Резервні копії',
        description: 'Бекапи та контроль відновлення.',
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
