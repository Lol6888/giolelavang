// app/api/analytics/route.ts
import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { NextResponse } from 'next/server';

const analyticsDataClient = new BetaAnalyticsDataClient({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
});

const propertyId = process.env.GA4_PROPERTY_ID;

export async function GET() {
  try {
    if (!propertyId || !process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
        return NextResponse.json({ error: 'Missing Environment Variables' }, { status: 500 });
    }

    // 1. Lấy khách đang online (Realtime 30p)
    const [realtimeResponse] = await analyticsDataClient.runRealtimeReport({
      property: `properties/${propertyId}`,
      metrics: [{ name: 'activeUsers' }],
    });

    const activeUsers = realtimeResponse.rows?.reduce((acc, row) => {
        return acc + Number(row.metricValues?.[0]?.value || 0);
    }, 0) || 0;

    // 2. Lấy thống kê 7 ngày qua
    const [basicResponse] = await analyticsDataClient.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
      metrics: [{ name: 'activeUsers' }, { name: 'screenPageViews' }],
    });

    const totalUsers7Days = basicResponse.rows?.[0]?.metricValues?.[0]?.value || 0;
    const totalViews7Days = basicResponse.rows?.[0]?.metricValues?.[1]?.value || 0;

    return NextResponse.json({ activeUsers, totalUsers7Days, totalViews7Days });

  } catch (error) {
    console.error('GA4 API Error:', error);
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
  }
}