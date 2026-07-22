import { ADMIN_PERMISSIONS, matchesAdminPermission } from "@/lib/admin/adminPermissions";

export type AdminNavSectionKey =
  | "overview"
  | "work"
  | "orders"
  | "customers"
  | "catalog"
  | "imports"
  | "logistics"
  | "content"
  | "marketing"
  | "operations"
  | "system";

export type AdminNavIconKey =
  | "dashboard"
  | "orders"
  | "customers"
  | "catalog"
  | "inventory"
  | "categories"
  | "collections"
  | "bundles"
  | "media"
  | "pricing"
  | "seo"
  | "imports"
  | "csv"
  | "turn14"
  | "audit"
  | "logistics"
  | "taxes"
  | "content"
  | "messages"
  | "blog"
  | "settings"
  | "users"
  | "backups"
  | "crm"
  | "tag"
  | "returns"
  | "drafts"
  | "email"
  | "segments"
  | "integrations"
  | "tasks"
  | "inbox"
  | "projects"
  | "knowledge"
  | "approvals";

export type AdminNavItemDefinition = {
  href: string;
  label: string;
  description: string;
  icon: AdminNavIconKey;
  exactMatch?: boolean;
  requiredPermissions?: readonly string[];
};

export type AdminNavSectionDefinition = {
  key: AdminNavSectionKey;
  label: string;
  description: string;
  items: AdminNavItemDefinition[];
};

