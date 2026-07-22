import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  adminSessionCookieOptions,
  createSessionToken,
} from "@/lib/adminAuth";
import { getCurrentAdminAccess } from "@/lib/admin/adminAccess";
import { authenticateAdminCredentials, type AdminLoginRepository } from "@/lib/admin/adminLogin";
import { createInitialAdminBootstrap } from "@/lib/adminRbac";
import { consumeRateLimit, getRequestIp } from "@/lib/shopPublicRateLimit";
import { prisma } from "@/lib/prisma";

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW_PER_IP = 20;
const MAX_PER_WINDOW_GLOBAL = 200;

function getAdminPasswordOrNull() {
  const configured = (process.env.ADMIN_PASSWORD || "").trim();
  if (configured) return configured;

  const isProd = process.env.NODE_ENV === "production";
  if (isProd) return null;

  const allowFallback = (process.env.ALLOW_DEV_ADMIN_PASSWORD_FALLBACK || "").trim() === "1";
  return allowFallback ? "admin123" : null;
}

function isAdminBootstrapEnabled() {
  return (process.env.ADMIN_BOOTSTRAP_ENABLED || "").trim() === "1";
}

const adminLoginRepository: AdminLoginRepository = {
  findByEmail(email) {
    return prisma.adminUser.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        isActive: true,
        passwordHash: true,
        roles: {
          select: {
            role: {
              select: {
                key: true,
                permissions: true,
              },
            },
          },
        },
      },
    });
  },
  async markLogin(id, loggedInAt) {
    await prisma.adminUser.update({
      where: { id },
      data: { lastLoginAt: loggedInAt },
    });
  },
  bootstrapIfEmpty() {
    return createInitialAdminBootstrap(prisma);
  },
};

export async function POST(request: NextRequest) {
  try {
    const ip = getRequestIp(request.headers);
    if (
      !(await consumeRateLimit({
        keyParts: ["admin-auth", ip],
        windowMs: WINDOW_MS,
        maxPerWindow: MAX_PER_WINDOW_PER_IP,
      })) ||
      !(await consumeRateLimit({
        keyParts: ["admin-auth-global"],
        windowMs: WINDOW_MS,
        maxPerWindow: MAX_PER_WINDOW_GLOBAL,
      }))
    ) {
      return NextResponse.json({ error: "Too many attempts" }, { status: 429 });
    }

    const { email, password } = await request.json();
    const fallbackEmail = (process.env.ADMIN_EMAIL || "admin@onecompany.local")
      .trim()
      .toLowerCase();

    const admin = await authenticateAdminCredentials(
      { email, password },
      {
        fallbackEmail,
        fallbackPassword: getAdminPasswordOrNull(),
        bootstrapEnabled: isAdminBootstrapEnabled(),
      },
      adminLoginRepository
    );

    if (admin) {
      const response = NextResponse.json({ success: true });
      response.cookies.set(
        ADMIN_SESSION_COOKIE,
        createSessionToken({
          email: admin.email,
          name: admin.name,
          permissions: admin.permissions,
        }),
        adminSessionCookieOptions
      );
      return response;
    }

    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  } catch {
    return NextResponse.json({ error: "Authentication failed" }, { status: 500 });
  }
}

export const runtime = "nodejs";

export async function GET() {
  try {
    const access = await getCurrentAdminAccess();
    return NextResponse.json({
      authenticated: Boolean(access),
      session: access,
    });
  } catch (error) {
    console.error("Failed to resolve current admin access", error);
    return NextResponse.json(
      { authenticated: false, session: null, error: "Auth state unavailable" },
      { status: 503 }
    );
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(ADMIN_SESSION_COOKIE, "", {
    ...adminSessionCookieOptions,
    maxAge: 0,
  });
  return response;
}
