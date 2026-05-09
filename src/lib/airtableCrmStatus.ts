import type { SupportedLocale } from '@/lib/seo';

/**
 * Normalized CRM order status. The Airtable column is free-form Russian text
 * ("Выполнен", "Отменен", etc.) — we map it once here so UI components don't
 * pattern-match on raw localized strings.
 */
export type CrmOrderStatus = 'completed' | 'cancelled' | 'in_progress' | 'unknown';

const RAW_TO_STATUS: Record<string, CrmOrderStatus> = {
  // Russian (Airtable canonical)
  'выполнен': 'completed',
  'выполнено': 'completed',
  'завершен': 'completed',
  'завершено': 'completed',
  'оплачен': 'completed',
  'отменен': 'cancelled',
  'отменено': 'cancelled',
  'отменён': 'cancelled',
  'отказ': 'cancelled',
  'в работе': 'in_progress',
  'в обработке': 'in_progress',
  'ожидание': 'in_progress',
  'оформляется': 'in_progress',
  // Ukrainian (in case someone changes Airtable formula)
  'виконано': 'completed',
  'завершено ua': 'completed',
  'скасовано': 'cancelled',
  'у роботі': 'in_progress',
  'обробляється': 'in_progress',
  // English fallbacks
  'completed': 'completed',
  'cancelled': 'cancelled',
  'canceled': 'cancelled',
  'in progress': 'in_progress',
  'pending': 'in_progress',
};

export function normalizeAirtableOrderStatus(raw: string | null | undefined): CrmOrderStatus {
  if (!raw) return 'unknown';
  const key = raw.trim().toLowerCase();
  return RAW_TO_STATUS[key] ?? 'unknown';
}

export function formatAirtableOrderStatus(
  status: CrmOrderStatus,
  locale: SupportedLocale,
  rawFallback?: string | null,
): string {
  const isUa = locale === 'ua';
  switch (status) {
    case 'completed':
      return isUa ? 'Виконано' : 'Completed';
    case 'cancelled':
      return isUa ? 'Скасовано' : 'Cancelled';
    case 'in_progress':
      return isUa ? 'В обробці' : 'In progress';
    default:
      // Fall back to whatever Airtable returned so admins can see new statuses.
      return rawFallback?.trim() || (isUa ? 'Невідомо' : 'Unknown');
  }
}

export function airtableOrderStatusBadgeClass(status: CrmOrderStatus): string {
  switch (status) {
    case 'completed':
      return 'border-emerald-500/20 text-emerald-400 bg-emerald-500/5';
    case 'cancelled':
      return 'border-red-500/20 text-red-400 bg-red-500/5';
    case 'in_progress':
      return 'border-amber-500/20 text-amber-400 bg-amber-500/5';
    default:
      return 'border-white/15 text-white/55 bg-white/5';
  }
}

/**
 * Balance "who owes" indicator. Replaces fragile substring matching against
 * Airtable's free-text label.
 */
export type CrmBalanceWho = 'client_owes' | 'we_owe' | 'balanced';

export function classifyCrmBalance(amount: number): CrmBalanceWho {
  if (amount === 0) return 'balanced';
  return amount < 0 ? 'client_owes' : 'we_owe';
}
