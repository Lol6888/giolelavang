'use client'
import { useEffect, useState } from 'react'
import { Users, Loader2 } from 'lucide-react'

export default function AdminFooter() {
  // Update state để khớp với API mới (totalUsers)
  const [stats, setStats] = useState<any>({ activeUsers: 0, totalUsers: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchGA4() {
      try {
        const res = await fetch('/api/analytics')
        const data = await res.json()
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
    <footer className="fixed bottom-0 left-0 right-0 z-[9999] bg-slate-900/90 backdrop-blur-md border-t border-slate-700/50 py-2 px-4 shadow-2xl">
      <div className="flex justify-between items-center max-w-7xl mx-auto">
        
        {/* Copyright */}
        <div className="text-[10px] text-slate-500 font-mono hidden sm:block">
          LAVANG SYSTEM
        </div>

        {/* Khu vực hiển thị thông số */}
        <div className="flex items-center gap-4 w-full sm:w-auto justify-center sm:justify-end">
          
          {/* 1. ĐANG ONLINE */}
          <div className="flex items-center gap-2 bg-green-950/40 px-3 py-1 rounded-full border border-green-500/20 shadow-[0_0_10px_rgba(34,197,94,0.1)]">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            <span className="font-bold text-green-400 font-mono text-sm">
              {loading ? <Loader2 className="w-3 h-3 animate-spin"/> : stats.activeUsers}
            </span>
            <span className="text-[9px] text-green-500/80 uppercase font-bold tracking-wider ml-1">Online</span>
          </div>

          <div className="w-px h-4 bg-slate-700/50"></div>

          {/* 2. TỔNG KHÁCH (ALL TIME) */}
          <div className="flex items-center gap-2 opacity-80 hover:opacity-100 transition-opacity cursor-default" title="Tổng số người dùng từ trước đến nay">
            <Users className="w-3.5 h-3.5 text-blue-400" />
            <span className="font-bold text-slate-200 font-mono text-xs">
              {loading ? '...' : stats.totalUsers}
            </span>
            {/* Đổi label thành Tổng khách */}
            <span className="text-[9px] text-slate-500 uppercase font-bold">Tổng khách</span>
          </div>

        </div>
      </div>
    </footer>
  )
}