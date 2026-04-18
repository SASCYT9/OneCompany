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


