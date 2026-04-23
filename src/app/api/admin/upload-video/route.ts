import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { promises as fs } from 'fs';
import path from 'path';
import { assertAdminRequest } from '@/lib/adminAuth';
import { ADMIN_PERMISSIONS, writeAdminAuditLog } from '@/lib/adminRbac';
import { prisma } from '@/lib/prisma';
import { validateAdminUpload } from '@/lib/adminUploadSecurity';
import { readVideoConfig, writeVideoConfig } from '@/lib/videoConfig';
import {
  buildUploadedVideoAssetPath,
  buildUploadedVideoBlobAssetPath,
  buildUploadedVideoStorageFilename,
  VIDEO_UPLOADS_SEGMENT,
} from '@/lib/videoUploadStorage';
import { getRuntimeStorageProvider, putPublicBlob } from '@/lib/runtimeBlobStorage';

const videosDir = path.join(/*turbopackIgnore: true*/ process.cwd(), 'public', 'videos', VIDEO_UPLOADS_SEGMENT);
const VIDEO_MIME_TYPES = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'] as const;
const VIDEO_MAX_BYTES = 150 * 1024 * 1024;

async function ensurePaths() {
  await fs.mkdir(/*turbopackIgnore: true*/ videosDir, { recursive: true });
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const session = assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_SETTINGS_WRITE);
    const formData = await request.formData();
    const file = formData.get('video');
    
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: 'No file uploaded' },
        { status: 400 }
      );
    }

    const validated = validateAdminUpload({
      originalName: file.name,
      mimeType: file.type || 'application/octet-stream',
      sizeBytes: file.size,
      allowedMimeTypes: VIDEO_MIME_TYPES,
      maxBytes: VIDEO_MAX_BYTES,
    });
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const filename = buildUploadedVideoStorageFilename(file.name, validated.mimeType);
    const storageProvider = getRuntimeStorageProvider();
    let assetPath: string;

    if (storageProvider === 'vercel-blob') {
      const pathname = buildUploadedVideoBlobAssetPath(filename);
      const uploaded = await putPublicBlob(pathname, buffer, validated.mimeType);
      assetPath = uploaded.url;
    } else {
      await ensurePaths();
      assetPath = buildUploadedVideoAssetPath(filename);
      const filepath = path.join(/*turbopackIgnore: true*/ videosDir, filename);
      await fs.writeFile(/*turbopackIgnore: true*/ filepath, buffer);
    }

    const currentConfig = await readVideoConfig();
    const config = await writeVideoConfig({
      videos: Array.from(new Set([assetPath, ...currentConfig.videos])),
    });

    try {
      await writeAdminAuditLog(prisma, session, {
        scope: 'content',
        action: 'video.upload',
        entityType: 'site.video',
        entityId: assetPath,
        metadata: {
          filename: assetPath,
          storageFilename: filename,
          storageProvider,
          mimeType: validated.mimeType,
          sizeBytes: validated.sizeBytes,
          videosCount: config.videos.length,
        },
      });
    } catch (auditError) {
      console.error('Failed to write video upload audit log', auditError);
    }

    return NextResponse.json({ success: true, filename: assetPath });
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
    return NextResponse.json(
      { error: 'Failed to upload video' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
