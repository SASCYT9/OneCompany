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
  Row,
  Column,
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
}

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL
  ? `${process.env.NEXT_PUBLIC_SITE_URL}`
  : 'http://localhost:3000';

const accentColor = '#ffb256'; // Amber
const backgroundColor = '#090c11';
const foregroundColor = '#f5f7fa';
const subtleTextColor = '#a1a1aa';
const cardBackgroundColor = '#10151d';
const borderColor = 'rgba(255,255,255,0.08)';

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
}: ContactEmailProps) => (
  <Html>
    <Head />
    <Preview>New {inquiryType} Inquiry from {name}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={{ paddingTop: '20px' }}>
          <Img
            src={`${baseUrl}/branding/one-company-logo.svg`}
            width="150"
            alt="OneCompany Logo"
            style={logo}
          />
        </Section>
        <Heading style={heading}>New Contact Request</Heading>
        <Text style={subheading}>
          A new <strong>{inquiryType}</strong> inquiry has been submitted through the website.
        </Text>
        
        <Section style={card}>
          <Row style={row}>
            <Column style={label}>From:</Column>
            <Column style={value}>{name}</Column>
          </Row>
          <Hr style={hr} />
          <Row style={row}>
            <Column style={label}>Contact:</Column>
            <Column style={value}>{contact}</Column>
          </Row>
          {phone && (
            <>
              <Hr style={hr} />
              <Row style={row}>
                <Column style={label}>Phone:</Column>
                <Column style={value}>{phone}</Column>
              </Row>
            </>
          )}
          {contactMethod && (
            <>
              <Hr style={hr} />
              <Row style={row}>
                <Column style={label}>Contact Method:</Column>
                <Column style={value}>{contactMethod?.toUpperCase()}</Column>
              </Row>
            </>
          )}
          {model && (
            <>
              <Hr style={hr} />
              <Row style={row}>
                <Column style={label}>{inquiryType === 'Auto' ? 'Car Model:' : 'Moto Model:'}</Column>
                <Column style={value}>{model}</Column>
              </Row>
            </>
          )}
          {vin && (
            <>
              <Hr style={hr} />
              <Row style={row}>
                <Column style={label}>VIN:</Column>
                <Column style={value}>{vin}</Column>
              </Row>
            </>
          )}
          {budget && (
            <>
              <Hr style={hr} />
              <Row style={row}>
                <Column style={label}>Budget:</Column>
                <Column style={value}>{budget}</Column>
              </Row>
            </>
          )}
          <Hr style={hr} />
          <Row style={row}>
            <Column style={label}>Message:</Column>
          </Row>
          <Row>
            <Column>
              <Text style={messageText}>{message}</Text>
            </Column>
          </Row>
        </Section>

        <Section style={{ textAlign: 'center', marginTop: '32px' }}>
          <Button
            style={button}
            href={`${baseUrl}/admin/messages`}
          >
            View in Dashboard
          </Button>
        </Section>
        
        <Hr style={footerHr} />
        
        <Section>
          <Text style={footer}>
            OneCompany | Automated Notification System
          </Text>
          {messageId && (
            <Text style={{ ...footer, marginTop: 6 }}>
              Message ID: <strong>{messageId}</strong>
            </Text>
          )}
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
  width: '580px',
};

const logo = {
  margin: '0 auto',
};

const heading = {
  fontSize: '28px',
  fontWeight: 'bold',
  textAlign: 'center' as const,
  color: accentColor,
  marginTop: '30px',
};

const subheading = {
  fontSize: '16px',
  lineHeight: '26px',
  textAlign: 'center' as const,
  color: foregroundColor,
};

const card = {
  backgroundColor: cardBackgroundColor,
  borderRadius: '8px',
  padding: '20px',
  marginTop: '20px',
  border: `1px solid ${borderColor}`,
};

const row = {
  width: '100%',
  display: 'table',
};

const label = {
  width: '100px',
  color: subtleTextColor,
  fontSize: '14px',
  verticalAlign: 'top',
};

const value = {
  color: foregroundColor,
  fontSize: '14px',
  fontWeight: 'bold',
};

const messageText = {
  color: foregroundColor,
  fontSize: '14px',
  lineHeight: '24px',
  whiteSpace: 'pre-wrap' as const,
  marginTop: '10px',
};

const hr = {
  borderColor: borderColor,
  margin: '16px 0',
};

const footerHr = {
  borderColor: borderColor,
  margin: '40px 0',
};

const button = {
  backgroundColor: accentColor,
  borderRadius: '8px',
  color: '#000',
  fontSize: '16px',
  fontWeight: 'bold',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '12px 24px',
  boxShadow: `0 4px 20px rgba(255, 178, 86, 0.25)`,
};

const footer = {
  color: subtleTextColor,
  fontSize: '12px',
  textAlign: 'center' as const,
};
