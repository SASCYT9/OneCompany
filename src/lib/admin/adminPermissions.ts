export const ADMIN_PERMISSIONS = {
  ADMIN_DASHBOARD_READ: "admin.dashboard.read",
  ADMIN_USERS_MANAGE: "admin.users.manage",
  SHOP_PRODUCTS_READ: "shop.products.read",
  SHOP_PRODUCTS_WRITE: "shop.products.write",
  SHOP_CUSTOMERS_READ: "shop.customers.read",
  SHOP_CUSTOMERS_WRITE: "shop.customers.write",
  SHOP_CATEGORIES_READ: "shop.categories.read",
  SHOP_CATEGORIES_WRITE: "shop.categories.write",
  SHOP_COLLECTIONS_READ: "shop.collections.read",
  SHOP_COLLECTIONS_WRITE: "shop.collections.write",
  SHOP_IMPORTS_MANAGE: "shop.imports.manage",
  SHOP_PRICING_READ: "shop.pricing.read",
  SHOP_PRICING_WRITE: "shop.pricing.write",
  SHOP_INVENTORY_READ: "shop.inventory.read",
  SHOP_INVENTORY_WRITE: "shop.inventory.write",
  SHOP_ORDERS_READ: "shop.orders.read",
  SHOP_ORDERS_WRITE: "shop.orders.write",
  SHOP_SETTINGS_READ: "shop.settings.read",
  SHOP_SETTINGS_WRITE: "shop.settings.write",
  SHOP_AUDIT_READ: "shop.audit.read",
  SHOP_AI_READ: "shop.ai.read",
  SHOP_AI_REVIEW: "shop.ai.review",
  SHOP_AI_MANAGE: "shop.ai.manage",
  OPS_TASKS_READ: "ops.tasks.read",
  OPS_TASKS_WRITE: "ops.tasks.write",
  OPS_TASKS_ASSIGN: "ops.tasks.assign",
  OPS_KNOWLEDGE_READ: "ops.knowledge.read",
  OPS_KNOWLEDGE_WRITE: "ops.knowledge.write",
  OPS_KNOWLEDGE_PUBLISH: "ops.knowledge.publish",
  OPS_INBOX_READ: "ops.inbox.read",
  OPS_INBOX_REVIEW: "ops.inbox.review",
  OPS_AUTOMATION_RUN: "ops.automation.run",
  OPS_APPROVALS_DECIDE: "ops.approvals.decide",
  OPS_SYSTEM_MANAGE: "ops.system.manage",
} as const;

export const SUPERADMIN_ROLE_KEY = "superadmin";
export const OWNER_ROLE_KEY = "owner";

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[keyof typeof ADMIN_PERMISSIONS];

export type AdminRoleTemplate = {
  key: string;
  name: string;
  permissions: readonly (AdminPermission | "*")[];
};

export const ADMIN_ROLE_TEMPLATES = {
  owner: {
    key: OWNER_ROLE_KEY,
    name: "Owner",
    permissions: ["*"],
  },
  task_member: {
    key: "task_member",
    name: "Task member",
    permissions: [
      ADMIN_PERMISSIONS.OPS_TASKS_READ,
      ADMIN_PERMISSIONS.OPS_TASKS_WRITE,
      ADMIN_PERMISSIONS.OPS_KNOWLEDGE_READ,
    ],
  },
  task_manager: {
    key: "task_manager",
    name: "Task manager",
    permissions: [
      ADMIN_PERMISSIONS.OPS_TASKS_READ,
      ADMIN_PERMISSIONS.OPS_TASKS_WRITE,
      ADMIN_PERMISSIONS.OPS_TASKS_ASSIGN,
      ADMIN_PERMISSIONS.OPS_KNOWLEDGE_READ,
      ADMIN_PERMISSIONS.OPS_KNOWLEDGE_PUBLISH,
      ADMIN_PERMISSIONS.OPS_INBOX_READ,
      ADMIN_PERMISSIONS.OPS_INBOX_REVIEW,
      ADMIN_PERMISSIONS.OPS_AUTOMATION_RUN,
    ],
  },
  knowledge_editor: {
    key: "knowledge_editor",
    name: "Knowledge editor",
    permissions: [ADMIN_PERMISSIONS.OPS_KNOWLEDGE_READ, ADMIN_PERMISSIONS.OPS_KNOWLEDGE_WRITE],
  },
  knowledge_publisher: {
    key: "knowledge_publisher",
    name: "Knowledge publisher",
    permissions: [
      ADMIN_PERMISSIONS.OPS_KNOWLEDGE_READ,
      ADMIN_PERMISSIONS.OPS_KNOWLEDGE_WRITE,
      ADMIN_PERMISSIONS.OPS_KNOWLEDGE_PUBLISH,
    ],
  },
  catalog_editor: {
    key: "catalog_editor",
    name: "Catalog editor",
    permissions: [
      ADMIN_PERMISSIONS.SHOP_PRODUCTS_READ,
      ADMIN_PERMISSIONS.SHOP_PRODUCTS_WRITE,
      ADMIN_PERMISSIONS.SHOP_CATEGORIES_READ,
      ADMIN_PERMISSIONS.SHOP_COLLECTIONS_READ,
    ],
  },
} as const satisfies Record<string, AdminRoleTemplate>;

export function getAdminRoleTemplate(key: string): AdminRoleTemplate | null {
  return Object.values(ADMIN_ROLE_TEMPLATES).find((role) => role.key === key) ?? null;
}

export function matchesAdminPermission(
  grantedPermissions: readonly string[],
  requiredPermission: string
): boolean {
  return grantedPermissions.some((permission) => {
    if (permission === "*" || permission === requiredPermission) {
      return true;
    }

    if (permission.endsWith(".*")) {
      const prefix = permission.slice(0, -1);
      return requiredPermission.startsWith(prefix);
    }

    return false;
  });
}
