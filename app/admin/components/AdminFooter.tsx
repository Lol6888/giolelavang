// app/admin/components/AdminFooter.tsx
'use client'
import { useEffect, useState } from 'react'
import { Users, Eye, Loader2, Activity } from 'lucide-react'

export default function AdminFooter() {
  const [stats, setStats] = useState({ activeUsers: 0, totalUsers7Days: 0, totalViews7Days: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchGA4() {
      try {
        const res = await fetch('/api/analytics') // Gọi về server của mình
        const data = await res.json()
        if (data && !data.error) {
          setStats(data)
        }
      } catch (e) {
        console.error("Lỗi GA4:", e)
      } finally {
        setLoading(false)
      }
    }

    fetchGA4()
    
    // Cập nhật số liệu Realtime mỗi 30 giây
    const interval = setInterval(fetchGA4, 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    <footer className="w-full bg-slate-900 border-t border-slate-800 py-3 px-6 text-xs text-slate-400 mt-auto">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 sm:gap-0 max-w-7xl mx-auto">
        
        {/* Bên trái: Copyright */}
        <div className="font-mono">
          © 2024 <span className="text-slate-200 font-bold">LAVANG System</span>
        </div>

        {/* Bên phải: Thông số GA4 */}
        <div className="flex items-center gap-6 bg-black/40 px-4 py-1.5 rounded-full border border-white/5">
          
          {/* Active Users */}
          <div className="flex items-center gap-2" title="Đang online (30p)">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            <span className="font-bold text-green-400 font-mono text-sm">
              {loading ? <Loader2 className="w-3 h-3 animate-spin"/> : stats.activeUsers}
            </span>
            <span className="hidden sm:inline text-[10px] uppercase tracking-wider font-bold">Online</span>
          </div>

          <div className="w-px h-3 bg-slate-700"></div>

          {/* Users 7 Days */}
          <div className="flex items-center gap-2" title="Khách 7 ngày qua">
            <Users className="w-3 h-3 text-blue-400" />
            <span className="font-bold text-slate-200 font-mono">
              {loading ? '...' : stats.totalUsers7Days}
            </span>
            <span className="hidden sm:inline text-[10px]">Khách (7d)</span>
          </div>

          <div className="w-px h-3 bg-slate-700"></div>

          {/* Views 7 Days */}
          <div className="flex items-center gap-2" title="Lượt xem 7 ngày qua">
            <Eye className="w-3 h-3 text-purple-400" />
            <span className="font-bold text-slate-200 font-mono">
              {loading ? '...' : stats.totalViews7Days}
            </span>
            <span className="hidden sm:inline text-[10px]">Views (7d)</span>
          </div>

        </div>
      </div>
    </footer>
  )
}