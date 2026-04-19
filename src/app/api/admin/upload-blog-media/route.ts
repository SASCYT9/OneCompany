import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { cookies } from 'next/headers';
import { assertAdminRequest } from '@/lib/adminAuth';
import { ADMIN_PERMISSIONS, writeAdminAuditLog } from '@/lib/adminRbac';
import { prisma } from '@/lib/prisma';
import { validateAdminUpload } from '@/lib/adminUploadSecurity';

const blogDir = path.join(process.cwd(), 'public', 'blog');
const BLOG_MEDIA_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm',
] as const;
const BLOG_MEDIA_MAX_BYTES = 25 * 1024 * 1024;

async function ensurePaths() {
  await fs.mkdir(blogDir, { recursive: true });
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const session = assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_SETTINGS_WRITE);

    await ensurePaths();
    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const validated = validateAdminUpload({
      originalName: file.name,
      mimeType: file.type || 'application/octet-stream',
      sizeBytes: file.size,
      allowedMimeTypes: BLOG_MEDIA_MIME_TYPES,
      maxBytes: BLOG_MEDIA_MAX_BYTES,
    });
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const filename = `${Date.now()}-${validated.sanitizedFilename}`;
    const filepath = path.join(blogDir, filename);

    await fs.writeFile(filepath, buffer);

    try {
      await writeAdminAuditLog(prisma, session, {
        scope: 'content',
        action: 'blog-media.upload',
        entityType: 'site.blog-media',
        entityId: filename,
        metadata: {
          filename,
          mimeType: validated.mimeType,
          sizeBytes: validated.sizeBytes,
        },
      });
    } catch (auditError) {
      console.error('Failed to write blog media audit log', auditError);
    }

    return NextResponse.json({
      success: true,
      filename,
      url: `/blog/${filename}`,
      type: validated.mimeType,
    });
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if ((error as Error).message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (/file|type|large|extension/i.test((error as Error).message)) {
      return NextResponse.json({ error: (error as Error).message }, { status: 400 });
    }
    console.error('Failed to upload blog media', error);
    return NextResponse.json({ error: 'Failed to upload' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
