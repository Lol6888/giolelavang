'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

export async function createNewMember(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  // 1. Kiểm tra đầu vào
  if (!email || !password) return { error: 'Vui lòng nhập đầy đủ Email và Mật khẩu.' }
  if (password.length < 6) return { error: 'Mật khẩu phải có ít nhất 6 ký tự.' }

  // 2. Kiểm tra Key (Debug)
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    console.error("❌ LỖI: Không tìm thấy SUPABASE_SERVICE_ROLE_KEY. Hãy kiểm tra file .env.local và khởi động lại server.")
    return { error: 'Lỗi Server: Chưa cấu hình Service Role Key.' }
  }

  // 3. Khởi tạo Admin Client (Quyền tối cao)
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false // Quan trọng: Không lưu session để tránh đá Admin ra
      }
    }
  )

  // 4. Tạo User bên Auth
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: email,
    password: password,
    email_confirm: true // Tự động xác thực email luôn
  })

  if (authError) return { error: 'Lỗi tạo Auth: ' + authError.message }
  if (!authData.user) return { error: 'Không tạo được User ID.' }

  // 5. Tạo Profile bên Database (Mặc định là member)
  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .upsert({
        id: authData.user.id,
        email: email,
        role: 'member'
    })

  if (profileError) {
    // Nếu lỗi profile thì xóa user auth đi để sạch data
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
    return { error: 'Lỗi tạo Profile: ' + profileError.message }
  }

  // 6. Thành công -> Refresh trang
  revalidatePath('/admin')
  return { success: true, message: `Đã tạo thành công: ${email}` }
}