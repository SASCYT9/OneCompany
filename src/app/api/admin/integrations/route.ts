import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

import { assertAdminRequest } from '@/lib/adminAuth';
import { writeAdminAuditLog, ADMIN_PERMISSIONS } from '@/lib/adminRbac';
import { prisma } from '@/lib/prisma';

/**
 * GET   /api/admin/integrations               → list all integrations + status
 * POST  /api/admin/integrations               → connect/update an integration
 *
 * POST body: { provider, apiKey, apiSecret?, accountId?, configuration?, isActive? }
 *
 * NOTE: API keys are stored in plaintext for now. Production should encrypt
 * at rest using AES-256 with a KEK from a secure secret store.
 */

type Provider = 'MAILCHIMP' | 'META_ADS' | 'GOOGLE_ADS' | 'GOOGLE_ANALYTICS';

type ConnectBody = {
  provider?: Provider;
  apiKey?: string;
  apiSecret?: string | null;
  accountId?: string | null;
  configuration?: Record<string, unknown> | null;
  isActive?: boolean;
};

function maskKey(key: string | null | undefined): string | null {
  if (!key) return null;
  if (key.length <= 8) return '••••';
  return `${key.slice(0, 4)}••••${key.slice(-4)}`;
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_SETTINGS_READ);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const integrations = await (prisma as any).shopIntegration.findMany({
      orderBy: { provider: 'asc' },
    });

    return NextResponse.json({
      integrations: integrations.map(
        (
          i: Record<string, unknown> & {
            apiKey: string | null;
            apiSecret: string | null;
            createdAt: Date;
            updatedAt: Date;
            lastSyncAt: Date | null;
            connectedAt: Date | null;
          }
        ) => ({
          ...i,
          apiKey: maskKey(i.apiKey),
          apiSecret: i.apiSecret ? '••••••••' : null,
          createdAt: i.createdAt.toISOString(),
          updatedAt: i.updatedAt.toISOString(),
          lastSyncAt: i.lastSyncAt ? i.lastSyncAt.toISOString() : null,
          connectedAt: i.connectedAt ? i.connectedAt.toISOString() : null,
        })
      ),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: 'Failed to load integrations' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const session = assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_SETTINGS_WRITE);

    const body = (await request.json().catch(() => ({}))) as ConnectBody;
    if (!body.provider) return NextResponse.json({ error: 'provider required' }, { status: 400 });
    if (!body.apiKey || !body.apiKey.trim()) {
      return NextResponse.json({ error: 'apiKey required' }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const upserted = await (prisma as any).shopIntegration.upsert({
      where: { provider: body.provider },
      update: {
        apiKey: body.apiKey,
        apiSecret: body.apiSecret ?? null,
        accountId: body.accountId ?? null,
        configuration: body.configuration ?? null,
        isActive: body.isActive ?? true,
        connectedBy: session.email,
        connectedAt: new Date(),
        lastSyncStatus: null,
        lastSyncError: null,
      },
      create: {
        provider: body.provider,
        apiKey: body.apiKey,
        apiSecret: body.apiSecret ?? null,
        accountId: body.accountId ?? null,
        configuration: body.configuration ?? null,
        isActive: body.isActive ?? true,
        connectedBy: session.email,
        connectedAt: new Date(),
      },
    });

    await writeAdminAuditLog(prisma, session, {
      scope: 'admin',
      action: 'integration.connect',
      entityType: 'admin.integration',
      entityId: upserted.id,
      metadata: { provider: body.provider },
    });

    return NextResponse.json({ id: upserted.id, provider: body.provider });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: 'Failed to connect' }, { status: 500 });
  }
}
