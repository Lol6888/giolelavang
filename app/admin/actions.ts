'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

// ... (Giữ nguyên hàm createNewMember cũ ở trên) ...

export async function createNewMember(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  // 1. Kiểm tra đầu vào
  if (!email || !password) return { error: 'Vui lòng nhập đầy đủ Email và Mật khẩu.' }
  if (password.length < 6) return { error: 'Mật khẩu phải có ít nhất 6 ký tự.' }

  // 2. Kiểm tra Key (Debug)
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    console.error("❌ LỖI: Không tìm thấy SUPABASE_SERVICE_ROLE_KEY.")
    return { error: 'Lỗi Server: Chưa cấu hình Service Role Key.' }
  }

  // 3. Khởi tạo Admin Client
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

  // 4. Tạo User bên Auth
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: email,
    password: password,
    email_confirm: true
  })

  if (authError) return { error: 'Lỗi tạo Auth: ' + authError.message }
  if (!authData.user) return { error: 'Không tạo được User ID.' }

  // 5. Tạo Profile
  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .upsert({
        id: authData.user.id,
        email: email,
        role: 'member'
    })

  if (profileError) {
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
    return { error: 'Lỗi tạo Profile: ' + profileError.message }
  }

  revalidatePath('/admin')
  return { success: true, message: `Đã tạo thành công: ${email}` }
}

// --- 👇 THÊM HÀM NÀY ĐỂ XÓA USER TẬN GỐC 👇 ---
export async function deleteMember(userId: string) {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) return { error: 'Lỗi Server: Thiếu Service Role Key.' }
  
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
  
    // 1. Xóa khỏi Authentication (User sẽ bị đăng xuất ngay lập tức)
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId)
    
    if (authError) {
        return { error: 'Lỗi xóa Auth: ' + authError.message }
    }

    // 2. Xóa khỏi bảng profiles (Dọn dẹp dữ liệu thừa nếu chưa cascade)
    const { error: profileError } = await supabaseAdmin.from('profiles').delete().eq('id', userId)
    
    // Không return lỗi profile vì Auth xóa được là quan trọng nhất
    if (profileError) console.error('Warning xóa profile:', profileError)
  
    revalidatePath('/admin')
    return { success: true, message: 'Đã xóa User thành công và đăng xuất khỏi hệ thống.' }
}