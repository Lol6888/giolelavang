'use client'
import { useEffect, useState } from 'react'
import { BarChart3, Calendar, Clock, Loader2 } from 'lucide-react'

export default function AdminFooter() {
  const [stats, setStats] = useState({ total: 0, month: 0, today: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
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
    fetchData()
  }, [])

  // Hàm format số cho đẹp (1000 -> 1,000)
  const fmt = (n: any) => new Intl.NumberFormat('en-US').format(Number(n));

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-[9999] bg-slate-900/95 backdrop-blur-md border-t border-slate-700/50 py-2 px-6 shadow-2xl text-xs">
      <div className="flex flex-col sm:flex-row justify-between items-center max-w-7xl mx-auto gap-2 sm:gap-0">
        
        {/* Copyright */}
        <div className="text-slate-500 font-mono hidden md:block">
          LAVANG SYSTEM
        </div>

        {/* 3 Chỉ số quan trọng */}
        <div className="flex items-center gap-4 sm:gap-8 w-full sm:w-auto justify-between sm:justify-end">
          
          {/* 1. Tổng cộng */}
          <div className="flex items-center gap-2 group">
            <div className="p-1.5 rounded-full bg-blue-500/10 text-blue-400 group-hover:bg-blue-500/20 transition">
              <BarChart3 className="w-3.5 h-3.5" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-slate-200 font-mono text-[13px]">
                {loading ? '...' : fmt(stats.total)}
              </span>
              <span className="text-[9px] text-slate-500 uppercase font-bold tracking-wide">Tổng cộng</span>
            </div>
          </div>

          <div className="w-px h-6 bg-slate-800 hidden sm:block"></div>

          {/* 2. Trong tháng */}
          <div className="flex items-center gap-2 group">
             <div className="p-1.5 rounded-full bg-purple-500/10 text-purple-400 group-hover:bg-purple-500/20 transition">
              <Calendar className="w-3.5 h-3.5" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-slate-200 font-mono text-[13px]">
                {loading ? '...' : fmt(stats.month)}
              </span>
              <span className="text-[9px] text-slate-500 uppercase font-bold tracking-wide">Trong tháng</span>
            </div>
          </div>

          <div className="w-px h-6 bg-slate-800 hidden sm:block"></div>

          {/* 3. Hôm nay */}
          <div className="flex items-center gap-2 group">
             <div className="p-1.5 rounded-full bg-green-500/10 text-green-400 group-hover:bg-green-500/20 transition">
              <Clock className="w-3.5 h-3.5" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-slate-200 font-mono text-[13px]">
                 {loading ? <Loader2 className="w-3 h-3 animate-spin"/> : fmt(stats.today)}
              </span>
              <span className="text-[9px] text-slate-500 uppercase font-bold tracking-wide">Hôm nay</span>
            </div>
          </div>

        </div>
      </div>
    </footer>
  )
}