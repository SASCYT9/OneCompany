import { Resend } from 'resend';
import { render } from '@react-email/render';
import React from 'react';
import ShopifyCryptoInvoiceEmail from '@/emails/ShopifyCryptoInvoiceEmail';

// Create the Resend client if we have a key
const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;
const fromEmail = process.env.EMAIL_FROM || 'info@onecompany.global';

interface SendShopifyInvoiceParams {
  toEmail: string;
  orderNumber: string;
  amount: string;
  currency: string;
  payUrl: string;
  storeName?: string;
  publicDomain?: string;
}

export async function sendShopifyCryptoInvoice({
  toEmail,
  orderNumber,
  amount,
  currency,
  payUrl,
  storeName,
  publicDomain,
}: SendShopifyInvoiceParams) {
  if (!resend) {
    console.error('Email Service Error: RESEND_API_KEY is not defined.');
    return { success: false, error: 'Email service inactive' };
  }

  try {
    const reactElement = React.createElement(ShopifyCryptoInvoiceEmail, {
      orderNumber,
      amount,
      currency,
      payUrl,
      storeName,
      publicDomain,
    });
    
    // Some envs prefer HTML strings instead of passing the react element directly
    const htmlString = await render(reactElement);

    const { data, error } = await resend.emails.send({
      from: `${storeName || 'One Company'} <${fromEmail}>`,
      to: [toEmail],
      subject: `Оплата замовлення #${orderNumber} (${storeName || 'One Company'})`,
      html: htmlString,
    });

    if (error) {
      console.error('Resend Error:', error);
      return { success: false, error: error.message };
    }

    console.log(`✅ Email sent successfully to ${toEmail} for order #${orderNumber}. ID: ${data?.id}`);
    return { success: true, data };
  } catch (error: any) {
    console.error('Exception sending email:', error);
    return { success: false, error: error.message };
  }
}
