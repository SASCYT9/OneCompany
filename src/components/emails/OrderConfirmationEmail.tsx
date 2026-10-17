import { Column, Img, Row, Section, Text } from "@react-email/components";
import * as React from "react";
import {
  EmailButton,
  EmailCallout,
  EmailDivider,
  EmailEyebrow,
  EmailFacts,
  EmailHeading,
  EmailLabel,
  EmailShell,
  EmailText,
  emailColors,
  emailImageUrl,
  formatEmailMoney,
  type EmailLocale,
} from "./EmailLayout";

export type OrderConfirmationEmailProps = {
  orderNumber: string;
  customerName: string;
  email: string;
  currency: string;
  subtotal: number;
  shippingCost: number;
  taxAmount: number;
  total: number;
  landedCost?: {
    mode: "DDP" | "DAP" | "QUOTE";
    includedAmount: number;
    dueAtDeliveryAmount: number;
  } | null;
  locale: EmailLocale;
  viewOrderUrl: string;
  items: Array<{
    title: string;
    quantity: number;
    total: number;
    unitPrice?: number;
    sku?: string | null;
    brand?: string | null;
    image?: string | null;
    variantTitle?: string | null;
  }>;
  logoSrc?: string;
  internationalDelivery?: boolean;
  phone?: string | null;
  paymentMethod?: string | null;
  createdAt?: string | Date | null;
  discountAmount?: number | null;
  /** Regional price adjustment, signed — checkout's «Корекція ціни». */
  adjustmentAmount?: number | null;
  shippingAddress?: {
    line1?: string;
    line2?: string;
    city?: string;
    region?: string;
    postcode?: string;
    country?: string;
  } | null;
};

const copy = {
  ua: {
    preview: (order: string) => `Замовлення ${order} прийнято — дякуємо!`,
    eyebrow: "Замовлення прийнято",
    eyebrowQuote: "Запит прийнято",
    heading: "Дякуємо за замовлення",
    intro: (name: string, order: string) => `${name}, ми отримали ваше замовлення ${order}.`,
    nextTitle: "Що далі",
    next: {
      MANAGER_QUOTE:
        "Менеджер розрахує доставку й зв’яжеться з вами протягом 24 годин, щоб погодити загальну суму. Оплата — після погодження.",
      FOP: "Реквізити для оплати — на сторінці замовлення. Щойно оплата надійде, ми підтвердимо замовлення й повідомимо про відправку.",
      MONOBANK:
        "Оплата карткою через plata by mono. Щойно банк підтвердить платіж, ми почнемо обробку замовлення.",
      WHITEPAY: "Щойно Whitepay підтвердить платіж, ми почнемо обробку замовлення.",
      default: "Менеджер зв’яжеться з вами, щоб підтвердити деталі замовлення.",
    },
    order: "Замовлення",
    date: "Дата",
    payment: "Оплата",
    paymentMethods: {
      FOP: "Переказ за реквізитами",
      MONOBANK: "Картка · plata by mono",
      WHITEBIT: "Криптовалюта · Whitepay",
      WHITEPAY_CRYPTO: "Криптовалюта · Whitepay",
      WHITEPAY_FIAT: "Картка · Whitepay",
      MANAGER_QUOTE: "Після погодження суми",
    } as Record<string, string>,
    items: "Товари",
    subtotal: "Товари",
    shipping: "Доставка",
    shippingAgreed: "Узгоджує менеджер",
    shippingFree: "Безкоштовно",
    discount: "Знижка",
    adjustment: "Корекція ціни",
    tax: "Податки",
    total: "Разом",
    totalBeforeShipping: "Разом без доставки",
    landed: { DDP: "Імпортні витрати (DDP)", DAP: "Імпорт при доставці (DAP)", QUOTE: "Імпортні витрати" },
    landedQuote: "після підтвердження",
    recipient: "Отримувач",
    address: "Адреса доставки",
    view: "Переглянути замовлення",
  },
  en: {
    preview: (order: string) => `Order ${order} received — thank you!`,
    eyebrow: "Order received",
    eyebrowQuote: "Request received",
    heading: "Thank you for your order",
    intro: (name: string, order: string) => `${name}, we have received your order ${order}.`,
    nextTitle: "What happens next",
    next: {
      MANAGER_QUOTE:
        "A manager will calculate shipping and contact you within 24 hours to agree the final total. You pay once it is agreed.",
      FOP: "Payment details are on your order page. As soon as the payment arrives we confirm the order and let you know when it ships.",
      MONOBANK: "Card payment via plata by mono. Once the bank confirms it, we start processing your order.",
      WHITEPAY: "Once Whitepay confirms the payment, we start processing your order.",
      default: "A manager will contact you to confirm the details of your order.",
    },
    order: "Order",
    date: "Date",
    payment: "Payment",
    paymentMethods: {
      FOP: "Bank transfer",
      MONOBANK: "Card · plata by mono",
      WHITEBIT: "Crypto · Whitepay",
      WHITEPAY_CRYPTO: "Crypto · Whitepay",
      WHITEPAY_FIAT: "Card · Whitepay",
      MANAGER_QUOTE: "After the total is agreed",
    } as Record<string, string>,
    items: "Items",
    subtotal: "Items",
    shipping: "Shipping",
    shippingAgreed: "To be agreed with a manager",
    shippingFree: "Free",
    discount: "Discount",
    adjustment: "Price adjustment",
    tax: "Taxes",
    total: "Total",
    totalBeforeShipping: "Total before shipping",
    landed: { DDP: "Import charges (DDP)", DAP: "Import at delivery (DAP)", QUOTE: "Import charges" },
    landedQuote: "after confirmation",
    recipient: "Recipient",
    address: "Delivery address",
    view: "View order",
  },
};

