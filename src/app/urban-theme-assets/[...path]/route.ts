import { resolveUrbanThemeAssetUrl } from '@/lib/urbanThemeAssets';

export const runtime = 'nodejs';

type RouteContext = {
  params: Promise<{ path?: string[] }>;
};

function resolveAssetUrlFromSegments(segments: string[]): string {
  const relativePath = segments
    .map((segment) => decodeURIComponent(segment))
    .filter(Boolean)
    .join('/');

  return resolveUrbanThemeAssetUrl(relativePath);
}

export async function GET(request: Request, context: RouteContext) {
  const params = await context.params;
  const assetUrl = resolveAssetUrlFromSegments(params.path ?? []);

  if (!assetUrl || assetUrl.startsWith('/urban-theme-assets/')) {
    return new Response('Not found', { status: 404 });
  }

  return Response.redirect(new URL(assetUrl, request.url), 308);
}
