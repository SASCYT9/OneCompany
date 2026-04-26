import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

import { assertAdminRequest } from '@/lib/adminAuth';
import { writeAdminAuditLog, ADMIN_PERMISSIONS } from '@/lib/adminRbac';
import { prisma } from '@/lib/prisma';

type RuleInput = {
  name?: string;
  trigger?: string;
  templateId?: string;
  conditions?: Record<string, unknown> | null;
  isActive?: boolean;
  description?: string | null;
};

export async function GET() {
  try {
    const cookieStore = await cookies();
    assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_SETTINGS_READ);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rules = await (prisma as any).shopEmailRule.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        template: { select: { key: true, name: true, locale: true, subject: true } },
        _count: { select: { sends: true } },
      },
    });

    return NextResponse.json({
      rules: rules.map(
        (r: Record<string, unknown> & { _count?: { sends: number }; createdAt: Date; updatedAt: Date }) => ({
          ...r,
          sendsCount: r._count?.sends ?? 0,
          createdAt: r.createdAt.toISOString(),
          updatedAt: r.updatedAt.toISOString(),
        })
      ),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    console.error('Email rules list error:', error);
    return NextResponse.json({ error: 'Failed to load rules' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const session = assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_SETTINGS_WRITE);

    const body = (await request.json().catch(() => ({}))) as RuleInput;
    if (!body.name || !body.trigger || !body.templateId) {
      return NextResponse.json({ error: 'name, trigger and templateId are required' }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const created = await (prisma as any).shopEmailRule.create({
      data: {
        name: body.name,
        trigger: body.trigger,
        templateId: body.templateId,
        conditions: body.conditions ?? null,
        isActive: body.isActive ?? true,
        description: body.description ?? null,
        createdBy: session.email,
      },
    });

    await writeAdminAuditLog(prisma, session, {
      scope: 'shop',
      action: 'email-rule.create',
      entityType: 'shop.email-rule',
      entityId: created.id,
      metadata: { name: body.name, trigger: body.trigger },
    });

    return NextResponse.json({ id: created.id });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    console.error('Email rule create error:', error);
    return NextResponse.json({ error: 'Failed to create rule' }, { status: 500 });
  }
}
