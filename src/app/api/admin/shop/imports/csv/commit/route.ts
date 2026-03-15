import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { assertAdminRequest } from '@/lib/adminAuth';
import { ADMIN_PERMISSIONS } from '@/lib/adminRbac';
import { runShopCsvImport } from '@/lib/shopAdminImports';

const prisma = new PrismaClient();

async function parseImportRequest(request: NextRequest) {
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    return {
      csvText: String(body.csvText ?? body.csv ?? body.data ?? '').trim(),
      supplierName: body.supplierName ? String(body.supplierName) : null,
      sourceFilename: body.sourceFilename ? String(body.sourceFilename) : null,
      templateId: body.templateId ? String(body.templateId) : null,
      conflictMode: body.conflictMode ? String(body.conflictMode) : null,
    };
  }

  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    const file = formData.get('file');
    const csvText =
      file instanceof File
        ? await file.text()
        : String(formData.get('csvText') ?? formData.get('csv') ?? '').trim();

    return {
      csvText,
      supplierName: formData.get('supplierName') ? String(formData.get('supplierName')) : null,
      sourceFilename:
        file instanceof File
          ? file.name
          : formData.get('sourceFilename')
            ? String(formData.get('sourceFilename'))
            : null,
      templateId: formData.get('templateId') ? String(formData.get('templateId')) : null,
      conflictMode: formData.get('conflictMode') ? String(formData.get('conflictMode')) : null,
    };
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const session = assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_IMPORTS_MANAGE);
    const payload = await parseImportRequest(request);

    if (!payload) {
      return NextResponse.json({ error: 'Send JSON or form-data with CSV payload' }, { status: 400 });
    }

    if (!payload.csvText) {
      return NextResponse.json({ error: 'CSV payload is required' }, { status: 400 });
    }

    return NextResponse.json(
      await runShopCsvImport(prisma, session, {
        ...payload,
        action: 'commit',
      })
    );
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if ((error as Error).message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Admin CSV commit', error);
    return NextResponse.json({ error: 'Import commit failed' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
