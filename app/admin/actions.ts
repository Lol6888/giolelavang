'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

export async function createNewMember(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
    return { error: 'Vui lòng nhập đầy đủ Email và Mật khẩu.' }
  }

  // 1. Khởi tạo Supabase Admin Client (Quyền tối cao)
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, 
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )

  // 2. Tạo User mới trong Auth (Tự động confirm email luôn để họ đăng nhập được ngay)
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: email,
    password: password,
    email_confirm: true // Quan trọng: Bỏ qua bước xác nhận email
  })

  if (authError) {
    console.error('Lỗi tạo Auth:', authError)
    return { error: 'Lỗi tạo tài khoản: ' + authError.message }
  }

  if (!authData.user) return { error: 'Không tạo được User ID.' }

  // 3. Tạo Profile cho user đó (Mặc định là member)
  // Lưu ý: Do ta đã có Trigger tự động tạo profile ở Database (bước trước),
  // nên bước này có thể dư thừa nhưng ta cứ chạy update để chắc chắn role là member.
  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .upsert({
        id: authData.user.id,
        email: email,
        role: 'member'
    })

  if (profileError) {
    // Nếu lỗi profile, ta nên xóa user auth vừa tạo để tránh rác data
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
    return { error: 'Lỗi tạo hồ sơ Profile: ' + profileError.message }
  }

  // 4. Làm mới dữ liệu trang Admin để hiện user mới ngay lập tức
  revalidatePath('/admin')
  
  return { success: true, message: `Đã tạo thành công user: ${email}` }
}