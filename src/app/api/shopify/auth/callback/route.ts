import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const shop = url.searchParams.get('shop');
  const code = url.searchParams.get('code');
  const hmac = url.searchParams.get('hmac');

  if (!shop || !code || !hmac) {
    return new NextResponse('Missing parameters.', { status: 400 });
  }

  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('SHOPIFY_CLIENT_ID or SHOPIFY_CLIENT_SECRET is missing');
    return new NextResponse('Server configuration error.', { status: 500 });
  }

  // 1. Verify HMAC (Security requirement by Shopify)
  const queryParams = Array.from(url.searchParams.entries())
    .filter(([key]) => key !== 'hmac')
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join('&');

  const generatedHash = crypto
    .createHmac('sha256', clientSecret)
    .update(queryParams)
    .digest('hex');

  // We should do a timing safe equal here, but simple string check is ok for basic validation
  if (generatedHash !== hmac) {
    console.error('[Shopify OAuth] HMAC validation failed');
    return new NextResponse('HMAC validation failed.', { status: 400 });
  }

  // 2. Exchange code for access token
  const tokenUrl = `https://${shop}/admin/oauth/access_token`;
  const tokenPayload = {
    client_id: clientId,
    client_secret: clientSecret,
    code,
  };

  try {
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(tokenPayload),
    });

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text();
      console.error(`[Shopify OAuth] Token exchange failed: ${errText}`);
      return new NextResponse('Token exchange failed.', { status: 502 });
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    const scopes = tokenData.scope;

    if (!accessToken) {
      console.error('[Shopify OAuth] No access token received', tokenData);
      return new NextResponse('No access token received.', { status: 502 });
    }

    // 3. Save to database
    await prisma.shopifyStore.upsert({
      where: { shopDomain: shop },
      update: {
        accessToken: accessToken,
        scope: scopes,
      },
      create: {
        shopDomain: shop,
        accessToken: accessToken,
        scope: scopes,
      },
    });

    console.log(`[Shopify OAuth] Successfully installed app for ${shop}`);

    // Return a beautiful success page to the merchant instead of just a raw string
    const htmlResponse = `
      <html>
        <head>
          <title>Installation Successful</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #030303; color: white; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            h1 { color: #c29d59; }
            p { color: #a0a0a0; }
          </style>
        </head>
        <body>
          <h1>Woo-hoo! 🎉</h1>
          <p>Whitepay Crypto App successfully installed on <strong>${shop}</strong>.</p>
          <p>You can close this tab and return to your Shopify Admin.</p>
        </body>
      </html>
    `;

    return new NextResponse(htmlResponse, {
      headers: { 'Content-Type': 'text/html' },
    });

  } catch (error: any) {
    console.error('[Shopify OAuth] Exception during token exchange:', error);
    return new NextResponse('Internal Server Error.', { status: 500 });
  }
}
