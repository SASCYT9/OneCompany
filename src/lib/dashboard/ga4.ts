import { BetaAnalyticsDataClient } from '@google-analytics/data';

export interface Ga4Metrics {
  activeUsers: number;
  sessions: number;
  periodDays: number;
}

/**
 * Fetch active users + sessions from Google Analytics 4 Data API.
 *
 * Requires two env vars:
 *   - GA4_PROPERTY_ID: numeric property id (e.g. "123456789")
 *   - GOOGLE_APPLICATION_CREDENTIALS_JSON: full service-account JSON as a single-line string
 *
 * Returns null when env is unset (so the dashboard can fall back gracefully)
 * or when the API call fails for any reason.
 */
export async function getGa4Metrics(periodDays: number): Promise<Ga4Metrics | null> {
  const propertyId = process.env.GA4_PROPERTY_ID;
  const credsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;

  if (!propertyId || !credsJson) return null;

  let credentials: { client_email: string; private_key: string };
  try {
    const parsed = JSON.parse(credsJson);
    credentials = {
      client_email: parsed.client_email,
      // Vercel env vars often contain literal "\n" — normalise to real newlines.
      private_key: String(parsed.private_key).replace(/\\n/g, '\n'),
    };
  } catch (err) {
    console.error('[GA4] Failed to parse GOOGLE_APPLICATION_CREDENTIALS_JSON:', err);
    return null;
  }

  try {
    const client = new BetaAnalyticsDataClient({ credentials });
    const [response] = await client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: `${periodDays}daysAgo`, endDate: 'today' }],
      metrics: [{ name: 'activeUsers' }, { name: 'sessions' }],
    });

    const row = response.rows?.[0]?.metricValues;
    return {
      activeUsers: Number(row?.[0]?.value ?? 0),
      sessions: Number(row?.[1]?.value ?? 0),
      periodDays,
    };
  } catch (err) {
    console.error('[GA4] Data API call failed:', err);
    return null;
  }
}
