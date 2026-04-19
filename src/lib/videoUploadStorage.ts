import path from 'path';

export const VIDEO_UPLOADS_SEGMENT = 'uploads';

export function resolveVideoUploadsDir(rootDir: string) {
  return path.join(rootDir, 'public', 'videos', VIDEO_UPLOADS_SEGMENT);
}

export function buildUploadedVideoAssetPath(filename: string) {
  return path.posix.join(VIDEO_UPLOADS_SEGMENT, filename);
}
