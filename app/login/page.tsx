'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import { Loader2, KeyRound, Mail } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      alert('Sai mật khẩu hoặc email rồi!')
      setLoading(false)
    } else {
      router.push('/admin')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative font-sans text-white overflow-hidden">
      {/* Nền giống trang chủ */}
      <div className="absolute inset-0 bg-basilica bg-cover bg-center opacity-50 blur-sm"></div>
      <div className="absolute inset-0 bg-black/60"></div>

      <div className="relative z-10 w-full max-w-md p-4">
        <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
          <div className="text-center mb-8">
            <h1 className="font-serif text-3xl font-bold text-gold mb-2">Đăng Nhập Admin</h1>
            <p className="text-white/60 text-sm">Hệ thống quản trị Lịch Phụng Vụ</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-white/50 uppercase ml-1">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 text-white/40" size={18} />
                <input type="email" required placeholder="admin@lavang.vn"
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-white/20 focus:border-gold focus:ring-1 focus:ring-gold outline-none transition"
                  value={email} onChange={e => setEmail(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-white/50 uppercase ml-1">Mật khẩu</label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-3 text-white/40" size={18} />
                <input type="password" required placeholder="••••••"
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-white/20 focus:border-gold focus:ring-1 focus:ring-gold outline-none transition"
                  value={password} onChange={e => setPassword(e.target.value)} />
              </div>
            </div>

            <button disabled={loading} className="w-full bg-gold hover:bg-yellow-600 text-black font-bold py-3.5 rounded-xl transition shadow-lg shadow-yellow-900/20 flex justify-center items-center gap-2 mt-6">
              {loading ? <Loader2 className="animate-spin" /> : 'Truy Cập Hệ Thống'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}