function nextStep(locale: EmailLocale, paymentMethod: string | null | undefined, international: boolean) {
  const next = copy[locale].next;
  if (international || paymentMethod === "MANAGER_QUOTE") return next.MANAGER_QUOTE;
  if (paymentMethod === "FOP") return next.FOP;
  if (paymentMethod === "MONOBANK") return next.MONOBANK;
  if (paymentMethod?.startsWith("WHITE")) return next.WHITEPAY;
  return next.default;
}

function formatDate(value: string | Date | null | undefined, locale: EmailLocale) {
  const date = value ? new Date(value) : new Date();
  return date.toLocaleDateString(locale === "ua" ? "uk-UA" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Kyiv",
  });
}

export const OrderConfirmationEmail = ({
  orderNumber,
  customerName,
  email,
  currency,
  subtotal,
  shippingCost,
  taxAmount,
  total,
  landedCost,
  locale,
  viewOrderUrl,
  items,
  internationalDelivery = false,
  phone,
  paymentMethod,
  createdAt,
  discountAmount,
  adjustmentAmount,
  shippingAddress,
}: OrderConfirmationEmailProps) => {
  const t = copy[locale];
  const money = (value: number) => formatEmailMoney(value, currency, locale);
  const method = internationalDelivery ? "MANAGER_QUOTE" : paymentMethod;
  const addressLines = [
    shippingAddress?.line1,
    shippingAddress?.line2,
    [shippingAddress?.postcode, shippingAddress?.city].filter(Boolean).join(" "),
    // Kyiv the city is also Kyiv the region; name it once.
    shippingAddress?.region?.trim().toLowerCase() === shippingAddress?.city?.trim().toLowerCase()
      ? undefined
      : shippingAddress?.region,
    shippingAddress?.country,
  ].filter((line): line is string => Boolean(line && line.trim()));
  const adjustment = adjustmentAmount ?? 0;
  const totals: Array<[string, string]> = [[t.subtotal, money(subtotal)]];
  if (adjustment !== 0)
    totals.push([t.adjustment, adjustment > 0 ? `+${money(adjustment)}` : `−${money(-adjustment)}`]);
  totals.push([
    t.shipping,
    internationalDelivery ? t.shippingAgreed : shippingCost > 0 ? money(shippingCost) : t.shippingFree,
  ]);
  if (discountAmount && discountAmount > 0) totals.push([t.discount, `−${money(discountAmount)}`]);
  if (landedCost && !internationalDelivery) {
    totals.push([
      t.landed[landedCost.mode],
      landedCost.mode === "QUOTE"
        ? t.landedQuote
        : money(landedCost.mode === "DDP" ? landedCost.includedAmount : landedCost.dueAtDeliveryAmount),
    ]);
  } else if (taxAmount > 0 && !internationalDelivery) {
    // Abroad, tax is settled with the shipping agreement, like on the thank-you page.
    totals.push([t.tax, money(taxAmount)]);
  }

  return (
    <EmailShell locale={locale} preview={t.preview(orderNumber)}>
      <EmailEyebrow>{internationalDelivery ? t.eyebrowQuote : t.eyebrow}</EmailEyebrow>
      <EmailHeading>{t.heading}</EmailHeading>
      <EmailText muted>{t.intro(customerName, orderNumber)}</EmailText>
      <EmailCallout title={t.nextTitle}>{nextStep(locale, method, internationalDelivery)}</EmailCallout>

      <EmailFacts
        facts={[
          { label: t.order, value: orderNumber },
          { label: t.date, value: formatDate(createdAt, locale) },
          ...(method ? [{ label: t.payment, value: t.paymentMethods[method] ?? method }] : []),
        ]}
      />
      <EmailDivider />

      <EmailLabel>{t.items}</EmailLabel>
      {items.map((item, index) => {
        const image = emailImageUrl(item.image);
        const details = [item.brand, item.sku].filter(Boolean).join(" · ");
        return (
          <Row key={`${item.title}-${index}`} style={styles.itemRow}>
            {image ? (
              <Column style={styles.thumbCell} valign="top">
                <Img src={image} width="64" height="64" alt="" style={styles.thumb} />
              </Column>
            ) : null}
            <Column valign="top" style={styles.itemText}>
              <Text style={styles.itemTitle}>{item.title}</Text>
              {item.variantTitle ? <Text style={styles.itemMeta}>{item.variantTitle}</Text> : null}
              {details ? <Text style={styles.itemMeta}>{details}</Text> : null}
              <Text style={styles.itemMeta}>
                {item.quantity} × {money(item.unitPrice ?? item.total / Math.max(1, item.quantity))}
              </Text>
            </Column>
            <Column valign="top" align="right" style={styles.itemTotalCell}>
              <Text style={styles.itemTotal}>{money(item.total)}</Text>
            </Column>
          </Row>
        );
      })}

      <Section style={styles.totals}>
        {totals.map(([label, value]) => (
          <Row key={label}>
            <Column>
              <Text style={styles.totalLabel}>{label}</Text>
            </Column>
            <Column align="right">
              <Text style={styles.totalValue}>{value}</Text>
            </Column>
          </Row>
        ))}
        <Row style={styles.grandRow}>
          <Column>
            <Text style={styles.grandLabel}>
              {internationalDelivery ? t.totalBeforeShipping : t.total}
            </Text>
          </Column>
          <Column align="right">
            <Text style={styles.grandValue}>
              {money(internationalDelivery ? subtotal + adjustment : total)}
            </Text>
          </Column>
        </Row>
      </Section>

      <EmailDivider />
      <Row>
        <Column valign="top" style={styles.halfColumn}>
          <EmailLabel>{t.recipient}</EmailLabel>
          <Text style={styles.addressText}>{customerName}</Text>
          {phone ? <Text style={styles.addressText}>{phone}</Text> : null}
          <Text style={styles.addressText}>{email}</Text>
        </Column>
        {addressLines.length ? (
          <Column valign="top" style={styles.halfColumn}>
            <EmailLabel>{t.address}</EmailLabel>
            {addressLines.map((line) => (
              <Text key={line} style={styles.addressText}>
                {line}
              </Text>
            ))}
          </Column>
        ) : null}
      </Row>

      <EmailButton href={viewOrderUrl}>{t.view}</EmailButton>
    </EmailShell>
  );
};