export const ADMIN_NAV_SECTIONS: AdminNavSectionDefinition[] = [
  {
    key: "overview",
    label: "Огляд",
    description: "Стан системи та активність бізнесу.",
    items: [
      {
        href: "/admin",
        label: "Дашборд",
        description: "Метрики компанії та поточні сповіщення.",
        icon: "dashboard",
        exactMatch: true,
      },
    ],
  },
  {
    key: "work",
    label: "Работа",
    description: "Проекты, задачи, входящие и база знаний команды.",
    items: [
      {
        href: "/admin/operations",
        label: "Обзор",
        description: "Текущая работа команды, сроки и блокеры.",
        icon: "dashboard",
        exactMatch: true,
        requiredPermissions: [ADMIN_PERMISSIONS.OPS_TASKS_READ],
      },
      {
        href: "/admin/operations/inbox",
        label: "Входящие",
        description: "Сообщения Telegram и предложения перед созданием задач.",
        icon: "inbox",
        requiredPermissions: [ADMIN_PERMISSIONS.OPS_INBOX_READ],
      },
      {
        href: "/admin/operations/projects",
        label: "Проекты",
        description: "Активные проекты, владельцы и следующие действия.",
        icon: "projects",
        requiredPermissions: [ADMIN_PERMISSIONS.OPS_TASKS_READ],
      },
      {
        href: "/admin/operations/tasks",
        label: "Задачи",
        description: "Общая доска и личные задачи команды.",
        icon: "tasks",
        requiredPermissions: [ADMIN_PERMISSIONS.OPS_TASKS_READ],
      },
      {
        href: "/admin/operations/directory",
        label: "Справочник",
        description: "Бренды, формулы, источники и ориентиры доставки.",
        icon: "knowledge",
        requiredPermissions: [ADMIN_PERMISSIONS.OPS_KNOWLEDGE_READ],
      },
      {
        href: "/admin/operations/knowledge",
        label: "БАЗА",
        description: "Обучение, инструкции и процессы для команды.",
        icon: "knowledge",
        requiredPermissions: [ADMIN_PERMISSIONS.OPS_KNOWLEDGE_READ],
      },
      {
        href: "/admin/operations/approvals",
        label: "Согласования",
        description: "Запросы, которые требуют зафиксированного решения сотрудника.",
        icon: "approvals",
        requiredPermissions: [ADMIN_PERMISSIONS.OPS_APPROVALS_DECIDE],
      },
      {
        href: "/admin/operations/system",
        label: "Система",
        description: "Очередь, dead letter, ошибки Входящих и лимиты Operations.",
        icon: "settings",
        requiredPermissions: [ADMIN_PERMISSIONS.OPS_SYSTEM_MANAGE],
      },
    ],
  },
  {
    key: "orders",
    label: "Замовлення",
    description: "Робота з замовленнями.",
    items: [
      {
        href: "/admin/shop/orders",
        label: "Центр замовлень",
        description: "Замовлення магазину, ручне створення, рух статусів.",
        icon: "orders",
      },
      {
        href: "/admin/shop/drafts",
        label: "Чернетки та котирування",
        description: "B2B котирування, ціни на замовлення, посилання для клієнта.",
        icon: "drafts",
      },
    ],
  },
  {
    key: "customers",
    label: "Клієнти",
    description: "B2C, B2B та CRM-зв’язки.",
    items: [
      {
        href: "/admin/shop/customers",
        label: "Клієнти",
        description: "Записи клієнтів магазину та стани акаунтів.",
        icon: "customers",
      },
      {
        href: "/admin/shop/customers/segments",
        label: "Сегменти",
        description: "Збережені правила для фільтрації та таргетингу.",
        icon: "segments",
      },
      {
        href: "/admin/crm",
        label: "CRM-дашборд",
        description: "Деталізація з Airtable CRM та контекст клієнта.",
        icon: "crm",
      },
    ],
  },
  {
    key: "catalog",
    label: "Каталог",
    description: "Товари, структура, медіа та ціни.",
    items: [
      {
        href: "/admin/shop",
        label: "Товари",
        description: "Головний каталог товарів та стан мерчандайзингу.",
        icon: "catalog",
        exactMatch: true,
      },
      {
        href: "/admin/shop/inventory",
        label: "Склад",
        description: "Залишки варіантів, кількості, готовність складу.",
        icon: "inventory",
      },
      {
        href: "/admin/shop/categories",
        label: "Категорії",
        description: "Структурована таксономія каталогу.",
        icon: "categories",
      },
      {
        href: "/admin/shop/collections",
        label: "Колекції",
        description: "Маркетингові колекції та прив’язки до сторінок.",
        icon: "collections",
      },
      {
        href: "/admin/shop/bundles",
        label: "Комплекти",
        description: "Багатотоварні набори та правила збірки.",
        icon: "bundles",
      },
      {
        href: "/admin/shop/media",
        label: "Медіа",
        description: "Зображення товарів та завантажені файли.",
        icon: "media",
      },
      {
        href: "/admin/shop/quality",
        label: "Контроль якості",
        description: "Прогалини в каталозі, SEO-проблеми та масові виправлення.",
        icon: "seo",
      },
      {
        href: "/admin/shop/fitment",
        label: "Сумісність",
        description: "Перевірка марки, моделі, кузова та років для пошуку за авто.",
        icon: "tag",
      },
      {
        href: "/admin/shop/ai-quality",
        label: "One AI Quality",
        description:
          "Контроль покриття знань, черги перевірки, відгуків, трас запитів та індексації.",
        icon: "seo",
      },
      {
        href: "/admin/shop/pricing",
        label: "Ціни",
        description: "Керування B2C та B2B цінами.",
        icon: "pricing",
      },
      {
        href: "/admin/shop/seo",
        label: "SEO AI",
        description: "AI-генерація SEO для каталогу та QA-інструменти.",
        icon: "seo",
      },
    ],
  },
  {
    key: "imports",
    label: "Імпорти та інтеграції",
    description: "Вхідні потоки каталогу та синхронізації постачальників.",
    items: [
      {
        href: "/admin/shop/import",
        label: "Центр імпортів",
        description: "CSV-імпорти, тестові прогони та результати.",
        icon: "imports",
      },
      {
        href: "/admin/shop/stock",
        label: "CSV-імпорт",
        description: "Старий імпорт залишків та зіставлення колонок.",
        icon: "csv",
      },
      {
        href: "/admin/shop/feed",
        label: "Експорт фідів",
        description: "URL-адреси експорту товарів та залишків для дистриб’юторів.",
        icon: "csv",
      },
      {
        href: "/admin/shop/turn14",
        label: "Turn14",
        description: "Проксі постачальника, націнки на бренди, керування синхронізацією.",
        icon: "turn14",
      },
      {
        href: "/admin/shop/audit",
        label: "Аудит імпортів",
        description: "Історія змін каталогу та трасування імпортів.",
        icon: "audit",
      },
    ],
  },
  {
    key: "logistics",
    label: "Логістика",
    description: "Склади, зони доставки та податки.",
    items: [
      {
        href: "/admin/shop/logistics",
        label: "Склади та зони",
        description: "Налаштування складів та географія доставки.",
        icon: "logistics",
        exactMatch: true,
      },
      {
        href: "/admin/shop/logistics/taxes",
        label: "Регіональні податки",
        description: "Податкові правила за регіонами доставки.",
        icon: "taxes",
      },
    ],
  },
  {
    key: "content",
    label: "Контент",
    description: "Редакційний контент та вхідні повідомлення.",
    items: [
      {
        href: "/admin/messages",
        label: "Повідомлення",
        description: "Вхідні форми зв’язку та робота з лідами.",
        icon: "messages",
      },
      {
        href: "/admin/blog",
        label: "Блог",
        description: "Редакційні матеріали та робочий процес публікації.",
        icon: "blog",
      },
    ],
  },
  {
    key: "marketing",
    label: "Маркетинг",
    description: "Промокоди, кампанії, email-автоматизація.",
    items: [
      {
        href: "/admin/shop/discounts",
        label: "Промокоди",
        description: "Промо, BOGO-правила, кампанії тільки для B2B.",
        icon: "tag",
      },
      {
        href: "/admin/marketing/email-rules",
        label: "Email-автоматизація",
        description: "Тригери, шаблони, журнал розсилок.",
        icon: "email",
      },
    ],
  },
  {
    key: "operations",
    label: "Операції",
    description: "Повернення, RMA, виконання замовлень.",
    items: [
      {
        href: "/admin/shop/returns",
        label: "Повернення / RMA",
        description: "Запити на повернення, відстеження поповнення, B2C+B2B процеси.",
        icon: "returns",
      },
    ],
  },
  {
    key: "system",
    label: "Система",
    description: "Налаштування, доступи, бекапи.",
    items: [
      {
        href: "/admin/settings",
        label: "Налаштування",
        description: "Глобальні параметри та бізнес-правила.",
        icon: "settings",
      },
      {
        href: "/admin/shop/settings",
        label: "Налаштування магазину",
        description: "Параметри електронної комерції та значення за замовчуванням.",
        icon: "settings",
      },
      {
        href: "/admin/users",
        label: "Команда и доступы",
        description: "Логины, пароли, роли и Telegram.",
        icon: "users",
      },
      {
        href: "/admin/settings/integrations",
        label: "Інтеграції",
        description: "Mailchimp, Meta Ads, Google-сервіси.",
        icon: "integrations",
      },
      {
        href: "/admin/backups",
        label: "Резервні копії",
        description: "Бекапи та контроль відновлення.",
        icon: "backups",
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

const ADMIN_NAV_PERMISSION_BY_HREF: Readonly<Record<string, readonly string[]>> = {
  "/admin": [ADMIN_PERMISSIONS.ADMIN_DASHBOARD_READ],
  "/admin/shop/orders": [ADMIN_PERMISSIONS.SHOP_ORDERS_READ],
  "/admin/shop/drafts": [ADMIN_PERMISSIONS.SHOP_ORDERS_READ],
  "/admin/shop/customers": [ADMIN_PERMISSIONS.SHOP_CUSTOMERS_READ],
  "/admin/shop/customers/segments": [ADMIN_PERMISSIONS.SHOP_CUSTOMERS_READ],
  "/admin/crm": [ADMIN_PERMISSIONS.SHOP_CUSTOMERS_READ],
  "/admin/shop": [ADMIN_PERMISSIONS.SHOP_PRODUCTS_READ],
  "/admin/shop/inventory": [ADMIN_PERMISSIONS.SHOP_INVENTORY_READ],
  "/admin/shop/categories": [ADMIN_PERMISSIONS.SHOP_CATEGORIES_READ],
  "/admin/shop/collections": [ADMIN_PERMISSIONS.SHOP_COLLECTIONS_READ],
  "/admin/shop/bundles": [ADMIN_PERMISSIONS.SHOP_PRODUCTS_READ],
  "/admin/shop/media": [ADMIN_PERMISSIONS.SHOP_PRODUCTS_READ],
  "/admin/shop/quality": [ADMIN_PERMISSIONS.SHOP_PRODUCTS_READ],
  "/admin/shop/fitment": [ADMIN_PERMISSIONS.SHOP_PRODUCTS_READ],
  "/admin/shop/ai-quality": [ADMIN_PERMISSIONS.SHOP_AI_READ],
  "/admin/shop/pricing": [ADMIN_PERMISSIONS.SHOP_PRICING_READ],
  "/admin/shop/seo": [ADMIN_PERMISSIONS.SHOP_PRODUCTS_WRITE],
  "/admin/shop/import": [ADMIN_PERMISSIONS.SHOP_IMPORTS_MANAGE],
  "/admin/shop/stock": [ADMIN_PERMISSIONS.SHOP_IMPORTS_MANAGE],
  "/admin/shop/feed": [ADMIN_PERMISSIONS.SHOP_PRODUCTS_READ],
  "/admin/shop/turn14": [ADMIN_PERMISSIONS.SHOP_IMPORTS_MANAGE],
  "/admin/shop/audit": [ADMIN_PERMISSIONS.SHOP_AUDIT_READ],
  "/admin/shop/logistics": [ADMIN_PERMISSIONS.SHOP_SETTINGS_READ],
  "/admin/shop/logistics/taxes": [ADMIN_PERMISSIONS.SHOP_SETTINGS_READ],
  "/admin/messages": [ADMIN_PERMISSIONS.SHOP_SETTINGS_READ],
  "/admin/blog": [ADMIN_PERMISSIONS.SHOP_SETTINGS_READ],
  "/admin/shop/discounts": [ADMIN_PERMISSIONS.SHOP_PRODUCTS_WRITE],
  "/admin/marketing/email-rules": [ADMIN_PERMISSIONS.SHOP_SETTINGS_READ],
  "/admin/shop/returns": [ADMIN_PERMISSIONS.SHOP_ORDERS_READ],
  "/admin/settings": [ADMIN_PERMISSIONS.SHOP_SETTINGS_READ],
  "/admin/shop/settings": [ADMIN_PERMISSIONS.SHOP_SETTINGS_READ],
  "/admin/users": [ADMIN_PERMISSIONS.ADMIN_USERS_MANAGE],
  "/admin/settings/integrations": [ADMIN_PERMISSIONS.SHOP_SETTINGS_READ],
  "/admin/backups": [ADMIN_PERMISSIONS.SHOP_SETTINGS_READ],
};

export function getAdminNavItemRequiredPermissions(
  item: AdminNavItemDefinition
): readonly string[] {
  return item.requiredPermissions ?? ADMIN_NAV_PERMISSION_BY_HREF[item.href] ?? [];
}

export function canAccessAdminNavItem(
  permissions: readonly string[],
  item: AdminNavItemDefinition
) {
  const requiredPermissions = getAdminNavItemRequiredPermissions(item);
  return (
    requiredPermissions.length > 0 &&
    requiredPermissions.some((permission) => matchesAdminPermission([...permissions], permission))
  );
}

export function filterAdminNavSections(
  permissions: readonly string[],
  sections: AdminNavSectionDefinition[] = ADMIN_NAV_SECTIONS,
  options: { operationsUiEnabled?: boolean } = {}
) {
  const operationsUiEnabled = options.operationsUiEnabled ?? true;
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) =>
          (operationsUiEnabled || !item.href.startsWith("/admin/operations")) &&
          canAccessAdminNavItem(permissions, item)
      ),
    }))
    .filter((section) => section.items.length > 0);
}

