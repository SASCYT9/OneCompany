import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Preview,
  Section,
  Text,
  Link,
} from '@react-email/components';
import * as React from 'react';

export type OrderStatusEmailProps = {
  orderNumber: string;
  customerName: string;
  newStatus: 'SHIPPED' | 'DELIVERED';
  locale: 'ua' | 'en';
  viewOrderUrl: string;
  trackingNumber?: string | null;
  carrier?: string | null;
  trackingUrl?: string | null;
  logoSrc?: string;
};

const baseUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://onecompany.global');

const copy = {
  ua: {
    SHIPPED: {
      preview: 'Ваше замовлення відправлено',
      heading: 'Замовлення відправлено 🚚',
      message: 'Ваше замовлення було відправлено. Очікуйте отримання найближчим часом.',
      trackingLabel: 'Номер відстеження (ТТН)',
      carrierLabel: 'Перевізник',
      trackBtn: 'Відстежити посилку',
    },
    DELIVERED: {
      preview: 'Ваше замовлення доставлено',
      heading: 'Замовлення доставлено ✅',
      message: 'Ваше замовлення було доставлено. Дякуємо за покупку!',
      trackingLabel: 'Номер відстеження (ТТН)',
      carrierLabel: 'Перевізник',
      trackBtn: 'Відстежити посилку',
    },
    greeting: 'Вітаємо',
    orderNumber: 'Номер замовлення',
    viewOrder: 'Переглянути замовлення',
    footer: '© One Company. Всі права захищені.',
  },
  en: {
    SHIPPED: {
      preview: 'Your order has been shipped',
      heading: 'Order Shipped 🚚',
      message: 'Your order is on its way. Expect delivery soon.',
      trackingLabel: 'Tracking Number',
      carrierLabel: 'Carrier',
      trackBtn: 'Track shipment',
    },
    DELIVERED: {
      preview: 'Your order has been delivered',
      heading: 'Order Delivered ✅',
      message: 'Your order has been delivered. Thank you for your purchase!',
      trackingLabel: 'Tracking Number',
      carrierLabel: 'Carrier',
      trackBtn: 'Track shipment',
    },
    greeting: 'Hello',
    orderNumber: 'Order number',
    viewOrder: 'View order',
    footer: '© One Company. All rights reserved.',
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
  logoSrc,
}: OrderStatusEmailProps) => {
  const t = copy[locale];
  const s = t[newStatus];

  return (
    <Html>
      <Head />
      <Preview>{s.preview} — {orderNumber}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={logoContainer}>
            <Img
              src={logoSrc || `${baseUrl}/branding/email-logo.png`}
              width="150"
              height="55"
              alt="One Company"
              style={logo}
            />
          </Section>

          <Section style={contentContainer}>
            <Heading style={heading}>{s.heading}</Heading>
            <Text style={subheading}>{s.message}</Text>
            <Text style={value}>{t.greeting} {customerName},</Text>

            <Section style={infoRow}>
              <Text style={label}>{t.orderNumber}</Text>
              <Text style={orderNum}>{orderNumber}</Text>
            </Section>

            {trackingNumber && (
              <>
                <Hr style={hr} />
                <Section style={infoRow}>
                  <Text style={label}>{s.trackingLabel}</Text>
                  <Text style={orderNum}>{trackingNumber}</Text>
                </Section>
                {carrier && (
                  <Section style={infoRow}>
                    <Text style={label}>{s.carrierLabel}</Text>
                    <Text style={value}>{carrier}</Text>
                  </Section>
                )}
                {trackingUrl && (
                  <Section style={buttonContainer}>
                    <Button style={trackButton} href={trackingUrl}>
                      {s.trackBtn}
                    </Button>
                  </Section>
                )}
              </>
            )}

            <Hr style={hr} />

            <Section style={buttonContainer}>
              <Button style={button} href={viewOrderUrl}>
                {t.viewOrder}
              </Button>
            </Section>
          </Section>

          <Section style={footer}>
            <Text style={footerText}>{t.footer}</Text>
            <Link href="https://onecompany.global" style={footerLink}>
              onecompany.global
            </Link>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

export default OrderStatusEmail;

const main = {
  backgroundColor: '#000000',
  fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  color: '#ffffff',
};

const container = { margin: '0 auto', padding: '40px 20px', maxWidth: '600px' };
const logoContainer = { textAlign: 'center' as const, marginBottom: '32px' };
const logo = { margin: '0 auto', display: 'block' };

const contentContainer = {
  backgroundColor: '#111111',
  borderRadius: '12px',
  border: '1px solid #333333',
  padding: '40px',
};

const heading = {
  fontSize: '24px', fontWeight: '600', textAlign: 'center' as const,
  color: '#ffffff', margin: '0 0 16px', letterSpacing: '-0.02em',
};

const subheading = {
  fontSize: '16px', lineHeight: '26px', textAlign: 'center' as const,
  color: '#888888', marginBottom: '32px',
};

const infoRow = { marginBottom: '20px' };

const label = {
  color: '#888888', fontSize: '12px', textTransform: 'uppercase' as const,
  letterSpacing: '0.1em', marginBottom: '8px', fontWeight: '600', display: 'block',
};

const orderNum = {
  color: '#ffffff', fontSize: '18px', fontFamily: 'monospace',
  fontWeight: '600', margin: '0',
};

const value = { color: '#ffffff', fontSize: '14px', margin: '0', lineHeight: '22px' };
const hr = { borderColor: '#333333', margin: '24px 0' };
const buttonContainer = { textAlign: 'center' as const, marginTop: '24px' };

const button = {
  backgroundColor: '#ffffff', borderRadius: '9999px', color: '#000000',
  fontSize: '14px', fontWeight: '600', textDecoration: 'none',
  textAlign: 'center' as const, display: 'inline-block',
  padding: '14px 32px', letterSpacing: '0.05em', textTransform: 'uppercase' as const,
};

const trackButton = {
  backgroundColor: 'transparent', borderRadius: '9999px', color: '#ffffff',
  fontSize: '13px', fontWeight: '600', textDecoration: 'none',
  textAlign: 'center' as const, display: 'inline-block',
  padding: '12px 28px', letterSpacing: '0.05em', border: '1px solid #555',
};

const footer = { textAlign: 'center' as const, marginTop: '32px' };
const footerText = { fontSize: '12px', color: '#666666', margin: '8px 0' };
const footerLink = { color: '#888888', textDecoration: 'none' };
