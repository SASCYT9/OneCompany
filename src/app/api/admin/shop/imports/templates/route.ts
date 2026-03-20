import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { assertAdminRequest } from '@/lib/adminAuth';
import { ADMIN_PERMISSIONS } from '@/lib/adminRbac';
import { prisma } from '@/lib/prisma';
import {
  createImportTemplate,
  listImportTemplates,
  normalizeImportTemplatePayload,
} from '@/lib/shopAdminImports';

export async function GET() {
  try {
    const cookieStore = await cookies();
    assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_IMPORTS_MANAGE);

    return NextResponse.json(await listImportTemplates(prisma));
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if ((error as Error).message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Admin import templates list', error);
    return NextResponse.json({ error: 'Failed to list templates' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const session = assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_IMPORTS_MANAGE);
    const body = await request.json().catch(() => ({}));
    const { data, errors } = normalizeImportTemplatePayload(body);

    if (errors.length) {
      return NextResponse.json({ error: errors.join(', ') }, { status: 400 });
    }

    return NextResponse.json(await createImportTemplate(prisma, data, session));
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if ((error as Error).message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Admin import template create', error);
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
