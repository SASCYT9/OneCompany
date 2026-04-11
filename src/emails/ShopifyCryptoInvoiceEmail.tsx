import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';

interface ShopifyCryptoInvoiceEmailProps {
  orderNumber: string;
  amount: string;
  currency: string;
  payUrl: string;
  storeName?: string;
  publicDomain?: string;
  locale?: 'ua' | 'en';
}

const translations = {
  ua: {
    preview: (orderNumber: string) => `Ваше замовлення #${orderNumber} очікує на оплату криптовалютою.`,
    heading: 'ОПЛАТА ЗАМОВЛЕННЯ',
    thankYou: (orderNumber: string) => `Дякуємо за ваше замовлення #${orderNumber}. Ви обрали оплату криптовалютою.`,
    priceLabel: 'Сума до оплати:',
    instructions: 'Для завершення замовлення, будь ласка, перейдіть за посиланням нижче для миттєвої оплати через безпечний шлюз Whitepay:',
    payButton: 'ОПЛАТИТИ КРИПТОВАЛЮТОЮ',
    timeWarning: 'Це посилання дійсне обмежений час. Після успішної транзакції статус вашого замовлення оновиться автоматично.',
    footer: 'Якщо ви не робили це замовлення або у вас виникли питання, просто дайте відповідь на цей лист.',
  },
  en: {
    preview: (orderNumber: string) => `Your order #${orderNumber} is awaiting cryptocurrency payment.`,
    heading: 'ORDER PAYMENT',
    thankYou: (orderNumber: string) => `Thank you for your order #${orderNumber}. You have selected cryptocurrency payment.`,
    priceLabel: 'Amount due:',
    instructions: 'To complete your order, please follow the link below for instant payment via the secure Whitepay gateway:',
    payButton: 'PAY WITH CRYPTO',
    timeWarning: 'This link is valid for a limited time. After a successful transaction, your order status will be updated automatically.',
    footer: 'If you did not place this order or have any questions, simply reply to this email.',
  },
};

export const ShopifyCryptoInvoiceEmail = ({
  orderNumber,
  amount,
  currency,
  payUrl,
  storeName = 'One Company',
  publicDomain,
  locale = 'ua',
}: ShopifyCryptoInvoiceEmailProps) => {
  const t = translations[locale] || translations.ua;
  const storeUrl = publicDomain ? `https://${publicDomain}` : 'https://onecompany.global';
  const displayDomain = publicDomain || storeName;

  return (
    <Html>
      <Head />
      <Preview>{t.preview(orderNumber)}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header with store branding */}
          <Section style={header}>
            <Link href={storeUrl} style={logoLink}>
              {storeName.toUpperCase()}
            </Link>
            <Text style={domainText}>{displayDomain}</Text>
          </Section>

          {/* Content */}
          <Section style={content}>
            <Heading style={heading}>{t.heading}</Heading>
            <Text style={paragraph}>
              {t.thankYou(orderNumber)}
            </Text>
            
            <Section style={priceBox}>
              <Text style={priceLabel}>{t.priceLabel}</Text>
              <Text style={priceValue}>{amount} {currency}</Text>
            </Section>

            <Text style={paragraph}>
              {t.instructions}
            </Text>

            <Section style={btnContainer}>
              <Button style={button} href={payUrl}>
                {t.payButton}
              </Button>
            </Section>

            <Text style={smallText}>
              {t.timeWarning}
            </Text>

            <Hr style={hr} />

            <Text style={footer}>
              {t.footer}
              <br />© {new Date().getFullYear()}{' '}
              <Link href={storeUrl} style={footerLink}>{storeName}</Link>
              {' '}· {displayDomain}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

export default ShopifyCryptoInvoiceEmail;

const main = {
  backgroundColor: '#0a0a0a',
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif',
};

const container = {
  margin: '0 auto',
  padding: '40px 20px',
  maxWidth: '600px',
};

const header = {
  textAlign: 'center' as const,
  paddingBottom: '30px',
};

const logoLink = {
  color: '#ffffff',
  fontSize: '24px',
  fontWeight: '600',
  letterSpacing: '4px',
  textDecoration: 'none',
  display: 'block',
};

const domainText = {
  color: '#c29d59',
  fontSize: '13px',
  letterSpacing: '2px',
  margin: '8px 0 0 0',
  textAlign: 'center' as const,
};

const content = {
  backgroundColor: '#111111',
  border: '1px solid #222222',
  borderRadius: '12px',
  padding: '40px',
};

const heading = {
  color: '#ffffff',
  fontSize: '20px',
  fontWeight: '500',
  letterSpacing: '2px',
  textAlign: 'center' as const,
  margin: '0 0 20px',
};

const paragraph = {
  color: '#a0a0a0',
  fontSize: '15px',
  lineHeight: '24px',
  textAlign: 'center' as const,
  margin: '0 0 20px',
};

const priceBox = {
  backgroundColor: '#1a1a1a',
  borderRadius: '8px',
  border: '1px solid #333333',
  padding: '20px',
  textAlign: 'center' as const,
  margin: '20px 0',
};

const priceLabel = {
  color: '#888888',
  fontSize: '13px',
  textTransform: 'uppercase' as const,
  letterSpacing: '1px',
  margin: '0 0 5px 0',
};

const priceValue = {
  color: '#ffffff',
  fontSize: '28px',
  fontWeight: '600',
  margin: '0',
};

const btnContainer = {
  textAlign: 'center' as const,
  margin: '30px 0',
};

const button = {
  backgroundColor: '#c29d59',
  borderRadius: '6px',
  color: '#000000',
  fontSize: '14px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '16px 32px',
  letterSpacing: '1px',
};

const smallText = {
  color: '#666666',
  fontSize: '12px',
  lineHeight: '20px',
  textAlign: 'center' as const,
  margin: '0 0 30px',
};

const hr = {
  borderColor: '#333333',
  margin: '0 0 20px',
};

const footer = {
  color: '#666666',
  fontSize: '12px',
  lineHeight: '20px',
  textAlign: 'center' as const,
  margin: '0',
};

const footerLink = {
  color: '#c29d59',
  textDecoration: 'none',
};