export function getFirstAllowedAdminRoute(
  permissions: readonly string[],
  options: { operationsUiEnabled?: boolean } = {}
) {
  return (
    flattenAdminNavItems(filterAdminNavSections(permissions, ADMIN_NAV_SECTIONS, options))[0]
      ?.href ?? null
  );
}

export function getAdminNavAccessItem(
  pathname: string,
  sections: AdminNavSectionDefinition[] = ADMIN_NAV_SECTIONS,
  options: { operationsUiEnabled?: boolean } = {}
) {
  const operationsUiEnabled = options.operationsUiEnabled ?? true;
  return (
    flattenAdminNavItems(sections)
      .filter((item) => operationsUiEnabled || !item.href.startsWith("/admin/operations"))
      .sort((left, right) => right.href.length - left.href.length)
      .find(
        (item) =>
          pathname === item.href || (item.href !== "/admin" && pathname.startsWith(`${item.href}/`))
      ) ?? null
  );
}

export function canAccessAdminPath(
  pathname: string,
  permissions: readonly string[],
  options: { operationsUiEnabled?: boolean } = {}
) {
  const item = getAdminNavAccessItem(pathname, ADMIN_NAV_SECTIONS, options);
  return Boolean(item && canAccessAdminNavItem(permissions, item));
}

export function isAdminNavItemActive(pathname: string, item: AdminNavItemDefinition) {
  if (item.exactMatch) {
    return pathname === item.href;
  }

  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function getActiveAdminNavItem(
  pathname: string,
  sections: AdminNavSectionDefinition[] = ADMIN_NAV_SECTIONS
) {
  return (
    flattenAdminNavItems(sections).find((item) => isAdminNavItemActive(pathname, item)) ?? null
  );
}

export function getActiveAdminNavSection(
  pathname: string,
  sections: AdminNavSectionDefinition[] = ADMIN_NAV_SECTIONS
) {
  const activeItem = getActiveAdminNavItem(pathname, sections);
  if (!activeItem) {
    return null;
  }

  return sections.find((section) => section.key === activeItem.sectionKey) ?? null;
}
