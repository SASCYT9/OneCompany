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
  type EmailLocale,
} from './EmailLayout';

export type OrderStatusEmailProps = {
  orderNumber: string;
  customerName: string;
  newStatus: 'SHIPPED' | 'DELIVERED';
  locale: EmailLocale;
  viewOrderUrl: string;
  trackingNumber?: string | null;
  carrier?: string | null;
  trackingUrl?: string | null;
  logoSrc?: string;
};

const copy = {
  ua: {
    SHIPPED: {
      preview: (order: string) => `Замовлення ${order} відправлено`,
      eyebrow: 'Замовлення відправлено',
      heading: 'Ваше замовлення вже в дорозі',
      intro: (name: string, order: string) => `${name}, замовлення ${order} передано перевізнику.`,
    },
    DELIVERED: {
      preview: (order: string) => `Замовлення ${order} доставлено`,
      eyebrow: 'Замовлення доставлено',
      heading: 'Дякуємо, що обрали One Company',
      intro: (name: string, order: string) =>
        `${name}, замовлення ${order} доставлено. Якщо потрібна допомога з встановленням чи підбором — ми на зв’язку.`,
    },
    order: 'Замовлення',
    carrier: 'Перевізник',
    tracking: 'Номер відстеження',
    track: 'Відстежити посилку',
    view: 'Переглянути замовлення',
  },
  en: {
    SHIPPED: {
      preview: (order: string) => `Order ${order} has shipped`,
      eyebrow: 'Order shipped',
      heading: 'Your order is on its way',
      intro: (name: string, order: string) => `${name}, order ${order} has been handed to the carrier.`,
    },
    DELIVERED: {
      preview: (order: string) => `Order ${order} delivered`,
      eyebrow: 'Order delivered',
      heading: 'Thank you for choosing One Company',
      intro: (name: string, order: string) =>
        `${name}, order ${order} has been delivered. If you need help with installation or fitment, we are here.`,
    },
    order: 'Order',
    carrier: 'Carrier',
    tracking: 'Tracking number',
    track: 'Track shipment',
    view: 'View order',
  },
};

export const OrderStatusEmail = ({
  orderNumber,
  customerName,
  newStatus,
  locale,
  viewOrderUrl,
  trackingNumber,
  carrier,
  trackingUrl,
}: OrderStatusEmailProps) => {
  const t = copy[locale];
  const s = t[newStatus];
  const tracked = newStatus === 'SHIPPED' && Boolean(trackingUrl);
  return (
    <EmailShell locale={locale} preview={s.preview(orderNumber)}>
      <EmailEyebrow>{s.eyebrow}</EmailEyebrow>
      <EmailHeading>{s.heading}</EmailHeading>
      <EmailText muted>{s.intro(customerName, orderNumber)}</EmailText>
      <EmailFacts
        facts={[
          { label: t.order, value: orderNumber },
          ...(carrier ? [{ label: t.carrier, value: carrier }] : []),
          ...(trackingNumber ? [{ label: t.tracking, value: trackingNumber }] : []),
        ]}
      />
      <EmailButton href={tracked ? trackingUrl! : viewOrderUrl}>{tracked ? t.track : t.view}</EmailButton>
      {tracked ? (
        <Text style={secondary}>
          <Link href={viewOrderUrl} style={secondaryLink}>
            {t.view}
          </Link>
        </Text>
      ) : null}
    </EmailShell>
  );
};

export default OrderStatusEmail;

const secondary = { margin: '16px 0 0', textAlign: 'center' as const, fontSize: '13px' };
const secondaryLink = { color: emailColors.muted, textDecoration: 'underline' };
