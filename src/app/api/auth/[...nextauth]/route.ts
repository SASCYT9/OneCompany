import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/authOptions";

const handler = NextAuth(authOptions);

function buildAuthFallbackResponse(request: Request, error: unknown) {
  const url = new URL(request.url);
  const action = url.pathname.split('/').pop();

  console.error('NextAuth route failed', action, error);

  if (action === 'session') {
    return NextResponse.json({});
  }

  if (action === '_log') {
    return NextResponse.json({ ok: true });
  }

  /* For callback actions (login attempts), return the format signIn() expects
     so redirect: false works correctly on the client side */
  if (action === 'credentials' || url.pathname.includes('/callback/')) {
    return NextResponse.json(
      { url: url.origin, ok: false, status: 401, error: 'CredentialsSignin' },
      { status: 200 } // NextAuth client expects 200 even for failed auth
    );
  }

  /* For /api/auth/error — redirect to login page instead of showing raw JSON */
  if (action === 'error') {
    /* Detect locale from referer so we don't lose /ua/ → /en/ */
    const referer = (request.headers as Headers)?.get?.('referer') ?? '';
    const locale = referer.includes('/ua/') ? 'ua' : 'en';
    const loginUrl = new URL(`/${locale}/shop/account/login`, url.origin);
    loginUrl.searchParams.set('error', 'auth');
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.json({ error: 'Auth route unavailable' }, { status: 500 });
}

export async function GET(request: Request) {
  try {
    return await handler(request);
  } catch (error) {
    return buildAuthFallbackResponse(request, error);
  }
}

export async function POST(request: Request) {
  try {
    return await handler(request);
  } catch (error) {
    return buildAuthFallbackResponse(request, error);
  }
}

export const runtime = 'nodejs';
