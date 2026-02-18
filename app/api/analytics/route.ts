import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { NextResponse } from 'next/server';

export async function GET() {
  // 1. Lấy biến môi trường vào trong hàm để tránh lỗi build static
  const propertyId = process.env.GA4_PROPERTY_ID;
  const email = process.env.GOOGLE_CLIENT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY;

  // 2. Kiểm tra kỹ, nếu thiếu 1 trong 3 thì báo lỗi ngay (để TypeScript không bắt bẻ)
  if (!propertyId || !email || !key) {
    return NextResponse.json(
      { error: 'Chưa cấu hình đủ biến môi trường (GA4_ID, EMAIL, KEY)' }, 
      { status: 500 }
    );
  }

  try {
    // 3. Khởi tạo client khi đã chắc chắn có đủ thông tin
    const analyticsDataClient = new BetaAnalyticsDataClient({
      credentials: {
        client_email: email,
        private_key: key.replace(/\\n/g, '\n'), // Xử lý xuống dòng
      },
    });

    // --- Gọi báo cáo Realtime (Người đang online) ---
    const [realtimeResponse] = await analyticsDataClient.runRealtimeReport({
      property: `properties/${propertyId}`,
      metrics: [{ name: 'activeUsers' }],
    });

    const activeUsers = realtimeResponse.rows?.reduce((acc, row) => {
      return acc + Number(row.metricValues?.[0]?.value || 0);
    }, 0) || 0;

    // --- Gọi báo cáo 7 ngày (Tổng quan) ---
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
    });

  } catch (error: any) {
    console.error('Lỗi GA4 API:', error);
    return NextResponse.json(
      { error: error.message || 'Lỗi lấy dữ liệu Analytics' }, 
      { status: 500 }
    );
  }
}