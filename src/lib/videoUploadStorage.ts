import path from 'path';
import { buildStoredFilename, buildUploadedVideoBlobPathname } from '@/lib/runtimeBlobStorage';

export const VIDEO_UPLOADS_SEGMENT = 'uploads';

export function resolveVideoUploadsDir(rootDir: string) {
  return path.join(rootDir, 'public', 'videos', VIDEO_UPLOADS_SEGMENT);
}

export function buildUploadedVideoAssetPath(filename: string) {
  return path.posix.join(VIDEO_UPLOADS_SEGMENT, filename);
}

export function buildUploadedVideoStorageFilename(originalName: string, mimeType: string) {
  return buildStoredFilename(originalName, mimeType);
}

export function buildUploadedVideoBlobAssetPath(filename: string) {
  return buildUploadedVideoBlobPathname(filename);
}
