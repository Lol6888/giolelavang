// app/admin/layout.tsx
import AdminFooter from './components/AdminFooter' // Import component vừa tạo

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col font-sans text-slate-200">
      
      {/* Phần nội dung chính (flex-grow để đẩy footer xuống đáy) */}
      <main className="flex-grow w-full">
        {children}
      </main>

      {/* Footer nằm ở đây */}
      <AdminFooter />
    </div>
  )
}