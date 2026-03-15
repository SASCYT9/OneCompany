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

export type OrderConfirmationEmailProps = {
  orderNumber: string;
  customerName: string;
  email: string;
  currency: string;
  subtotal: number;
  shippingCost: number;
  taxAmount: number;
  total: number;
  locale: 'ua' | 'en';
  viewOrderUrl: string;
  items: Array<{ title: string; quantity: number; total: number }>;
  logoSrc?: string;
};

const baseUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://onecompany.global');

const copy = {
  ua: {
    preview: 'Підтвердження замовлення',
    heading: 'Замовлення прийнято',
    subheading: 'Дякуємо за замовлення. Ми зв’яжемося з вами для узгодження деталей.',
    greeting: 'Вітаємо',
    orderNumber: 'Номер замовлення',
    summary: 'Підсумок',
    subtotal: 'Товари',
    shipping: 'Доставка',
    tax: 'Податок',
    item: 'Товар',
    qty: 'Кількість',
    total: 'Разом',
    viewOrder: 'Переглянути замовлення',
    footer: '© One Company. Всі права захищені.',
  },
  en: {
    preview: 'Order confirmation',
    heading: 'Order confirmed',
    subheading: 'Thank you for your order. We will contact you to confirm details.',
    greeting: 'Hello',
    orderNumber: 'Order number',
    summary: 'Summary',
    subtotal: 'Subtotal',
    shipping: 'Shipping',
    tax: 'Tax',
    item: 'Item',
    qty: 'Qty',
    total: 'Total',
    viewOrder: 'View order',
    footer: '© One Company. All rights reserved.',
  },
};

export const OrderConfirmationEmail = ({
  orderNumber,
  customerName,
  currency,
  subtotal,
  shippingCost,
  taxAmount,
  total,
  locale,
  viewOrderUrl,
  items,
  logoSrc,
}: OrderConfirmationEmailProps) => {
  const t = copy[locale];
  return (
    <Html>
      <Head />
      <Preview>{t.preview} — {orderNumber}</Preview>
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
            <Heading style={heading}>{t.heading}</Heading>
            <Text style={subheading}>{t.subheading}</Text>
            <Text style={value}>{t.greeting} {customerName},</Text>

            <Section style={infoRow}>
              <Text style={label}>{t.orderNumber}</Text>
              <Text style={orderNum}>{orderNumber}</Text>
            </Section>

            <Hr style={hr} />

            <Section style={infoSection}>
              <Text style={label}>{t.summary}</Text>
              {items.map((row, i) => (
                <Section key={i} style={itemRow}>
                  <Text style={value}>
                    {row.title} × {row.quantity} — {currency} {row.total.toFixed(0)}
                  </Text>
                </Section>
              ))}
              <Section style={itemRow}>
                <Text style={value}>{t.subtotal}: {currency} {subtotal.toFixed(0)}</Text>
              </Section>
              <Section style={itemRow}>
                <Text style={value}>{t.shipping}: {currency} {shippingCost.toFixed(0)}</Text>
              </Section>
              <Section style={itemRow}>
                <Text style={value}>{t.tax}: {currency} {taxAmount.toFixed(0)}</Text>
              </Section>
              <Section style={itemRow}>
                <Text style={totalRow}>
                  {t.total}: {currency} {total.toFixed(0)}
                </Text>
              </Section>
            </Section>

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

export default OrderConfirmationEmail;

const main = {
  backgroundColor: '#000000',
  fontFamily:
    'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  color: '#ffffff',
};

const container = {
  margin: '0 auto',
  padding: '40px 20px',
  maxWidth: '600px',
};

const logoContainer = {
  textAlign: 'center' as const,
  marginBottom: '32px',
};

const logo = {
  margin: '0 auto',
  display: 'block',
};

const contentContainer = {
  backgroundColor: '#111111',
  borderRadius: '12px',
  border: '1px solid #333333',
  padding: '40px',
};

const heading = {
  fontSize: '24px',
  fontWeight: '600',
  textAlign: 'center' as const,
  color: '#ffffff',
  margin: '0 0 16px',
  letterSpacing: '-0.02em',
};

const subheading = {
  fontSize: '16px',
  lineHeight: '26px',
  textAlign: 'center' as const,
  color: '#888888',
  marginBottom: '32px',
};

const infoRow = {
  marginBottom: '20px',
};

const infoSection = {
  marginBottom: '24px',
};

const itemRow = {
  marginBottom: '12px',
};

const label = {
  color: '#888888',
  fontSize: '12px',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.1em',
  marginBottom: '8px',
  fontWeight: '600',
  display: 'block',
};

const orderNum = {
  color: '#ffffff',
  fontSize: '18px',
  fontFamily: 'monospace',
  fontWeight: '600',
  margin: '0',
};

const value = {
  color: '#ffffff',
  fontSize: '14px',
  margin: '0',
  lineHeight: '22px',
};

const totalRow = {
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: '600',
  margin: '0',
  paddingTop: '12px',
  borderTop: '1px solid #333',
};

const hr = {
  borderColor: '#333333',
  margin: '24px 0',
};

const buttonContainer = {
  textAlign: 'center' as const,
  marginTop: '32px',
};

const button = {
  backgroundColor: '#ffffff',
  borderRadius: '9999px',
  color: '#000000',
  fontSize: '14px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '14px 32px',
  letterSpacing: '0.05em',
  textTransform: 'uppercase' as const,
};

const footer = {
  textAlign: 'center' as const,
  marginTop: '32px',
};

const footerText = {
  fontSize: '12px',
  color: '#666666',
  margin: '8px 0',
};

const footerLink = {
  color: '#888888',
  textDecoration: 'none',
};
