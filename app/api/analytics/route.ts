import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { NextResponse } from 'next/server';

// --- THÊM DÒNG NÀY ĐỂ ÉP CHẠY REALTIME TRÊN VERCEL ---
export const dynamic = 'force-dynamic'; 

export async function GET() {
  const propertyId = process.env.GA4_PROPERTY_ID;
  const email = process.env.GOOGLE_CLIENT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY;

  if (!propertyId || !email || !key) {
    return NextResponse.json(
      { error: 'Chưa cấu hình đủ biến môi trường trên Vercel' }, 
      { status: 500 }
    );
  }

  try {
    const analyticsDataClient = new BetaAnalyticsDataClient({
      credentials: {
        client_email: email,
        private_key: key.replace(/\\n/g, '\n'),
      },
    });

    // 1. Realtime Report
    const [realtimeResponse] = await analyticsDataClient.runRealtimeReport({
      property: `properties/${propertyId}`,
      metrics: [{ name: 'activeUsers' }],
    });

    const activeUsers = realtimeResponse.rows?.reduce((acc, row) => {
      return acc + Number(row.metricValues?.[0]?.value || 0);
    }, 0) || 0;

    // 2. Basic Report
    const [basicResponse] = await analyticsDataClient.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
      metrics: [{ name: 'activeUsers' }, { name: 'screenPageViews' }],
    });

    const totalUsers7Days = basicResponse.rows?.[0]?.metricValues?.[0]?.value || 0;
    const totalViews7Days = basicResponse.rows?.[0]?.metricValues?.[1]?.value || 0;

    return NextResponse.json({
      activeUsers,
      totalUsers7Days,
      totalViews7Days
    }, {
      // Thêm headers cấm cache cho chắc ăn
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });

  } catch (error: any) {
    console.error('GA4 API Error:', error);
    return NextResponse.json(
      { error: error.message || 'Lỗi kết nối GA4' }, 
      { status: 500 }
    );
  }
}