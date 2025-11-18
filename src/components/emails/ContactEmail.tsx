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
  logoSrc?: string;
}

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL
  ? `${process.env.NEXT_PUBLIC_SITE_URL}`
  : process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : 'http://localhost:3000';

const main = {
  backgroundColor: '#050505',
  fontFamily: '"Manrope", "Helvetica Neue", Helvetica, Arial, sans-serif',
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
};

const contentContainer = {
  backgroundColor: '#0c0c12',
  borderRadius: '16px',
  border: '1px solid rgba(255,255,255,0.1)',
  padding: '32px',
  boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
};

const heading = {
  fontSize: '24px',
  fontWeight: '600',
  textAlign: 'center' as const,
  color: '#ffffff',
  margin: '0 0 24px',
  letterSpacing: '-0.02em',
};

const subheading = {
  fontSize: '15px',
  lineHeight: '24px',
  textAlign: 'center' as const,
  color: '#a1a1aa',
  marginBottom: '32px',
};

const infoRow = {
  marginBottom: '16px',
};

const label = {
  color: '#a1a1aa',
  fontSize: '12px',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.1em',
  marginBottom: '4px',
  fontWeight: '600',
};

const value = {
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: '500',
  margin: '0',
};

const divider = {
  borderColor: 'rgba(255,255,255,0.1)',
  margin: '24px 0',
};

const messageBox = {
  backgroundColor: 'rgba(255,255,255,0.03)',
  borderRadius: '8px',
  padding: '20px',
  color: '#e5e7eb',
  fontSize: '15px',
  lineHeight: '26px',
  whiteSpace: 'pre-wrap' as const,
  border: '1px solid rgba(255,255,255,0.05)',
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
  color: '#52525b',
  fontSize: '12px',
  margin: '4px 0',
};

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
            src={logoSrc || `${baseUrl}/branding/one-company-logo.svg`}
            width="160"
            alt="OneCompany"
            style={logo}
          />
        </Section>
        
        <Section style={contentContainer}>
          <Heading style={heading}>New Inquiry Received</Heading>
          <Text style={subheading}>
            A new <strong>{inquiryType}</strong> inquiry has been submitted via the website.
          </Text>

          <Section>
            <Row style={infoRow}>
              <Column>
                <Text style={label}>Client Name</Text>
                <Text style={value}>{name}</Text>
              </Column>
              <Column>
                <Text style={label}>Contact</Text>
                <Text style={value}>
                  <a href={`mailto:${contact}`} style={{ color: '#ffffff', textDecoration: 'none' }}>{contact}</a>
                </Text>
              </Column>
            </Row>

            {(phone || contactMethod) && (
              <Row style={infoRow}>
                {phone && (
                  <Column>
                    <Text style={label}>Phone</Text>
                    <Text style={value}>{phone}</Text>
                  </Column>
                )}
                {contactMethod && (
                  <Column>
                    <Text style={label}>Preferred Method</Text>
                    <Text style={value}>{contactMethod.toUpperCase()}</Text>
                  </Column>
                )}
              </Row>
            )}

            <Hr style={divider} />

            {(model || vin || budget) && (
              <>
                <Row style={infoRow}>
                  {model && (
                    <Column>
                      <Text style={label}>{inquiryType === 'Auto' ? 'Vehicle Model' : 'Moto Model'}</Text>
                      <Text style={value}>{model}</Text>
                    </Column>
                  )}
                  {budget && (
                    <Column>
                      <Text style={label}>Budget Range</Text>
                      <Text style={value}>{budget}</Text>
                    </Column>
                  )}
                </Row>
                {vin && (
                  <Row style={infoRow}>
                    <Column>
                      <Text style={label}>VIN Code</Text>
                      <Text style={value}>{vin}</Text>
                    </Column>
                  </Row>
                )}
                <Hr style={divider} />
              </>
            )}

            <Text style={label}>Message</Text>
            <Section style={messageBox}>
              <Text style={{ margin: 0 }}>{message}</Text>
            </Section>
          </Section>

          <Section style={buttonContainer}>
            <Button
              style={button}
              href={`${baseUrl}/admin/messages${messageId ? `?id=${messageId}` : ''}`}
            >
              Open Dashboard
            </Button>
          </Section>
        </Section>
        
        <Section style={footer}>
          <Text style={footerText}>
            OneCompany Automated System
          </Text>
          {messageId && (
            <Text style={footerText}>
              ID: {messageId}
            </Text>
          )}
        </Section>
      </Container>
    </Body>
  </Html>
);

export default ContactEmail;
