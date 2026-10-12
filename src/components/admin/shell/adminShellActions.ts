import {
  FilePlus2,
  FileText,
  FolderPlus,
  PackagePlus,
  Tag,
  Undo2,
  UserPlus,
  type LucideIcon,
} from "lucide-react";

export type AdminShellAction = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  /** Extra words the command palette matches on. */
  keywords?: string;
};

/** "Створити" menu and palette actions; the shell filters them by route access. */
export const ADMIN_CREATE_ACTIONS: AdminShellAction[] = [
  {
    href: "/admin/shop/orders/create",
    label: "Замовлення",
    description: "Ручне B2B/B2C замовлення з каталогу",
    icon: FilePlus2,
    keywords: "order нове замовлення b2b",
  },
  {
    href: "/admin/shop/drafts/new",
    label: "Проформа / котирування",
    description: "Чернетка для клієнта з цінами",
    icon: FileText,
    keywords: "proforma quote draft рахунок",
  },
  {
    href: "/admin/shop/new",
    label: "Товар",
    description: "Нова позиція каталогу",
    icon: PackagePlus,
    keywords: "product sku новий товар",
  },
  {
    href: "/admin/shop/customers/new",
    label: "Клієнт",
    description: "B2C або B2B акаунт",
    icon: UserPlus,
    keywords: "customer client новий клієнт",
  },
  {
    href: "/admin/shop/discounts/new",
    label: "Промокод",
    description: "Знижка, BOGO або B2B-кампанія",
    icon: Tag,
    keywords: "discount promo coupon",
  },
  {
    href: "/admin/shop/returns/new",
    label: "Повернення / RMA",
    description: "Запит на повернення по замовленню",
    icon: Undo2,
    keywords: "return rma",
  },
  {
    href: "/admin/shop/collections/new",
    label: "Колекція",
    description: "Маркетингова добірка товарів",
    icon: FolderPlus,
    keywords: "collection",
  },
];