export default OrderConfirmationEmail;

const styles = {
  itemRow: { borderBottom: `1px solid ${emailColors.line}`, padding: "14px 0" },
  thumbCell: { width: "76px", paddingRight: "12px" },
  thumb: {
    backgroundColor: "#ffffff",
    border: `1px solid ${emailColors.line}`,
    display: "block",
    objectFit: "contain" as const,
  },
  itemText: { paddingRight: "8px" },
  itemTitle: { color: emailColors.text, fontSize: "14px", lineHeight: "20px", margin: "0 0 4px" },
  itemMeta: { color: emailColors.muted, fontSize: "12px", lineHeight: "18px", margin: "0" },
  itemTotalCell: { width: "1%" },
  itemTotal: { color: emailColors.text, fontSize: "14px", lineHeight: "20px", margin: "0", whiteSpace: "nowrap" as const },
  totals: { padding: "16px 0 0" },
  totalLabel: { color: emailColors.muted, fontSize: "14px", lineHeight: "20px", margin: "0 0 8px" },
  totalValue: { color: emailColors.text, fontSize: "14px", lineHeight: "20px", margin: "0 0 8px", textAlign: "right" as const },
  grandRow: { borderTop: `1px solid ${emailColors.line}` },
  grandLabel: { color: emailColors.text, fontSize: "15px", fontWeight: "600", margin: "14px 0 0" },
  grandValue: { color: emailColors.text, fontSize: "22px", fontWeight: "300", margin: "10px 0 0", textAlign: "right" as const, whiteSpace: "nowrap" as const },
  halfColumn: { width: "50%", paddingRight: "12px" },
  addressText: { color: emailColors.text, fontSize: "14px", lineHeight: "21px", margin: "0" },
};
