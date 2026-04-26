import { NextRequest, NextResponse } from 'next/server';

import { fireStuckOrderTriggers } from '@/lib/shopEmailEngine';

/**
 * Cron handler for time-based email triggers.
 *
 * Schedule via vercel.json:
 *   {
 *     "crons": [{ "path": "/api/cron/email-automation", "schedule": "0 9 * * *" }]
 *   }
 *
 * Runs daily at 09:00 UTC. Fires:
 *   - ORDER_STUCK_PENDING_PAYMENT_3D for orders pending payment ≥ 3 days
 *   - ORDER_STUCK_PROCESSING_5D for orders in processing ≥ 5 days
 *
 * Auth: requires header `Authorization: Bearer <CRON_SECRET>` if CRON_SECRET is set.
 * In Vercel cron mode, the platform also passes its own secret automatically.
 */

export async function GET(request: NextRequest) {
  // Optional auth check
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const result = await fireStuckOrderTriggers();
    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      ...result,
    });
  } catch (error: unknown) {
    console.error('Email cron error:', error);
    return NextResponse.json(
      { error: (error as Error).message || 'Cron run failed' },
      { status: 500 }
    );
  }
}
