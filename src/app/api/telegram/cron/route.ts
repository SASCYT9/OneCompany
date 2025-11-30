// Cron endpoint for scheduled tasks (reminders, digests)
// Call this endpoint periodically (e.g., every hour via Vercel Cron or external service)
import { NextRequest, NextResponse } from 'next/server';
import { sendAdminReminders, sendDailyDigest } from '@/lib/bot/reminders';

// Verify cron secret
function verifyCronAccess(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET || process.env.ADMIN_SECRET;
  
  if (!cronSecret) return false;
  
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7) === cronSecret;
  }
  
  const url = new URL(req.url);
  return url.searchParams.get('secret') === cronSecret;
}

// GET /api/telegram/cron?task=reminders
export async function GET(req: NextRequest) {
  // Vercel Cron uses GET requests
  if (!verifyCronAccess(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const url = new URL(req.url);
  const task = url.searchParams.get('task') || 'reminders';
  
  try {
    switch (task) {
      case 'reminders':
        const reminderResult = await sendAdminReminders();
        return NextResponse.json({
          task: 'reminders',
          ...reminderResult,
          timestamp: new Date().toISOString(),
        });
        
      case 'digest':
        const digestResult = await sendDailyDigest();
        return NextResponse.json({
          task: 'digest',
          ...digestResult,
          timestamp: new Date().toISOString(),
        });
        
      case 'all':
        const [reminders, digest] = await Promise.all([
          sendAdminReminders(),
          sendDailyDigest(),
        ]);
        return NextResponse.json({
          task: 'all',
          reminders,
          digest,
          timestamp: new Date().toISOString(),
        });
        
      default:
        return NextResponse.json(
          { error: 'Unknown task. Use: reminders, digest, all' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Cron error:', error);
    return NextResponse.json(
      { error: 'Cron task failed', details: String(error) },
      { status: 500 }
    );
  }
}

// POST for manual triggers
export async function POST(req: NextRequest) {
  if (!verifyCronAccess(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    const body = await req.json();
    const task = body.task || 'reminders';
    
    switch (task) {
      case 'reminders':
        const reminderResult = await sendAdminReminders();
        return NextResponse.json({ task: 'reminders', ...reminderResult });
        
      case 'digest':
        const digestResult = await sendDailyDigest();
        return NextResponse.json({ task: 'digest', ...digestResult });
        
      case 'reengage':
        const { sendReEngagementCampaign } = await import('@/lib/bot/reminders');
        const reengageResult = await sendReEngagementCampaign(body.message);
        return NextResponse.json({ task: 'reengage', ...reengageResult });
        
      default:
        return NextResponse.json({ error: 'Unknown task' }, { status: 400 });
    }
  } catch (error) {
    console.error('Cron POST error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
