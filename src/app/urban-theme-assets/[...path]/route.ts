import fs from 'node:fs/promises';
import path from 'node:path';

const ASSET_DIR = path.join(
  process.cwd(),
  'reference',
  'urban-shopify-theme',
  'assets'
);

const MIME_TYPES: Record<string, string> = {
  '.avif': 'image/avif',
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mp4': 'video/mp4',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webm': 'video/webm',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

export const runtime = 'nodejs';

type RouteContext = {
  params: Promise<{ path?: string[] }>;
};

function resolveAssetPath(segments: string[]): string | null {
  const decodedSegments = segments.map((segment) => decodeURIComponent(segment));
  const assetPath = path.resolve(ASSET_DIR, ...decodedSegments);
  const normalizedAssetDir = `${ASSET_DIR}${path.sep}`;

  if (assetPath !== ASSET_DIR && !assetPath.startsWith(normalizedAssetDir)) {
    return null;
  }

  return assetPath;
}

export async function GET(_: Request, context: RouteContext) {
  const params = await context.params;
  const segments = params.path ?? [];
  const assetPath = resolveAssetPath(segments);

  if (!assetPath) {
    return new Response('Not found', { status: 404 });
  }

  try {
    const file = await fs.readFile(assetPath);
    const ext = path.extname(assetPath).toLowerCase();
    const contentType = MIME_TYPES[ext] ?? 'application/octet-stream';

    return new Response(file, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
