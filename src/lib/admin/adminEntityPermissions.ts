import { ADMIN_PERMISSIONS, type AdminPermission } from "@/lib/admin/adminPermissions";
import { currentAdminHasPermission, type CurrentAdminAccess } from "@/lib/admin/adminAccess";

export type AdminEntityAccessMode = "read" | "write";

type EntityPermissionPair = {
  read: AdminPermission;
  write: AdminPermission;
};

const ADMIN_ENTITY_PERMISSIONS: Readonly<Record<string, EntityPermissionPair>> = {
  "shop.product": {
    read: ADMIN_PERMISSIONS.SHOP_PRODUCTS_READ,
    write: ADMIN_PERMISSIONS.SHOP_PRODUCTS_WRITE,
  },
  "shop.discount": {
    read: ADMIN_PERMISSIONS.SHOP_PRODUCTS_READ,
    write: ADMIN_PERMISSIONS.SHOP_PRODUCTS_WRITE,
  },
  "shop.category": {
    read: ADMIN_PERMISSIONS.SHOP_CATEGORIES_READ,
    write: ADMIN_PERMISSIONS.SHOP_CATEGORIES_WRITE,
  },
  "shop.collection": {
    read: ADMIN_PERMISSIONS.SHOP_COLLECTIONS_READ,
    write: ADMIN_PERMISSIONS.SHOP_COLLECTIONS_WRITE,
  },
  "shop.inventory": {
    read: ADMIN_PERMISSIONS.SHOP_INVENTORY_READ,
    write: ADMIN_PERMISSIONS.SHOP_INVENTORY_WRITE,
  },
  "shop.order": {
    read: ADMIN_PERMISSIONS.SHOP_ORDERS_READ,
    write: ADMIN_PERMISSIONS.SHOP_ORDERS_WRITE,
  },
  "shop.draft": {
    read: ADMIN_PERMISSIONS.SHOP_ORDERS_READ,
    write: ADMIN_PERMISSIONS.SHOP_ORDERS_WRITE,
  },
  "shop.return": {
    read: ADMIN_PERMISSIONS.SHOP_ORDERS_READ,
    write: ADMIN_PERMISSIONS.SHOP_ORDERS_WRITE,
  },
  "shop.shipment": {
    read: ADMIN_PERMISSIONS.SHOP_ORDERS_READ,
    write: ADMIN_PERMISSIONS.SHOP_ORDERS_WRITE,
  },
  "shop.customer": {
    read: ADMIN_PERMISSIONS.SHOP_CUSTOMERS_READ,
    write: ADMIN_PERMISSIONS.SHOP_CUSTOMERS_WRITE,
  },
  "shop.segment": {
    read: ADMIN_PERMISSIONS.SHOP_CUSTOMERS_READ,
    write: ADMIN_PERMISSIONS.SHOP_CUSTOMERS_WRITE,
  },
  "shop.pricing": {
    read: ADMIN_PERMISSIONS.SHOP_PRICING_READ,
    write: ADMIN_PERMISSIONS.SHOP_PRICING_WRITE,
  },
  "crm.customer": {
    read: ADMIN_PERMISSIONS.SHOP_CUSTOMERS_READ,
    write: ADMIN_PERMISSIONS.SHOP_CUSTOMERS_WRITE,
  },
  "crm.order": {
    read: ADMIN_PERMISSIONS.SHOP_ORDERS_READ,
    write: ADMIN_PERMISSIONS.SHOP_ORDERS_WRITE,
  },
  "crm.order-item": {
    read: ADMIN_PERMISSIONS.SHOP_ORDERS_READ,
    write: ADMIN_PERMISSIONS.SHOP_ORDERS_WRITE,
  },
  "admin.user": {
    read: ADMIN_PERMISSIONS.ADMIN_USERS_MANAGE,
    write: ADMIN_PERMISSIONS.ADMIN_USERS_MANAGE,
  },
  "admin.role": {
    read: ADMIN_PERMISSIONS.ADMIN_USERS_MANAGE,
    write: ADMIN_PERMISSIONS.ADMIN_USERS_MANAGE,
  },
};

export function resolveAdminEntityPermission(
  entityType: string,
  mode: AdminEntityAccessMode
): AdminPermission | null {
  return ADMIN_ENTITY_PERMISSIONS[entityType]?.[mode] ?? null;
}

export function assertAdminEntityPermission(
  access: Pick<CurrentAdminAccess, "permissions">,
  entityType: string,
  mode: AdminEntityAccessMode
): AdminPermission {
  const requiredPermission = resolveAdminEntityPermission(entityType, mode);
  if (!requiredPermission) {
    throw new Error("UNSUPPORTED_ADMIN_ENTITY");
  }
  if (!currentAdminHasPermission(access, requiredPermission)) {
    throw new Error("FORBIDDEN");
  }
  return requiredPermission;
}
