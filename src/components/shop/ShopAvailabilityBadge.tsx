import type { SupportedLocale } from "@/lib/seo";
import type { ShopConfirmedAvailability } from "@/lib/shopWarehouseInventory";
import { EventuriAvailabilityBadge } from "./EventuriAvailabilityBadge";

export function ShopAvailabilityBadge({
  availability,
  locale,
  compact = false,
}: {
  availability: ShopConfirmedAvailability | null | undefined;
  locale: SupportedLocale;
  compact?: boolean;
}) {
  if (availability !== "inStock") return null;
  return <EventuriAvailabilityBadge locale={locale} compact={compact} />;
}
