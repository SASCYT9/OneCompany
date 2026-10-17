import { Link, Text } from '@react-email/components';
import * as React from 'react';
import {
  EmailButton,
  EmailEyebrow,
  EmailFacts,
  EmailHeading,
  EmailShell,
  EmailText,
  emailColors,
} from './EmailLayout';

export type PaymentLinkEmailProps = {
  orderNumber: string;
  customerName: string;
  locale: 'ua' | 'en';
  /** Already formatted, e.g. "1 782,16 грн" or "€1,250.00". */
  amountText: string;
  paymentUrl: string;
  /** When the bank closes the link; omitted if unknown. */
  validUntilText?: string | null;
  logoSrc?: string;
};

const copy = {
  ua: {
    preview: (order: string) => `Посилання на оплату замовлення ${order}`,
    eyebrow: 'Оплата замовлення',
    heading: 'Посилання на оплату',
    intro: (name: string) =>
      `${name ? `${name}, надсилаємо` : 'Надсилаємо'} захищене посилання plata by mono — оплатити можна карткою, Apple Pay або Google Pay.`,
    order: 'Замовлення',
    amount: 'До сплати',
    validUntil: 'Посилання дійсне до',
    pay: 'Оплатити',
    secure: 'Оплата відбувається на захищеній сторінці plata by mono (monobank).',
    fallback: 'Якщо кнопка не відкривається, скопіюйте посилання:',
  },
  en: {
    preview: (order: string) => `Payment link for order ${order}`,
    eyebrow: 'Order payment',
    heading: 'Your payment link',
    intro: (name: string) =>
      `${name ? `${name}, here is` : 'Here is'} your secure plata by mono link — pay by card, Apple Pay or Google Pay.`,
    order: 'Order',
    amount: 'Amount due',
    validUntil: 'Link valid until',
    pay: 'Pay now',
    secure: 'Payment runs on the secure plata by mono (monobank) page.',
    fallback: 'If the button does not open, copy this link:',
  },
} as const;

export const PaymentLinkEmail = ({
  orderNumber,
  customerName,
  locale,
  amountText,
  paymentUrl,
  validUntilText,
}: PaymentLinkEmailProps) => {
  const t = copy[locale];
  return (
    <EmailShell locale={locale} preview={t.preview(orderNumber)}>
      <EmailEyebrow>{t.eyebrow}</EmailEyebrow>
      <EmailHeading>{t.heading}</EmailHeading>
      <EmailText muted>{t.intro(customerName.trim())}</EmailText>
      <EmailFacts
        facts={[
          { label: t.order, value: orderNumber },
          { label: t.amount, value: <strong>{amountText}</strong> },
          ...(validUntilText ? [{ label: t.validUntil, value: validUntilText }] : []),
        ]}
      />
      <EmailButton href={paymentUrl}>{t.pay}</EmailButton>
      <Text style={note}>{t.secure}</Text>
      <Text style={note}>{t.fallback}</Text>
      <Link href={paymentUrl} style={fallbackLink}>
        {paymentUrl}
      </Link>
    </EmailShell>
  );
};

export default PaymentLinkEmail;

const note = { color: emailColors.muted, fontSize: '13px', lineHeight: '20px', margin: '16px 0 0' };
const fallbackLink = { color: emailColors.text, fontSize: '12px', wordBreak: 'break-all' as const };
