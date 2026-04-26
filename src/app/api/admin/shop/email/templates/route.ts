import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

import { assertAdminRequest } from '@/lib/adminAuth';
import { writeAdminAuditLog, ADMIN_PERMISSIONS } from '@/lib/adminRbac';
import { prisma } from '@/lib/prisma';

type TemplateInput = {
  key?: string;
  name?: string;
  locale?: string;
  subject?: string;
  bodyHtml?: string;
  bodyText?: string | null;
  description?: string | null;
  variables?: string[] | null;
};

export async function GET() {
  try {
    const cookieStore = await cookies();
    assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_SETTINGS_READ);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const templates = await (prisma as any).shopEmailTemplate.findMany({
      orderBy: [{ key: 'asc' }, { locale: 'asc' }],
      include: { _count: { select: { rules: true } } },
    });

    return NextResponse.json({
      templates: templates.map(
        (t: Record<string, unknown> & { _count?: { rules: number }; createdAt: Date; updatedAt: Date }) => ({
          ...t,
          rulesCount: t._count?.rules ?? 0,
          createdAt: t.createdAt.toISOString(),
          updatedAt: t.updatedAt.toISOString(),
        })
      ),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: 'Failed to load templates' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const session = assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_SETTINGS_WRITE);

    const body = (await request.json().catch(() => ({}))) as TemplateInput;
    if (!body.key || !body.name || !body.subject || !body.bodyHtml) {
      return NextResponse.json({ error: 'key, name, subject and bodyHtml are required' }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const created = await (prisma as any).shopEmailTemplate.create({
      data: {
        key: body.key,
        name: body.name,
        locale: body.locale ?? 'en',
        subject: body.subject,
        bodyHtml: body.bodyHtml,
        bodyText: body.bodyText ?? null,
        description: body.description ?? null,
        variables: body.variables ?? null,
        createdBy: session.email,
      },
    });

    await writeAdminAuditLog(prisma, session, {
      scope: 'shop',
      action: 'email-template.create',
      entityType: 'shop.email-template',
      entityId: created.id,
      metadata: { key: body.key, name: body.name },
    });

    return NextResponse.json({ id: created.id });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 });
  }
}
