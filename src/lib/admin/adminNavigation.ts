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
  | "tools"
  | "inventory"
  | "categories"
  | "collections"
  | "bundles"
  | "media"
  | "pricing"
  | "seo"
  | "imports"
  | "csv"
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
  icon: AdminNavIconKey;
  items: AdminNavItemDefinition[];
};

export const ADMIN_NAV_SECTIONS: AdminNavSectionDefinition[] = [
  {
    key: "overview",
    label: "Огляд",
    description: "Стан системи та активність бізнесу.",
    icon: "dashboard",
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
    description: "Задачи команды, входящие из Telegram и база знаний.",
    icon: "tasks",
    items: [
      {
        href: "/admin/operations",
        label: "Мой день",
        description: "Что сделать сейчас, мои задачи и кто чем занят.",
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
    label: "Продажі",
    description: "Замовлення, проформи, звернення клієнтів та повернення.",
    icon: "orders",
    items: [
      {
        href: "/admin/shop/orders",
        label: "Центр замовлень",
        description: "Замовлення магазину, ручне створення, рух статусів.",
        icon: "orders",
      },
      {
        href: "/admin/shop/drafts",
        label: "Проформи та котирування",
        description: "Проформи до замовлення, котирування та наявність для Telegram.",
        icon: "drafts",
      },
      {
        href: "/admin/messages",
        label: "Повідомлення",
        description: "Вхідні форми зв’язку та робота з лідами.",
        icon: "messages",
      },
      {
        href: "/admin/shop/returns",
        label: "Повернення / RMA",
        description: "Запити на повернення, відстеження поповнення, B2C+B2B процеси.",
        icon: "returns",
      },
    ],
  },
  {
    key: "customers",
    label: "Клієнти",
    description: "B2C, B2B та CRM-зв’язки.",
    icon: "customers",
    items: [
      {
        href: "/admin/shop/customers",
        label: "Клієнти",
        description: "Записи клієнтів магазину та стани акаунтів.",
        icon: "customers",
      },
      {
        href: "/admin/shop/customers/b2b-pricing",
        label: "B2B-знижки",
        description: "Знижки партнерам на бренди та перевірка ціни партнера.",
        icon: "pricing",
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
    description: "Товари, ціни, імпорти, структура та презентації.",
    icon: "catalog",
    items: [
      {
        href: "/admin/shop",
        label: "Товари",
        description: "Головний каталог товарів та стан мерчандайзингу.",
        icon: "catalog",
        exactMatch: true,
      },
      {
        href: "/admin/shop/pricing",
        label: "Ціни",
        description: "Керування B2C та B2B цінами.",
        icon: "pricing",
      },
      {
        href: "/admin/shop/import",
        label: "Центр імпортів",
        description: "CSV-імпорти, тестові прогони та результати.",
        icon: "imports",
      },
      {
        href: "/admin/shop/quality",
        label: "Інструменти каталогу",
        description: "Медіа, якість, сумісність та SEO в одному робочому центрі.",
        icon: "tools",
      },
      {
        href: "/admin/shop/categories",
        label: "Категорії",
        description: "Структурована таксономія каталогу.",
        icon: "categories",
      },
      {
        href: "/admin/shop/category-groups",
        label: "Групи товарів",
        description: "Назви, порядок і видимість груп у фільтрі каталогу.",
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
        href: "/admin/shop/wheelforce-wheelsets",
        label: "Набори дисків WheelForce",
        description: "Комплекти дисків 2+2 за сумісністю з автомобілем, без шин.",
        icon: "bundles",
        requiredPermissions: [ADMIN_PERMISSIONS.SHOP_PRODUCTS_WRITE],
      },
      {
        href: "/admin/shop/catalogs",
        label: "Презентаційні каталоги",
        description: "Збірка красивих PDF-презентацій з вибраних товарів та цін.",
        icon: "drafts",
      },
    ],
  },
  {
    key: "logistics",
    label: "Склад і логістика",
    description: "Залишки, склади, зони доставки та податки.",
    icon: "logistics",
    items: [
      {
        href: "/admin/shop/inventory",
        label: "Склад",
        description: "Залишки варіантів, кількості, готовність складу.",
        icon: "inventory",
      },
      {
        href: "/admin/shop/logistics",
        label: "Склади та зони",
        description: "Налаштування складів та географія доставки.",
        icon: "logistics",
        exactMatch: true,
      },
      {
        href: "/admin/shop/logistics/brand-rules",
        label: "Доставка за брендами",
        description: "Фіксовані суми та окремі тарифи для кожної зони доставки.",
        icon: "logistics",
      },
      {
        href: "/admin/shop/logistics/taxes",
        label: "Регіональні податки",
        description: "Податкові правила за регіонами доставки.",
        icon: "taxes",
      },
      {
        href: "/admin/shop/logistics/landed-cost",
        label: "Європа · landed cost",
        description: "DDP, DAP, мито, brokerage та preview фінальної ціни.",
        icon: "taxes",
      },
      {
        href: "/admin/shop/logistics/shipping-lab",
        label: "Демо-чекаут доставки",
        description: "Live-перевірка брендів, ZIP, ваги та тимчасових тарифів без збереження.",
        icon: "logistics",
      },
    ],
  },
  {
    key: "marketing",
    label: "Маркетинг і контент",
    description: "Промокоди, email-автоматизація та блог.",
    icon: "tag",
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
      {
        href: "/admin/blog",
        label: "Блог",
        description: "Редакційні матеріали та робочий процес публікації.",
        icon: "blog",
      },
    ],
  },
  {
    key: "system",
    label: "Адміністрування",
    description: "Налаштування системи та команди.",
    icon: "settings",
    items: [
      {
        href: "/admin/settings",
        label: "Налаштування",
        description: "Глобальні параметри, магазин та службові інструменти.",
        icon: "settings",
      },
      {
        href: "/admin/users",
        label: "Команда та доступи",
        description: "Користувачі, ролі, права та Telegram.",
        icon: "users",
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
  "/admin/shop/customers/b2b-pricing": [ADMIN_PERMISSIONS.SHOP_CUSTOMERS_READ],
  "/admin/shop/customers/segments": [ADMIN_PERMISSIONS.SHOP_CUSTOMERS_READ],
  "/admin/crm": [ADMIN_PERMISSIONS.SHOP_CUSTOMERS_READ],
  "/admin/shop": [ADMIN_PERMISSIONS.SHOP_PRODUCTS_READ],
  "/admin/shop/inventory": [ADMIN_PERMISSIONS.SHOP_INVENTORY_READ],
  "/admin/shop/categories": [ADMIN_PERMISSIONS.SHOP_CATEGORIES_READ],
  "/admin/shop/category-groups": [ADMIN_PERMISSIONS.SHOP_CATEGORIES_READ],
  "/admin/shop/collections": [ADMIN_PERMISSIONS.SHOP_COLLECTIONS_READ],
  "/admin/shop/bundles": [ADMIN_PERMISSIONS.SHOP_PRODUCTS_READ],
  "/admin/shop/catalogs": [ADMIN_PERMISSIONS.SHOP_PRODUCTS_READ],
  "/admin/shop/media": [ADMIN_PERMISSIONS.SHOP_PRODUCTS_READ],
  "/admin/shop/quality": [ADMIN_PERMISSIONS.SHOP_PRODUCTS_READ],
  "/admin/shop/fitment": [ADMIN_PERMISSIONS.SHOP_PRODUCTS_READ],
  "/admin/shop/ai-quality": [ADMIN_PERMISSIONS.SHOP_AI_READ],
  "/admin/shop/pricing": [ADMIN_PERMISSIONS.SHOP_PRICING_READ],
  "/admin/shop/seo": [ADMIN_PERMISSIONS.SHOP_PRODUCTS_WRITE],
  "/admin/shop/import": [ADMIN_PERMISSIONS.SHOP_IMPORTS_MANAGE],
  "/admin/shop/stock": [ADMIN_PERMISSIONS.SHOP_IMPORTS_MANAGE],
  "/admin/shop/feed": [ADMIN_PERMISSIONS.SHOP_PRODUCTS_READ],
  "/admin/shop/audit": [ADMIN_PERMISSIONS.SHOP_AUDIT_READ],
  "/admin/shop/logistics": [ADMIN_PERMISSIONS.SHOP_SETTINGS_READ],
  "/admin/shop/logistics/taxes": [ADMIN_PERMISSIONS.SHOP_SETTINGS_READ],
  "/admin/shop/logistics/landed-cost": [ADMIN_PERMISSIONS.SHOP_SETTINGS_READ],
  "/admin/shop/logistics/brand-rules": [ADMIN_PERMISSIONS.SHOP_SETTINGS_READ],
  "/admin/shop/logistics/shipping-lab": [ADMIN_PERMISSIONS.SHOP_SETTINGS_READ],
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

/** Titles for admin pages that live under a nav item but are not nav items themselves. */
const ADMIN_PAGE_TITLES: Readonly<Record<string, string>> = {
  "/admin/shop/new": "Новий товар",
  "/admin/shop/media": "Медіатека",
  "/admin/shop/audit": "Журнал змін",
  "/admin/shop/feed": "Фіди дистриб’юторів",
  "/admin/shop/fitment": "Перевірка сумісності",
  "/admin/shop/seo": "SEO-генератор",
  "/admin/shop/stock": "Залишки постачальників",
  "/admin/shop/ai-quality": "One AI · якість",
  "/admin/shop/settings": "Налаштування магазину",
  "/admin/shop/pricing/simulator": "Симулятор цін",
  "/admin/shop/import/jobs": "Журнал імпорту",
  "/admin/shop/orders/create": "Нове замовлення",
  "/admin/shop/orders/new": "Нове замовлення",
  "/admin/settings/integrations": "Інтеграції",
  "/admin/backups": "Резервні копії",
  "/admin/thought-space": "Thought space",
  "/admin/operations/triage": "Разбор зависших",
};

export type AdminBreadcrumb = { label: string; href?: string };

function adminDetailLabel(pathname: string) {
  const lastSegment = pathname.split("/").filter(Boolean).at(-1);
  if (lastSegment === "new" || lastSegment === "create") return "Створення";
  if (lastSegment === "edit") return "Редагування";
  return "Деталі";
}

/** Section › page › detail trail for the shell header. The last crumb has no href. */
export function getAdminBreadcrumbs(
  pathname: string,
  sections: AdminNavSectionDefinition[] = ADMIN_NAV_SECTIONS
): AdminBreadcrumb[] {
  const titledPath = Object.keys(ADMIN_PAGE_TITLES)
    .filter((path) => pathname === path || pathname.startsWith(`${path}/`))
    .sort((left, right) => right.length - left.length)[0];
  const item = getAdminNavAccessItem(pathname, sections);

  const crumbs: AdminBreadcrumb[] = [];
  if (item) {
    const section = sections.find((candidate) => candidate.key === item.sectionKey);
    if (section && section.key !== "overview") crumbs.push({ label: section.label });
    crumbs.push({ label: item.label, href: item.href });
  }
  if (titledPath && (!item || titledPath.length > item.href.length)) {
    crumbs.push({ label: ADMIN_PAGE_TITLES[titledPath], href: titledPath });
  }
  const deepest = crumbs.at(-1)?.href;
  if (deepest && pathname !== deepest) crumbs.push({ label: adminDetailLabel(pathname) });

  const last = crumbs.at(-1);
  if (last) delete last.href;
  return crumbs;
}
