// Analytics API endpoint
import { NextRequest, NextResponse } from 'next/server';
import { 
  getBotStats, 
  getConversionStats, 
  getActivityDistribution, 
  getResponseTimeStats,
  getTopSources,
} from '@/lib/bot/analytics';
import { matchesBearerSecret, resolveSecret } from '@/lib/requestSecrets';

// Verify admin access
function verifyAccess(req: NextRequest): boolean {
  return matchesBearerSecret(req.headers, resolveSecret('ADMIN_SECRET', 'TELEGRAM_ADMIN_SECRET'));
}

// GET /api/telegram/analytics
export async function GET(req: NextRequest) {
  if (!verifyAccess(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const url = new URL(req.url);
  const period = (url.searchParams.get('period') || 'week') as 'day' | 'week' | 'month' | 'all';
  const type = url.searchParams.get('type') || 'full';
  
  try {
    switch (type) {
      case 'basic':
        const basicStats = await getBotStats(period);
        return NextResponse.json(basicStats);
        
      case 'conversion':
        const conversionStats = await getConversionStats();
        return NextResponse.json(conversionStats);
        
      case 'activity':
        const activityStats = await getActivityDistribution();
        return NextResponse.json(activityStats);
        
      case 'response':
        const responseStats = await getResponseTimeStats();
        return NextResponse.json(responseStats);
        
      case 'sources':
        const sources = await getTopSources();
        return NextResponse.json({ sources });
        
      case 'full':
      default:
        const [stats, conversion, activity, response, topSources] = await Promise.all([
          getBotStats(period),
          getConversionStats(),
          getActivityDistribution(),
          getResponseTimeStats(),
          getTopSources(),
        ]);
        
        return NextResponse.json({
          stats,
          conversion,
          activity,
          response,
          topSources,
          generatedAt: new Date().toISOString(),
        });
    }
  } catch (error) {
    console.error('Analytics error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}
