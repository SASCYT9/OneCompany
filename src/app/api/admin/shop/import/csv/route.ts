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
    const action = String(body.action ?? 'dry-run').trim().toLowerCase() === 'commit' ? 'commit' : 'dry-run';
    return {
      action,
      csvText: String(body.csvText ?? body.csv ?? body.data ?? '').trim(),
      supplierName: body.supplierName ? String(body.supplierName) : null,
      sourceFilename: body.sourceFilename ? String(body.sourceFilename) : null,
      templateId: body.templateId ? String(body.templateId) : null,
      conflictMode: body.conflictMode ? String(body.conflictMode) : null,
    } as const;
  }

  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    const file = formData.get('file');
    const action = String(formData.get('action') ?? 'dry-run').trim().toLowerCase() === 'commit' ? 'commit' : 'dry-run';
    const csvText =
      file instanceof File
        ? await file.text()
        : String(formData.get('csvText') ?? formData.get('csv') ?? '').trim();

    return {
      action,
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
    } as const;
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const session = assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_IMPORTS_MANAGE);
    const payload = await parseImportRequest(request);

    if (!payload) {
      return NextResponse.json(
        { error: 'Send JSON with { csvText|csv, action? } or form-data with file' },
        { status: 400 }
      );
    }

    if (!payload.csvText) {
      return NextResponse.json({ error: 'CSV payload is required' }, { status: 400 });
    }

    return NextResponse.json(await runShopCsvImport(prisma, session, payload));
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if ((error as Error).message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Admin shop CSV import compatibility route', error);
    return NextResponse.json({ error: 'Import failed' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
