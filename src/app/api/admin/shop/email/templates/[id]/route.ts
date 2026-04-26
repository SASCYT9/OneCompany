import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

import { assertAdminRequest } from '@/lib/adminAuth';
import { writeAdminAuditLog, ADMIN_PERMISSIONS } from '@/lib/adminRbac';
import { prisma } from '@/lib/prisma';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_SETTINGS_READ);

    const { id } = await params;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const template = await (prisma as any).shopEmailTemplate.findUnique({ where: { id } });
    if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 });

    return NextResponse.json({
      ...template,
      createdAt: template.createdAt.toISOString(),
      updatedAt: template.updatedAt.toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Failed to load template' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const session = assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_SETTINGS_WRITE);

    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.locale !== undefined) data.locale = body.locale;
    if (body.subject !== undefined) data.subject = body.subject;
    if (body.bodyHtml !== undefined) data.bodyHtml = body.bodyHtml;
    if (body.bodyText !== undefined) data.bodyText = body.bodyText;
    if (body.description !== undefined) data.description = body.description;
    if (body.variables !== undefined) data.variables = body.variables;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma as any).shopEmailTemplate.update({ where: { id }, data });

    await writeAdminAuditLog(prisma, session, {
      scope: 'shop',
      action: 'email-template.update',
      entityType: 'shop.email-template',
      entityId: id,
      metadata: { updates: Object.keys(data) },
    });

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: 'Failed to update template' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const session = assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_SETTINGS_WRITE);

    const { id } = await params;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const template = await (prisma as any).shopEmailTemplate.findUnique({ where: { id } });
    if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    if (template.isSystem) {
      return NextResponse.json({ error: 'System templates cannot be deleted' }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma as any).shopEmailTemplate.delete({ where: { id } });

    await writeAdminAuditLog(prisma, session, {
      scope: 'shop',
      action: 'email-template.delete',
      entityType: 'shop.email-template',
      entityId: id,
      metadata: {},
    });

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 });
  }
}
