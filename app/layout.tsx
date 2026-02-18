import './globals.css'
import type { Metadata, Viewport } from 'next' // Import Viewport
import { Be_Vietnam_Pro, Playfair_Display, Montserrat } from 'next/font/google'
import Script from 'next/script' 
import './globals.css'

const vietnam = Be_Vietnam_Pro({ 
  subsets: ['latin', 'vietnamese'], 
  weight: ['400', '500', '600', '700'],
  variable: '--font-vietnam'
})
const playfair = Playfair_Display({ 
  subsets: ['latin', 'vietnamese'],
  variable: '--font-playfair'
})
const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-montserrat'
})

export const metadata: Metadata = {
  title: 'LAVANG - Trung Tâm Hành Hương',
  description: 'Lịch Phụng Vụ & Thời tiết Realtime',
}

// Cấu hình Viewport chuẩn Mobile App
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false, // Chặn zoom để giống app native
  viewportFit: 'cover', // Tràn viền tai thỏ
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="vi">
      <body className={`${vietnam.variable} ${playfair.variable} ${montserrat.variable} font-sans bg-black text-slate-100 overflow-hidden`}>
        {children}

        {/* --- GOOGLE ANALYTICS 4 (GA4) --- */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-P9BP8B5DJY"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-P9BP8B5DJY');
          `}
        </Script>
      </body>
    </html>
  )
}