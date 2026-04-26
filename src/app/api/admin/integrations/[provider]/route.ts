import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

import { assertAdminRequest } from '@/lib/adminAuth';
import { writeAdminAuditLog, ADMIN_PERMISSIONS } from '@/lib/adminRbac';
import { prisma } from '@/lib/prisma';

/**
 * DELETE /api/admin/integrations/[provider]                  → disconnect
 * POST   /api/admin/integrations/[provider]?action=test       → fire a tiny test request
 * POST   /api/admin/integrations/[provider]?action=sync       → trigger a sync (placeholder)
 */

type Provider = 'MAILCHIMP' | 'META_ADS' | 'GOOGLE_ADS' | 'GOOGLE_ANALYTICS';

const VALID_PROVIDERS = ['MAILCHIMP', 'META_ADS', 'GOOGLE_ADS', 'GOOGLE_ANALYTICS'] as const;

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const cookieStore = await cookies();
    const session = assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_SETTINGS_WRITE);

    const { provider } = await params;
    if (!VALID_PROVIDERS.includes(provider as Provider)) {
      return NextResponse.json({ error: 'Unknown provider' }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma as any).shopIntegration.deleteMany({ where: { provider } });

    await writeAdminAuditLog(prisma, session, {
      scope: 'admin',
      action: 'integration.disconnect',
      entityType: 'admin.integration',
      entityId: provider,
      metadata: { provider },
    });

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const cookieStore = await cookies();
    const session = assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_SETTINGS_WRITE);

    const { provider } = await params;
    const action = request.nextUrl.searchParams.get('action') || 'test';

    if (!VALID_PROVIDERS.includes(provider as Provider)) {
      return NextResponse.json({ error: 'Unknown provider' }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const integration = await (prisma as any).shopIntegration.findUnique({ where: { provider } });
    if (!integration) return NextResponse.json({ error: 'Not connected' }, { status: 404 });

    if (action === 'test') {
      // Provider-specific ping
      let ok = false;
      let error: string | null = null;
      try {
        if (provider === 'MAILCHIMP') {
          ok = await testMailchimp(integration.apiKey);
        } else if (provider === 'META_ADS') {
          ok = await testMetaAds(integration.apiKey, integration.accountId);
        } else {
          ok = false;
          error = 'Test not implemented for this provider';
        }
      } catch (e) {
        ok = false;
        error = (e as Error).message;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (prisma as any).shopIntegration.update({
        where: { provider },
        data: {
          lastSyncStatus: ok ? 'SUCCESS' : 'FAILED',
          lastSyncError: error,
          lastSyncAt: new Date(),
        },
      });

      await writeAdminAuditLog(prisma, session, {
        scope: 'admin',
        action: 'integration.test',
        entityType: 'admin.integration',
        entityId: provider,
        metadata: { provider, ok, error },
      });

      return NextResponse.json({ ok, error });
    }

    if (action === 'sync') {
      // Placeholder — actual sync logic per provider can be hooked in later
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (prisma as any).shopIntegration.update({
        where: { provider },
        data: { lastSyncStatus: 'PENDING', lastSyncAt: new Date() },
      });
      return NextResponse.json({ ok: true, status: 'queued' });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Action failed' }, { status: 500 });
  }
}

// ─── provider-specific ping helpers ─────────────────────────────────────

async function testMailchimp(apiKey: string | null): Promise<boolean> {
  if (!apiKey) throw new Error('Missing API key');
  // Mailchimp API keys end in `-usX` where X is the data center
  const dc = apiKey.split('-').pop();
  if (!dc) throw new Error('Invalid Mailchimp API key format (missing -dc suffix)');
  const response = await fetch(`https://${dc}.api.mailchimp.com/3.0/ping`, {
    headers: { Authorization: `apikey ${apiKey}` },
  });
  return response.ok;
}

async function testMetaAds(apiKey: string | null, accountId: string | null): Promise<boolean> {
  if (!apiKey) throw new Error('Missing access token');
  if (!accountId) throw new Error('Missing account id (act_XXXXXX)');
  const response = await fetch(`https://graph.facebook.com/v19.0/${accountId}?fields=id,name&access_token=${apiKey}`);
  return response.ok;
}
