import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const shop = req.nextUrl.searchParams.get('shop');
  
  if (!shop) {
    return new NextResponse('Missing shop parameter.', { status: 400 });
  }

  // Format: myshop.myshopify.com
  const sanitizedShop = shop.replace(/https?:\/\//, '').replace(/\/$/, '');

  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://onecompany.global';
  const redirectUri = `${baseUrl}/api/shopify/auth/callback`;

  if (!clientId) {
    console.error('SHOPIFY_CLIENT_ID is missing');
    return new NextResponse('Server configuration error.', { status: 500 });
  }

  const scopes = 'write_orders,read_orders';
  
  // Create a random nonce for security
  const nonce = Math.random().toString(36).substring(2, 15);

  const authUrl = `https://${sanitizedShop}/admin/oauth/authorize?client_id=${clientId}&scope=${scopes}&redirect_uri=${redirectUri}&state=${nonce}&grant_options[]=`;

  return NextResponse.redirect(authUrl);
}
