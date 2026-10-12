export function formatOrderMoney(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("uk-UA", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

export function formatOrderDate(value: string | Date, withYear = false) {
  return new Date(value).toLocaleString("uk-UA", {
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Kyiv",
  });
}

/** «сьогодні», «вчора», «5 дн.» — how long something has been waiting. */
export function daysAgoLabel(value: string | Date, now = Date.now()) {
  const days = Math.floor((now - new Date(value).getTime()) / 86_400_000);
  if (days <= 0) return "сьогодні";
  if (days === 1) return "вчора";
  return `${days} дн. тому`;
}

export function daysSince(value: string | Date, now = Date.now()) {
  return Math.max(0, Math.floor((now - new Date(value).getTime()) / 86_400_000));
}

export function paymentTone(paymentStatus: string, outstanding: number) {
  if (paymentStatus === "PAID" || (outstanding === 0 && paymentStatus !== "UNPAID")) return "success" as const;
  if (paymentStatus === "PARTIALLY_PAID" || paymentStatus === "PENDING") return "warning" as const;
  if (paymentStatus === "REFUNDED" || paymentStatus === "PARTIALLY_REFUNDED") return "danger" as const;
  return "default" as const;
}
