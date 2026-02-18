'use client'
import { useEffect, useState } from 'react'
import { Users, Eye, Loader2 } from 'lucide-react'

export default function AdminFooter() {
  // Khởi tạo state chấp nhận cả số và chuỗi để tránh lỗi type
  const [stats, setStats] = useState<any>({ activeUsers: 0, totalUsers7Days: 0, totalViews7Days: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchGA4() {
      try {
        const res = await fetch('/api/analytics')
        const data = await res.json()
        console.log("GA4 Data:", data) // Giữ log để check
        if (data && !data.error) setStats(data)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    fetchGA4()
    const interval = setInterval(fetchGA4, 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    // THAY ĐỔI LỚN Ở ĐÂY:
    // 1. fixed bottom-0: Ghim chặt xuống đáy
    // 2. z-[9999]: Nổi lên trên tất cả mọi thứ
    // 3. border-t-gold: Viền vàng để dễ nhận biết
    <footer className="fixed bottom-0 left-0 right-0 z-[9999] bg-slate-900/95 backdrop-blur-md border-t border-yellow-500/50 py-2 px-4 shadow-[0_-5px_20px_rgba(0,0,0,0.5)]">
      
      <div className="flex justify-between items-center max-w-7xl mx-auto">
        
        {/* Copyright */}
        <div className="text-[10px] text-slate-400 font-mono hidden sm:block">
          LAVANG SYSTEM © 2024
        </div>

        {/* Thông số - Căn giữa trên Mobile */}
        <div className="flex items-center gap-4 sm:gap-6 w-full sm:w-auto justify-center sm:justify-end">
          
          {/* Active Users */}
          <div className="flex items-center gap-2 bg-green-900/20 px-3 py-1 rounded-full border border-green-500/30">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            <span className="font-bold text-green-400 font-mono text-sm">
              {loading ? <Loader2 className="w-3 h-3 animate-spin"/> : stats.activeUsers}
            </span>
            <span className="text-[9px] text-green-300 uppercase font-bold tracking-wider">Online</span>
          </div>

          {/* Users 7d */}
          <div className="flex items-center gap-1.5 opacity-80 hover:opacity-100 transition">
            <Users className="w-3.5 h-3.5 text-blue-400" />
            <span className="font-bold text-slate-200 font-mono text-xs">
              {loading ? '...' : stats.totalUsers7Days}
            </span>
            <span className="text-[9px] text-slate-500 uppercase hidden sm:inline">Khách (7d)</span>
          </div>

          {/* Views 7d */}
          <div className="flex items-center gap-1.5 opacity-80 hover:opacity-100 transition">
            <Eye className="w-3.5 h-3.5 text-purple-400" />
            <span className="font-bold text-slate-200 font-mono text-xs">
              {loading ? '...' : stats.totalViews7Days}
            </span>
            <span className="text-[9px] text-slate-500 uppercase hidden sm:inline">Views (7d)</span>
          </div>

        </div>
      </div>
    </footer>
  )
}