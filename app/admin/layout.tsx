// app/admin/layout.tsx
import AdminFooter from './components/AdminFooter' // <-- Đảm bảo đường dẫn này đúng với cấu trúc thư mục của bạn

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col font-sans text-slate-200">
      
      {/* Phần nội dung chính (Sidebar + Page Content) */}
      <div className="flex-grow w-full flex flex-col">
        {children}
      </div>

      {/* --- FOOTER NẰM Ở ĐÂY --- */}
      {/* Nếu không có dòng này, footer sẽ không bao giờ hiện */}
      <AdminFooter /> 
    </div>
  )
}