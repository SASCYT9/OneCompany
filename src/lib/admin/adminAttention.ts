/**
 * "Needs attention" counters for the admin shell: sidebar badges and the bell.
 * The route handler fills only the counters the current admin may read; the rest
 * stay null so the shell never hints at data outside the user's permissions.
 */
export type AdminAttentionCounts = {
  ordersToReview: number | null;
  unpaidHighValueOrders: number | null;
  returnsRequested: number | null;
  newMessages: number | null;
  b2bPending: number | null;
  failedImportsRecent: number | null;
};

export type AdminAttentionItem = {
  id: keyof AdminAttentionCounts;
  tone: "red" | "amber";
  label: string;
  detail: string;
  href: string;
  count: number;
};

/** Window for "recent" import failures; older failures are history, not a to-do. */
export const ADMIN_ATTENTION_IMPORT_WINDOW_DAYS = 7;

const ATTENTION_DEFINITIONS: Array<{
  id: keyof AdminAttentionCounts;
  tone: AdminAttentionItem["tone"];
  label: string;
  detail: string;
  href: string;
  /** Show the counter as a sidebar badge on `href`. */
  badge: boolean;
}> = [
  {
    id: "ordersToReview",
    tone: "red",
    label: "Нові замовлення на перевірці",
    detail: "За останні 30 днів — підтвердіть або уточніть деталі з клієнтом.",
    href: "/admin/shop/orders",
    badge: true,
  },
  {
    id: "unpaidHighValueOrders",
    tone: "amber",
    label: "Великі неоплачені замовлення",
    detail: "Замовлення від 1 000 за 30 днів з непогашеним залишком.",
    href: "/admin/shop/orders",
    badge: false,
  },
  {
    id: "newMessages",
    tone: "amber",
    label: "Нові повідомлення з сайту",
    detail: "Форми зв’язку, на які ще ніхто не відповів.",
    href: "/admin/messages",
    badge: true,
  },
  {
    id: "returnsRequested",
    tone: "amber",
    label: "Нові запити на повернення",
    detail: "RMA очікують рішення.",
    href: "/admin/shop/returns",
    badge: true,
  },
  {
    id: "b2bPending",
    tone: "amber",
    label: "B2B-заявки на розгляді",
    detail: "Акаунти чекають схвалення або відмови.",
    href: "/admin/shop/customers",
    badge: true,
  },
  {
    id: "failedImportsRecent",
    tone: "red",
    label: "Невдалі імпорти",
    detail: `Помилки імпорту за останні ${ADMIN_ATTENTION_IMPORT_WINDOW_DAYS} днів.`,
    href: "/admin/shop/import",
    badge: true,
  },
];

export function buildAdminAttentionItems(counts: AdminAttentionCounts): AdminAttentionItem[] {
  return ATTENTION_DEFINITIONS.flatMap((definition) => {
    const count = counts[definition.id];
    if (!count || count <= 0) return [];
    return [
      {
        id: definition.id,
        tone: definition.tone,
        label: definition.label,
        detail: definition.detail,
        href: definition.href,
        count,
      },
    ];
  });
}

/** Sidebar badge counts keyed by nav href. Several counters may share one href. */
export function buildAdminNavBadges(counts: AdminAttentionCounts): Record<string, number> {
  const badges: Record<string, number> = {};
  for (const definition of ATTENTION_DEFINITIONS) {
    const count = counts[definition.id];
    if (!definition.badge || !count || count <= 0) continue;
    badges[definition.href] = (badges[definition.href] ?? 0) + count;
  }
  return badges;
}
