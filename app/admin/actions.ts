'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

export async function createNewMember(formData: FormData) {
  // 1. Bọc trong try-catch để bắt mọi lỗi hệ thống
  try {
    const email = formData.get('email') as string
    const password = formData.get('password') as string

    // Validate dữ liệu đầu vào
    if (!email || !password) return { error: 'Vui lòng nhập đầy đủ Email và Mật khẩu.' }
    if (password.length < 6) return { error: 'Mật khẩu phải có ít nhất 6 ký tự.' }

    // Kiểm tra biến môi trường (Nguyên nhân hay gặp nhất)
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      console.error("❌ LỖI: Chưa tìm thấy SUPABASE_SERVICE_ROLE_KEY trong .env.local")
      return { error: 'Lỗi Server: Thiếu cấu hình Service Role Key. Hãy kiểm tra file .env' }
    }

    // 2. Khởi tạo Supabase Admin
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // 3. Tạo User trong Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true
    })

    if (authError) {
      console.error("Lỗi Auth:", authError.message)
      return { error: 'Lỗi tạo tài khoản: ' + authError.message }
    }

    if (!authData.user) return { error: 'Không tạo được User ID.' }

    // 4. Tạo Profile (Mặc định là member)
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
          id: authData.user.id,
          email: email,
          role: 'member'
      })

    if (profileError) {
      // Nếu lỗi profile thì dọn dẹp user auth để tránh rác
      console.error("Lỗi Profile:", profileError.message)
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return { error: 'Lỗi tạo hồ sơ Profile: ' + profileError.message }
    }

    // 5. Thành công -> Refresh dữ liệu
    revalidatePath('/admin')
    return { success: true, message: `Đã tạo thành công tài khoản: ${email}` }

  } catch (err: any) {
    // Bắt các lỗi không ngờ tới (Ví dụ: mạng rớt, server crash)
    console.error("Lỗi không xác định:", err)
    return { error: 'Lỗi hệ thống: ' + (err.message || 'Vui lòng thử lại sau.') }
  }
}