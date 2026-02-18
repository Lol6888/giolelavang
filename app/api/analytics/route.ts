import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const propertyId = process.env.GA4_PROPERTY_ID;
  const email = process.env.GOOGLE_CLIENT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY;

  if (!propertyId || !email || !key) {
    return NextResponse.json({ error: 'Thiếu cấu hình Env' }, { status: 500 });
  }

  try {
    const client = new BetaAnalyticsDataClient({
      credentials: {
        client_email: email,
        private_key: key.replace(/\\n/g, '\n'),
      },
    });

    // Tính ngày đầu tháng (YYYY-MM-01)
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const firstDayOfMonth = `${year}-${month}-01`;

    // Chúng ta chạy song song 3 báo cáo để tiết kiệm thời gian
    const [totalReport, monthReport, todayReport] = await Promise.all([
      // 1. Tổng cộng (Từ 2025)
      client.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [{ startDate: '2025-01-01', endDate: 'today' }],
        metrics: [{ name: 'sessions' }], // Đếm lượt truy cập (sessions)
      }),
      // 2. Trong tháng (Từ ngày 1 đến nay)
      client.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [{ startDate: firstDayOfMonth, endDate: 'today' }],
        metrics: [{ name: 'sessions' }],
      }),
      // 3. Hôm nay
      client.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [{ startDate: 'today', endDate: 'today' }],
        metrics: [{ name: 'sessions' }],
      }),
    ]);

    // Lấy giá trị ra (Nếu không có dữ liệu thì trả về 0)
    const total = totalReport[0].rows?.[0]?.metricValues?.[0]?.value || 0;
    const monthVal = monthReport[0].rows?.[0]?.metricValues?.[0]?.value || 0;
    const today = todayReport[0].rows?.[0]?.metricValues?.[0]?.value || 0;

    return NextResponse.json({
      total,
      month: monthVal,
      today
    }, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });

  } catch (error: any) {
    console.error('GA4 Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}