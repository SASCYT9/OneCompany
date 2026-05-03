import NextAuth from "next-auth";
import { NextResponse, type NextRequest } from "next/server";
import { authOptions } from "@/lib/authOptions";

const handler = NextAuth(authOptions);

type RouteContext = { params: Promise<{ nextauth: string[] }> };

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

// NextAuth v4 catch-all handler expects the [...nextauth] params via the
// second context arg (it reads `req.query.nextauth` internally). Forwarding
// the App Router context keeps session / _log / signin / callback / error
// all working without falling back to the legacy shim every request.
export async function GET(request: NextRequest, ctx: RouteContext) {
  try {
    return await (handler as (req: NextRequest, ctx: RouteContext) => Promise<Response>)(request, ctx);
  } catch (error) {
    return buildAuthFallbackResponse(request, error);
  }
}

export async function POST(request: NextRequest, ctx: RouteContext) {
  try {
    return await (handler as (req: NextRequest, ctx: RouteContext) => Promise<Response>)(request, ctx);
  } catch (error) {
    return buildAuthFallbackResponse(request, error);
  }
}

export const runtime = 'nodejs';
