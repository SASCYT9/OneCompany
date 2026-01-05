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

interface ContactEmailProps {
  name: string;
  contact: string;
  message: string;
  inquiryType: 'Auto' | 'Moto' | 'General';
  model?: string;
  vin?: string;
  budget?: string;
  phone?: string;
  contactMethod?: 'telegram' | 'whatsapp';
  messageId?: string;
  logoSrc?: string;
}

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL
  ? `${process.env.NEXT_PUBLIC_SITE_URL}`
  : process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : 'https://onecompany.global';

export const ContactEmail = ({
  name,
  contact,
  message,
  inquiryType,
  model,
  vin,
  budget,
  phone,
  contactMethod,
  messageId,
  logoSrc,
}: ContactEmailProps) => (
  <Html>
    <Head />
    <Preview>New {inquiryType} Inquiry from {name}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={logoContainer}>
          <Img
            src={logoSrc || `${baseUrl}/branding/one-company-logo.png`}
            width="120"
            height="120"
            alt="OneCompany"
            style={logo}
          />
        </Section>

        <Section style={contentContainer}>
          <Heading style={heading}>New {inquiryType} Inquiry</Heading>
          <Text style={subheading}>
            A new request has been submitted via the website.
          </Text>

          <Section style={infoSection}>
            <Section style={infoRow}>
              <Text style={label}>Client Name</Text>
              <Text style={value}>{name}</Text>
            </Section>

            <Section style={infoRow}>
              <Text style={label}>Contact Email</Text>
              <Link href={`mailto:${contact}`} style={link}>
                {contact}
              </Link>
            </Section>

            {phone && (
              <Section style={infoRow}>
                <Text style={label}>Phone Number</Text>
                <Link href={`tel:${phone}`} style={link}>
                  {phone}
                </Link>
              </Section>
            )}

            {contactMethod && (
              <Section style={infoRow}>
                <Text style={label}>Preferred Contact</Text>
                <Text style={value}>{contactMethod.toUpperCase()}</Text>
              </Section>
            )}

            {model && (
              <Section style={infoRow}>
                <Text style={label}>Vehicle Model</Text>
                <Text style={value}>{model}</Text>
              </Section>
            )}

            {vin && (
              <Section style={infoRow}>
                <Text style={label}>VIN Code</Text>
                <Text style={value}>{vin}</Text>
              </Section>
            )}

            {budget && (
              <Section style={infoRow}>
                <Text style={label}>Budget</Text>
                <Text style={value}>{budget}</Text>
              </Section>
            )}
          </Section>

          <Section style={messageBox}>
            <Text style={label}>Message / Wishes</Text>
            <Text style={messageText}>{message}</Text>
          </Section>

          <Section style={buttonContainer}>
            <Button
              style={button}
              href={`${baseUrl}/admin/messages${messageId ? `?id=${messageId}` : ''}`}
            >
              Open Dashboard
            </Button>
          </Section>

          {messageId && (
            <Text style={idText}>ID: {messageId}</Text>
          )}
        </Section>

        <Section style={footer}>
          <Text style={footerText}>
            © {new Date().getFullYear()} OneCompany. All rights reserved.
          </Text>
          <Text style={footerText}>
            <Link href="https://onecompany.global" style={footerLink}>onecompany.global</Link>
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
);

export default ContactEmail;

const main = {
  backgroundColor: '#000000',
  fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
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

const infoSection = {
  marginBottom: '32px',
};

const infoRow = {
  marginBottom: '20px',
  borderBottom: '1px solid #222222',
  paddingBottom: '20px',
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

const value = {
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: '500',
  margin: '0',
  lineHeight: '24px',
};

const link = {
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: '500',
  textDecoration: 'none',
};

const messageBox = {
  backgroundColor: '#1a1a1a',
  borderRadius: '8px',
  padding: '24px',
  borderLeft: '4px solid #ffffff',
};

const messageText = {
  fontSize: '16px',
  lineHeight: '26px',
  color: '#ffffff',
  margin: '0',
  whiteSpace: 'pre-wrap' as const,
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

const idText = {
  fontSize: '10px',
  color: '#444444',
  marginTop: '24px',
  textAlign: 'center' as const,
  fontFamily: 'monospace',
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
