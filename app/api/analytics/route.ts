import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic'; 

export async function GET() {
  const propertyId = process.env.GA4_PROPERTY_ID;
  const email = process.env.GOOGLE_CLIENT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY;

  if (!propertyId || !email || !key) {
    return NextResponse.json({ error: 'Thiếu biến môi trường' }, { status: 500 });
  }

  try {
    const analyticsDataClient = new BetaAnalyticsDataClient({
      credentials: {
        client_email: email,
        private_key: key.replace(/\\n/g, '\n'),
      },
    });

    // 1. Realtime (Người đang online)
    const [realtimeResponse] = await analyticsDataClient.runRealtimeReport({
      property: `properties/${propertyId}`,
      metrics: [{ name: 'activeUsers' }],
    });

    const activeUsers = realtimeResponse.rows?.reduce((acc, row) => {
      return acc + Number(row.metricValues?.[0]?.value || 0);
    }, 0) || 0;

    // 2. All Time Report (Tổng truy cập từ năm 2020 đến nay)
    const [basicResponse] = await analyticsDataClient.runReport({
      property: `properties/${propertyId}`,
      // Thay đổi ở đây: Lấy từ 2025-01-01 đến hôm nay
      dateRanges: [{ startDate: '2025-01-01', endDate: 'today' }], 
      metrics: [{ name: 'totalUsers' }], // Dùng metric 'totalUsers' chuẩn hơn cho All Time
    });

    const totalUsers = basicResponse.rows?.[0]?.metricValues?.[0]?.value || 0;

    return NextResponse.json({
      activeUsers,
      totalUsers, // Trả về biến tên là totalUsers
    }, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });

  } catch (error: any) {
    console.error('GA4 Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}