import {
  Body,
  Button,
  Column,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Preview,
  Row,
  Section,
  Text,
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
}

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL
  ? `${process.env.NEXT_PUBLIC_SITE_URL}`
  : 'http://localhost:3000';

const accentColor = '#ffb256';
const backgroundColor = '#050608';
const foregroundColor = '#f5f7fa';
const subtleTextColor = '#a1a1aa';
const borderColor = 'rgba(255,255,255,0.08)';
const surfaceColor = '#0b0f16';
const gradient = 'linear-gradient(135deg, rgba(255,178,86,0.28), rgba(104,151,255,0.22))';

export const ContactEmail = ({
  name,
  contact,
  message,
  inquiryType,
  model,
  vin,
  budget,
}: ContactEmailProps) => (
  <Html>
    <Head />
    <Preview>New {inquiryType} Inquiry from {name}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={heroSection}>
          <Img
            src={`${baseUrl}/branding/one-company-logo.svg`}
            width="120"
            alt="OneCompany Logo"
            style={logo}
          />
          <Text style={eyebrow}>Concierge intake · {inquiryType}</Text>
          <Heading style={heroTitle}>New Request</Heading>
          <Text style={heroSubtitle}>
            {name} just submitted a premium {inquiryType.toLowerCase()} brief via the website.
          </Text>
          <div style={chipRow as React.CSSProperties}>
            <span style={chip}>Lead priority · 2h SLA</span>
            <span style={chip}>channel · web form</span>
          </div>
        </Section>

        <Section style={card}>
          <Text style={cardHeading}>Lead summary</Text>
          <Row style={row}>
            <Column style={label}>Client</Column>
            <Column style={value}>{name}</Column>
          </Row>
          <Row style={row}>
            <Column style={label}>Contact</Column>
            <Column style={value}>{contact}</Column>
          </Row>
          {model && (
            <Row style={row}>
              <Column style={label}>{inquiryType === 'Auto' ? 'Car model' : 'Moto model'}</Column>
              <Column style={value}>{model}</Column>
            </Row>
          )}
          {vin && (
            <Row style={row}>
              <Column style={label}>VIN</Column>
              <Column style={value}>{vin}</Column>
            </Row>
          )}
          {budget && (
            <Row style={row}>
              <Column style={label}>Budget</Column>
              <Column style={value}>{budget}</Column>
            </Row>
          )}
        </Section>

        <Section style={messageCard}>
          <Text style={cardHeading}>Message</Text>
          <Text style={messageText}>
            “{message}”
          </Text>
        </Section>

        <Section style={metaCard}>
          <Column style={metaColumn}>
            <Text style={metaLabel}>Inquiry type</Text>
            <Text style={metaValue}>{inquiryType}</Text>
          </Column>
          <Column style={metaColumn}>
            <Text style={metaLabel}>Response CTA</Text>
            <Text style={metaValue}>Dashboard · Telegram</Text>
          </Column>
          <Column style={metaColumn}>
            <Text style={metaLabel}>Suggested follow-up</Text>
            <Text style={metaValue}>Send spec sheet · confirm logistics</Text>
          </Column>
        </Section>

        <Section style={ctaSection}>
          <Button style={button} href={`${baseUrl}/admin/messages`}>
            Open dashboard
          </Button>
        </Section>

        <Hr style={footerHr} />

        <Section>
          <Text style={footer}>OneCompany · Automated concierge notification</Text>
        </Section>
      </Container>
    </Body>
  </Html>
);

export default ContactEmail;

const main = {
  backgroundColor: backgroundColor,
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif',
  color: foregroundColor,
};

const container = {
  margin: '0 auto',
  padding: '20px 0 48px',
  width: '600px',
  maxWidth: '600px',
};

const logo = {
  marginBottom: '12px',
};

const heroSection = {
  background: gradient,
  borderRadius: '28px',
  padding: '32px',
  textAlign: 'center' as const,
  border: `1px solid ${borderColor}`,
};

const eyebrow = {
  textTransform: 'uppercase' as const,
  letterSpacing: '0.4em',
  fontSize: '11px',
  color: subtleTextColor,
  marginBottom: '12px',
};

const heroTitle = {
  fontSize: '32px',
  color: foregroundColor,
  margin: '0',
  fontWeight: 700,
};

const heroSubtitle = {
  color: foregroundColor,
  fontSize: '16px',
  lineHeight: '26px',
  marginTop: '12px',
  marginBottom: '16px',
};

const chipRow = {
  display: 'inline-flex',
  gap: '10px',
  flexWrap: 'wrap' as const,
  justifyContent: 'center',
};

const chip = {
  borderRadius: '999px',
  border: '1px solid rgba(255,255,255,0.6)',
  padding: '6px 14px',
  fontSize: '12px',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.2em',
  color: '#fff',
};

const card = {
  backgroundColor: surfaceColor,
  borderRadius: '20px',
  padding: '24px 28px',
  marginTop: '24px',
  border: `1px solid ${borderColor}`,
  boxShadow: '0 15px 60px rgba(0,0,0,0.35)',
};

const cardHeading = {
  textTransform: 'uppercase' as const,
  letterSpacing: '0.4em',
  fontSize: '11px',
  color: subtleTextColor,
  marginBottom: '20px',
};

const row = {
  width: '100%',
  display: 'table',
  marginBottom: '12px',
};

const label = {
  width: '120px',
  color: subtleTextColor,
  fontSize: '14px',
  verticalAlign: 'top',
};

const value = {
  color: foregroundColor,
  fontSize: '16px',
  fontWeight: 500,
};

const messageText = {
  color: foregroundColor,
  fontSize: '18px',
  lineHeight: '30px',
  whiteSpace: 'pre-wrap' as const,
  fontWeight: 300,
};

const messageCard = {
  ...card,
  background: 'rgba(5,6,8,0.9)',
  border: '1px solid rgba(255,255,255,0.12)',
};

const footerHr = {
  borderColor: borderColor,
  margin: '40px 0',
};

const metaCard = {
  ...card,
  display: 'table',
  width: '100%',
};

const metaColumn = {
  display: 'table-cell',
  width: '33.33%',
  paddingRight: '12px',
};

const metaLabel = {
  textTransform: 'uppercase' as const,
  letterSpacing: '0.3em',
  fontSize: '10px',
  color: subtleTextColor,
  marginBottom: '6px',
};

const metaValue = {
  fontSize: '14px',
  color: foregroundColor,
  lineHeight: '20px',
  fontWeight: 500,
};

const ctaSection = {
  textAlign: 'center' as const,
  marginTop: '32px',
};

const button = {
  backgroundColor: accentColor,
  borderRadius: '999px',
  color: '#000',
  fontSize: '14px',
  fontWeight: 600,
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '14px 34px',
  letterSpacing: '0.25em',
  textTransform: 'uppercase' as const,
  boxShadow: '0 20px 40px rgba(255,178,86,0.35)',
};

const footer = {
  color: subtleTextColor,
  fontSize: '12px',
  textAlign: 'center' as const,
};
