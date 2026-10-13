import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { assertAdminRequest } from "@/lib/adminAuth";
import { ADMIN_PERMISSIONS, writeAdminAuditLog } from "@/lib/adminRbac";
import { listShopCustomersAdmin } from "@/lib/shopAdminCustomers";
import { hashShopCustomerPassword } from "@/lib/shopCustomers";
import { isUsableShopCustomerEmail, normalizeShopCustomerEmail } from "@/lib/shopCustomerEmail";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    await assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_CUSTOMERS_READ);

    const url = new URL(request.url);
    const customers = await listShopCustomersAdmin(prisma, {
      q: url.searchParams.get("q"),
      group: url.searchParams.get("group"),
      status: url.searchParams.get("status"),
    });

    return NextResponse.json(customers);
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if ((error as Error).message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Admin customers list", error);
    return NextResponse.json({ error: "Failed to list customers" }, { status: 500 });
  }
}

/**
 * POST /api/admin/shop/customers — a manager creates a customer by hand.
 * No password is set here: the customer sets one through a setup link from
 * the customer card. Brand discounts are configured on the card afterwards.
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const session = await assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_CUSTOMERS_WRITE);

    const data = ((await request.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
    const email = normalizeShopCustomerEmail(data.email);
    const firstName = String(data.firstName ?? "").trim();
    const lastName = String(data.lastName ?? "").trim();
    const text = (value: unknown) => {
      const trimmed = String(value ?? "").trim();
      return trimmed ? trimmed : null;
    };

    if (!firstName) {
      return NextResponse.json({ error: "Вкажіть ім’я клієнта" }, { status: 400 });
    }
    if (!isUsableShopCustomerEmail(email)) {
      return NextResponse.json(
        { error: "Вкажіть справжній email — це логін клієнта" },
        { status: 400 }
      );
    }

    const existing = await prisma.shopCustomer.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Клієнт з таким email уже є", existingCustomerId: existing.id },
        { status: 409 }
      );
    }

    const group =
      data.group === "B2B_APPROVED" || data.group === "B2B_PENDING" ? data.group : "B2C";
    const normalizedPassword = data.password ? String(data.password).trim() : "";

    const customer = await prisma.shopCustomer.create({
      data: {
        email,
        firstName,
        lastName,
        phone: text(data.phone),
        companyName: text(data.companyName),
        vatNumber: text(data.vatNumber),
        notes: text(data.notes),
        group,
        isActive: data.isActive !== false,
        preferredLocale: data.preferredLocale === "en" ? "en" : "ua",
        ...(normalizedPassword
          ? {
              account: {
                create: {
                  passwordHash: await hashShopCustomerPassword(normalizedPassword),
                },
              },
            }
          : {}),
      },
      select: { id: true, email: true, firstName: true, lastName: true, group: true },
    });

    await writeAdminAuditLog(prisma, session, {
      scope: "shop",
      action: "customer.create",
      entityType: "shop.customer",
      entityId: customer.id,
      metadata: { email: customer.email, group: customer.group },
    });

    return NextResponse.json({ success: true, customerId: customer.id, customer });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if ((error as Error).message === "FORBIDDEN")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("Admin customer create", error);
    return NextResponse.json({ error: "Не вдалося створити клієнта" }, { status: 500 });
  }
}

export const runtime = "nodejs";
