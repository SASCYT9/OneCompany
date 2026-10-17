import { Column, Img, Row, Section, Text } from "@react-email/components";
import * as React from "react";
import {
  EmailButton,
  EmailDivider,
  EmailEyebrow,
  EmailHeading,
  EmailLabel,
  EmailShell,
  EmailText,
  emailColors,
  emailImageUrl,
  formatEmailMoney,
  type EmailLocale,
} from "./EmailLayout";

export type AbandonedCartEmailProps = {
  locale: EmailLocale;
  firstName?: string | null;
  currency: string;
  items: Array<{
    title: string;
    variantTitle?: string | null;
    quantity: number;
    image?: string | null;
    /** Line total in `currency`; omitted for price-on-request items. */
    lineTotal?: number | null;
  }>;
  /** Restores this exact cart on any device. */
  cartUrl: string;
  unsubscribeUrl: string;
};

const copy = {
  ua: {
    preview: "Ваш кошик чекає — товари збережено",
    eyebrow: "Ваш кошик",
    heading: "Ви залишили товари в кошику",
    intro: (name: string) =>
      `${name ? `${name}, ми` : "Ми"} зберегли ваш кошик. Поверніться, щоб завершити замовлення, — або напишіть нам, якщо потрібна допомога з підбором.`,
    items: "У кошику",
    quantity: (count: number) => `Кількість: ${count}`,
    onRequest: "Ціна за запитом",
    total: "Разом",
    note: "Ціни та наявність можуть змінитися — актуальні показуємо в кошику.",
    button: "Повернутися до кошика",
    reason: "Ви отримали цей лист, бо погодилися на нагадування під час оформлення замовлення.",
  },
  en: {
    preview: "Your cart is waiting — we saved your items",
    eyebrow: "Your cart",
    heading: "You left items in your cart",
    intro: (name: string) =>
      `${name ? `${name}, we` : "We"} saved your cart. Come back to finish your order — or write to us if you need help choosing.`,
    items: "In your cart",
    quantity: (count: number) => `Quantity: ${count}`,
    onRequest: "Price on request",
    total: "Total",
    note: "Prices and availability may change — the cart always shows the current ones.",
    button: "Back to my cart",
    reason: "You received this email because you asked for a reminder at checkout.",
  },
} as const;

export const AbandonedCartEmail = ({
  locale,
  firstName,
  currency,
  items,
  cartUrl,
  unsubscribeUrl,
}: AbandonedCartEmailProps) => {
  const t = copy[locale];
  const money = (value: number) => formatEmailMoney(value, currency, locale);
  const priced = items.every((item) => typeof item.lineTotal === "number" && item.lineTotal > 0);
  const total = items.reduce((sum, item) => sum + (item.lineTotal ?? 0), 0);
  return (
    <EmailShell locale={locale} preview={t.preview} unsubscribe={{ reason: t.reason, url: unsubscribeUrl }}>
      <EmailEyebrow>{t.eyebrow}</EmailEyebrow>
      <EmailHeading>{t.heading}</EmailHeading>
      <EmailText muted>{t.intro((firstName ?? "").trim())}</EmailText>
      <EmailDivider />

      <EmailLabel>{t.items}</EmailLabel>
      {items.map((item, index) => {
        const image = emailImageUrl(item.image);
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
              <Text style={styles.itemMeta}>{t.quantity(item.quantity)}</Text>
            </Column>
            <Column valign="top" align="right" style={styles.itemTotalCell}>
              <Text style={styles.itemTotal}>
                {typeof item.lineTotal === "number" && item.lineTotal > 0 ? money(item.lineTotal) : t.onRequest}
              </Text>
            </Column>
          </Row>
        );
      })}
      {priced ? (
        <Section style={styles.totals}>
          <Row>
            <Column>
              <Text style={styles.grandLabel}>{t.total}</Text>
            </Column>
            <Column align="right">
              <Text style={styles.grandValue}>{money(total)}</Text>
            </Column>
          </Row>
        </Section>
      ) : null}

      <EmailButton href={cartUrl}>{t.button}</EmailButton>
      <Text style={styles.note}>{t.note}</Text>
    </EmailShell>
  );
};

export default AbandonedCartEmail;

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
  totals: { padding: "8px 0 0" },
  grandLabel: { color: emailColors.text, fontSize: "15px", fontWeight: "600", margin: "14px 0 0" },
  grandValue: { color: emailColors.text, fontSize: "22px", fontWeight: "300", margin: "10px 0 0", textAlign: "right" as const, whiteSpace: "nowrap" as const },
  note: { color: emailColors.muted, fontSize: "13px", lineHeight: "20px", margin: "16px 0 0", textAlign: "center" as const },
};
