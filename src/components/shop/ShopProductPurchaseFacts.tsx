import Link from "next/link";
import { CreditCard, MessageCircle, PackageCheck, RotateCcw, Timer, Truck } from "lucide-react";
import type { ReactNode } from "react";
import type { SupportedLocale } from "@/lib/seo";
import type { ShopConfirmedAvailability } from "@/lib/shopWarehouseInventory";
import {
  DEFAULT_BACKORDER_LEAD_DAYS,
  isShopLeadTimeOnRequest,
  parseLeadTimeDays,
} from "@/lib/shopGoogleAvailability";
import { buildProductInquiryHref } from "@/lib/shopProductInquiry";

type Props = {
  locale: SupportedLocale;
  availability: ShopConfirmedAvailability | null | undefined;
  leadTime?: { ua?: string | null; en?: string | null } | null;
  /** Explicit expected shipping date (ISO), set by a manager or the supplier feed. */
  availabilityDate?: string | null;
  /** Opens the contact page with this product already filled in. */
  productSlug?: string;
  variantId?: string | null;
  className?: string;
};

function formatShippingDate(value: string | null | undefined, locale: SupportedLocale) {
  const day = value?.slice(0, 10) ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const [year, month, date] = day.split("-");
  return locale === "ua" ? `${date}.${month}.${year}` : day;
}

function lowerFirst(value: string) {
  return value.charAt(0).toLocaleLowerCase("uk-UA") + value.slice(1);
}

function Fact({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-start gap-3 py-2.5">
      <span aria-hidden="true" className="mt-0.5 shrink-0 opacity-55">
        {icon}
      </span>
      <span className="min-w-0">{children}</span>
    </li>
  );
}

const linkClassName =
  "underline decoration-current/30 underline-offset-4 transition hover:decoration-current";

/**
 * Delivery, payment, returns and contact facts under the buy button. Every
 * statement mirrors the public /delivery and /refund pages; keep them in sync.
 */
export function ShopProductPurchaseFacts({
  locale,
  availability,
  leadTime,
  availabilityDate,
  productSlug,
  variantId,
  className = "",
}: Props) {
  const isUa = locale === "ua";
  const iconClassName = "h-4 w-4";
  const leadTimeText = (isUa ? leadTime?.ua : leadTime?.en)?.trim() ?? "";
  const shippingDate = formatShippingDate(availabilityDate, locale);

  let availabilityLabel: string;
  let availabilityNote: string;
  if (availability === "inStock") {
    availabilityLabel = isUa ? "В наявності" : "In stock";
    availabilityNote = isUa ? "готово до відправлення" : "ready to ship";
  } else if (availability === "inTransit") {
    availabilityLabel = isUa ? "В дорозі на склад" : "On its way to our warehouse";
    availabilityNote = isUa
      ? "дату відправлення підтвердить менеджер"
      : "your manager will confirm the shipping date";
  } else {
    availabilityLabel = isUa ? "Під замовлення" : "Made to order";
    availabilityNote = shippingDate
      ? isUa
        ? `відправлення орієнтовно ${shippingDate}`
        : `expected to ship around ${shippingDate}`
      : isShopLeadTimeOnRequest(leadTimeText)
        ? isUa
          ? "термін уточнюйте у менеджера"
          : "ask your manager for the lead time"
        : parseLeadTimeDays(leadTimeText) !== null
          ? lowerFirst(leadTimeText)
          : isUa
            ? `у середньому ${DEFAULT_BACKORDER_LEAD_DAYS} день, індивідуальні вироби — довше`
            : `about ${DEFAULT_BACKORDER_LEAD_DAYS} days on average, longer for items made individually`;
  }

  return (
    <ul
      aria-label={isUa ? "Доставка, оплата та повернення" : "Delivery, payment and returns"}
      className={`divide-y divide-current/10 rounded-2xl border border-current/12 px-4 py-1 text-[13px] leading-snug ${className}`}
    >
      <Fact
        icon={
          availability === "inStock" ? (
            <PackageCheck className={iconClassName} />
          ) : (
            <Timer className={iconClassName} />
          )
        }
      >
        <strong className="font-medium">{availabilityLabel}</strong>
        <span className="opacity-75"> — {availabilityNote}</span>
      </Fact>
      <Fact icon={<Truck className={iconClassName} />}>
        <span className="opacity-75">
          {isUa
            ? "Нова пошта по Україні, DHL Express за кордон. "
            : "Nova Poshta across Ukraine, DHL Express abroad. "}
        </span>
        <Link href={`/${locale}/delivery`} className={linkClassName}>
          {isUa ? "Доставка й оплата" : "Delivery & payment"}
        </Link>
      </Fact>
      <Fact icon={<CreditCard className={iconClassName} />}>
        <span className="opacity-75">
          {isUa
            ? "Оплата карткою онлайн: Visa, Mastercard, Apple Pay, Google Pay. Для B2B — за рахунком."
            : "Pay online by card: Visa, Mastercard, Apple Pay, Google Pay. B2B: by invoice."}
        </span>
      </Fact>
      <Fact icon={<RotateCcw className={iconClassName} />}>
        <span className="opacity-75">
          {availability === "inStock"
            ? isUa
              ? "Обмін і повернення — 14 днів, зворотна доставка за рахунок покупця. "
              : "Exchange and returns within 14 days; the customer pays return shipping. "
            : isUa
              ? "Товар під замовлення привозимо спеціально для вас, тому він не підлягає поверненню, крім браку. "
              : "Made-to-order items are brought in specially for you and cannot be returned, except for defects. "}
        </span>
        <Link href={`/${locale}/refund`} className={linkClassName}>
          {isUa ? "Умови" : "Terms"}
        </Link>
      </Fact>
      <Fact icon={<MessageCircle className={iconClassName} />}>
        <span className="opacity-75">
          {isUa ? "Питання щодо товару? " : "Questions about this product? "}
        </span>
        <Link
          href={
            productSlug
              ? buildProductInquiryHref(locale, productSlug, variantId)
              : `/${locale}/contact`
          }
          // Per-product inquiry URLs are copies of /contact, not pages to crawl.
          rel={productSlug ? "nofollow" : undefined}
          className={linkClassName}
        >
          {isUa ? "Написати менеджеру" : "Contact a manager"}
        </Link>
      </Fact>
    </ul>
  );
}
