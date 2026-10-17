import { Text } from "@react-email/components";
import * as React from "react";
import {
  EmailButton,
  EmailCallout,
  EmailEyebrow,
  EmailHeading,
  EmailLabel,
  EmailShell,
  EmailText,
  emailColors,
  type EmailLocale,
} from "./EmailLayout";

export type ReviewRequestEmailProps = {
  locale: EmailLocale;
  orderNumber: string;
  firstName?: string | null;
  items: Array<{ title: string }>;
  reviewUrl: string;
  unsubscribeUrl: string;
};

const copy = {
  ua: {
    preview: (order: string) => `Як вам замовлення ${order}? Поділіться враженнями`,
    eyebrow: "Ваш відгук",
    heading: "Як вам замовлення?",
    intro: (name: string, order: string) =>
      `${name ? `${name}, дякуємо` : "Дякуємо"}, що обрали One Company! Замовлення ${order} уже у вас — будемо вдячні за кілька слів у Google. Ваш відгук допомагає іншим власникам авто знайти перевірений тюнінг.`,
    items: "У замовленні",
    button: "Залишити відгук у Google",
    helpTitle: "Щось не так або потрібна допомога?",
    help: "Просто відповідайте на цей лист або напишіть нам у Telegram чи WhatsApp — допоможемо з установкою, налаштуванням чи поверненням.",
    reason: "Ви отримали цей лист, бо нещодавно отримали замовлення в One Company.",
  },
  en: {
    preview: (order: string) => `How was your order ${order}? Share your experience`,
    eyebrow: "Your review",
    heading: "How was your order?",
    intro: (name: string, order: string) =>
      `${name ? `${name}, thank you` : "Thank you"} for choosing One Company! Order ${order} has reached you — we'd be grateful for a few words on Google. Your review helps other car owners find trusted tuning.`,
    items: "In your order",
    button: "Leave a Google review",
    helpTitle: "Something wrong or need a hand?",
    help: "Just reply to this email or message us on Telegram or WhatsApp — we'll help with installation, setup or a return.",
    reason: "You received this email because you recently received an order from One Company.",
  },
} as const;

export const ReviewRequestEmail = ({
  locale,
  orderNumber,
  firstName,
  items,
  reviewUrl,
  unsubscribeUrl,
}: ReviewRequestEmailProps) => {
  const t = copy[locale];
  return (
    <EmailShell
      locale={locale}
      preview={t.preview(orderNumber)}
      unsubscribe={{ reason: t.reason, url: unsubscribeUrl }}
    >
      <EmailEyebrow>{t.eyebrow}</EmailEyebrow>
      <EmailHeading>{t.heading}</EmailHeading>
      <EmailText muted>{t.intro((firstName ?? "").trim(), orderNumber)}</EmailText>
      {items.length ? (
        <>
          <EmailLabel>{t.items}</EmailLabel>
          {items.map((item, index) => (
            <Text key={`${item.title}-${index}`} style={itemStyle}>
              {item.title}
            </Text>
          ))}
        </>
      ) : null}
      <EmailButton href={reviewUrl}>{t.button}</EmailButton>
      <EmailCallout title={t.helpTitle}>{t.help}</EmailCallout>
    </EmailShell>
  );
};

export default ReviewRequestEmail;

const itemStyle = {
  color: emailColors.text,
  fontSize: "14px",
  lineHeight: "20px",
  margin: "0 0 6px",
};
