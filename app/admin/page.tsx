'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
// 👇 IMPORT THÊM deleteMember
import { createNewMember, deleteMember } from './actions' 
import { LogOut, Plus, Trash2, Calendar as CalIcon, Loader2, User, ChevronLeft, ChevronRight, MapPin, X, LayoutList, Grid3X3, List, Edit, CalendarRange, Clock, Lock, Shield, Users, UserMinus, UserPlus, AlertCircle, CheckCircle, Megaphone, Save } from 'lucide-react'
import { format, parseISO, isValid, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, startOfWeek, endOfWeek, addMonths, subMonths, addDays, subDays, isBefore, startOfYear, endOfYear, eachMonthOfInterval, addYears, subYears } from 'date-fns'
import { vi } from 'date-fns/locale'

// ... (Giữ nguyên các TYPE và STATE cũ) ...
type Schedule = { id: number; date: string; start_time: string; title: string; priest_name: string; note: string; location: string; last_updated_by?: string }
type LocationItem = { id: number; name: string }
type UserProfile = { id: string; email: string; role: 'member' | 'super_admin'; created_at: string }
type Announcement = { id: number; content: string; is_active: boolean; created_at: string }
type ViewMode = 'day' | 'week' | 'month' | 'year'

export default function AdminPage() {
  // ... (Giữ nguyên phần Init và Fetch Data cũ) ...
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [currentUser, setCurrentUser] = useState<{ email: string, role: string } | null>(null)
  const [listSchedules, setListSchedules] = useState<Schedule[]>([])
  const [locations, setLocations] = useState<LocationItem[]>([])
  const [members, setMembers] = useState<UserProfile[]>([])
  const [announcements, setAnnouncements] = useState<Announcement[]>([]) 
  const [viewMode, setViewMode] = useState<ViewMode>('day') 
  const [currentDate, setCurrentDate] = useState(new Date()) 
  const [showMemberModal, setShowMemberModal] = useState(false)
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false)
  const [showAddUserForm, setShowAddUserForm] = useState(false) 
  const [isCreatingUser, setIsCreatingUser] = useState(false) 
  const [showCalendar, setShowCalendar] = useState(false)
  const [showTimePicker, setShowTimePicker] = useState(false)
  const [showLocPicker, setShowLocPicker] = useState(false)
  const [selectedDateForInput, setSelectedDateForInput] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [form, setForm] = useState({ start_time: '05:00', title: '', priest_name: '', note: '', location: '' })
  const [editingId, setEditingId] = useState<number | null>(null)
  const [newUser, setNewUser] = useState({ email: '', password: '' })
  const calRef = useRef<HTMLDivElement>(null)
  const timeRef = useRef<HTMLDivElement>(null)
  const locRef = useRef<HTMLDivElement>(null)
  const mainContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (calRef.current && !calRef.current.contains(event.target as Node)) setShowCalendar(false)
      if (timeRef.current && !timeRef.current.contains(event.target as Node)) setShowTimePicker(false)
      if (locRef.current && !locRef.current.contains(event.target as Node)) setShowLocPicker(false)
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // CHECK AUTH & LOAD DATA
  useEffect(() => {
    const checkUser = async () => {
      // 1. Kiểm tra Session
      const { data: { session }, error: authError } = await supabase.auth.getSession()
      
      // Nếu không có session -> Đá về Login
      if (authError || !session) { 
          await supabase.auth.signOut(); // Đảm bảo xóa sạch rác client
          router.push('/login'); 
          return; 
      }
      
      // 2. Kiểm tra Profile trong Database (QUAN TRỌNG)
      const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

      // LOGIC MỚI: Nếu lỗi hoặc không tìm thấy profile (đã bị xóa) -> CƯỠNG CHẾ ĐĂNG XUẤT
      if (profileError || !profile) {
          console.warn("Tài khoản không tồn tại hoặc đã bị xóa. Đang đăng xuất...");
          await supabase.auth.signOut(); // Xóa token client
          router.push('/login'); // Đá về trang login
          return;
      }

      // Nếu OK -> Set User
      setCurrentUser({ email: session.user.email!, role: profile.role });

      fetchDataByViewMode()
      loadLocations()
    }
    checkUser()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, currentDate, router]) 

  const fetchDataByViewMode = async () => {
      let startStr = '', endStr = '';
      if (viewMode === 'day') { startStr = format(currentDate, 'yyyy-MM-dd'); endStr = startStr; } 
      else if (viewMode === 'week') { startStr = format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'yyyy-MM-dd'); endStr = format(endOfWeek(currentDate, { weekStartsOn: 1 }), 'yyyy-MM-dd'); } 
      else if (viewMode === 'month') { startStr = format(startOfMonth(currentDate), 'yyyy-MM-dd'); endStr = format(endOfMonth(currentDate), 'yyyy-MM-dd'); } 
      else { startStr = format(startOfYear(currentDate), 'yyyy-MM-dd'); endStr = format(endOfYear(currentDate), 'yyyy-MM-dd'); }
      const { data } = await supabase.from('schedules').select('*').gte('date', startStr).lte('date', endStr).order('date', { ascending: true }).order('start_time', { ascending: true }); 
      if (data) setListSchedules(data);
  }

  const loadLocations = async () => {
    const { data } = await supabase.from('locations').select('*').order('name');
    if (data) setLocations(data);
    if (!editingId && !form.location && data && data.length > 0) setForm(prev => ({ ...prev, location: data[0].name }));
  }

  const loadMembers = async () => {
      if (currentUser?.role !== 'super_admin') return;
      const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
      if (data) setMembers(data as UserProfile[]);
  }

  const loadAnnouncements = async () => {
      const { data } = await supabase.from('announcements').select('*').order('id', { ascending: true });
      if (data) setAnnouncements(data);
  }

  const handleAddAnnouncement = async () => {
      const { error } = await supabase.from('announcements').insert([{ content: 'Nội dung thông báo mới...' }]);
      if (error) alert("Lỗi: " + error.message); else loadAnnouncements();
  }

  const handleUpdateAnnouncement = async (id: number, content: string) => {
      const { error } = await supabase.from('announcements').update({ content }).eq('id', id);
      if (error) alert("Lỗi cập nhật: " + error.message); else alert("✅ Đã lưu thông báo!");
  }

  const handleDeleteAnnouncement = async (id: number) => {
      if(!confirm("Bạn chắc chắn muốn xóa thông báo này?")) return;
      const { error } = await supabase.from('announcements').delete().eq('id', id);
      if (error) alert("Lỗi xóa: " + error.message); else loadAnnouncements();
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedDateForInput) { alert("Vui lòng chọn ngày!"); return; }
    if (!form.location) { alert("Vui lòng nhập địa điểm!"); return; }
    
    setLoading(true)
    const exists = locations.find(l => l.name.toLowerCase() === form.location.toLowerCase());
    if (!exists) { await supabase.from('locations').insert([{ name: form.location }]); loadLocations(); }

    const payload = { ...form, date: selectedDateForInput, last_updated_by: currentUser?.email };
    let error;
    if (editingId) { const res = await supabase.from('schedules').update(payload).eq('id', editingId); error = res.error } 
    else { const res = await supabase.from('schedules').insert([payload]); error = res.error }
    setLoading(false)
    if (!error) { setForm(prev => ({ ...prev, title: '', priest_name: '', note: '' })); setEditingId(null); fetchDataByViewMode() } 
    else alert("Lỗi: " + error.message)
  }

  const handleDelete = async (id: number) => {
    if(!confirm('Bạn có chắc muốn xóa lễ này không?')) return;
    await supabase.from('schedules').delete().eq('id', id)
    fetchDataByViewMode()
    if (editingId === id) { setEditingId(null); setForm(prev => ({ ...prev, title: '', priest_name: '', note: '' })); }
  }

  // --- 👇 UPDATE HÀM XÓA MEMBER (DÙNG SERVER ACTION) 👇 ---
  const handleDeleteMember = async (id: string) => {
      if(!confirm('CẢNH BÁO: Xóa thành viên này sẽ ĐĂNG XUẤT họ ngay lập tức và xóa vĩnh viễn tài khoản. Bạn có chắc không?')) return;
      
      // Gọi Server Action deleteMember thay vì gọi client
      const result = await deleteMember(id);

      if (result.error) {
          alert(`❌ Thất bại: ${result.error}`);
      } else {
          alert(`✅ ${result.message}`);
          loadMembers(); // Reload danh sách
      }
  }

  const toggleRole = async (member: UserProfile) => {
      const newRole = member.role === 'super_admin' ? 'member' : 'super_admin';
      const actionName = newRole === 'super_admin' ? 'Thăng chức lên Admin' : 'Hạ xuống Member';
      if(!confirm(`Bạn muốn ${actionName} cho ${member.email}?`)) return;
      
      await supabase.from('profiles').update({ role: newRole }).eq('id', member.id);
      loadMembers();
  }

  const deleteLocation = async (id: number, e: React.MouseEvent) => {
      e.stopPropagation();
      if(!confirm('Xóa địa điểm này khỏi danh sách gợi ý?')) return;
      await supabase.from('locations').delete().eq('id', id); loadLocations();
  }

  const handleAddUser = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsCreatingUser(true); 
      try {
          const formData = new FormData();
          formData.append('email', newUser.email);
          formData.append('password', newUser.password);
          const result = await createNewMember(formData);
          if (result.error) { alert(`❌ Thất bại: ${result.error}`); } 
          else { alert(`✅ ${result.message}`); setNewUser({ email: '', password: '' }); setShowAddUserForm(false); loadMembers(); }
      } catch (error) { console.error(error); alert("❌ Lỗi kết nối đến server."); } 
      finally { setIsCreatingUser(false); }
  }

  const prepareAddForDate = (dateStr: string) => {
      setSelectedDateForInput(dateStr); setEditingId(null); setForm(prev => ({ ...prev, title: '', priest_name: '', note: '' }));
      mainContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const startEdit = (item: Schedule) => {
      setForm({ start_time: item.start_time.slice(0,5), title: item.title, priest_name: item.priest_name, note: item.note, location: item.location })
      setSelectedDateForInput(item.date); setEditingId(item.id);
      mainContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const isPastEvent = (dateStr: string, timeStr: string) => isBefore(new Date(`${dateStr}T${timeStr}`), new Date());
  const displayDateInput = () => isValid(parseISO(selectedDateForInput)) ? format(parseISO(selectedDateForInput), 'dd/MM/yyyy') : '...';
  
  const navigateDate = (dir: 'prev' | 'next') => {
      const func = dir === 'next' ? (viewMode === 'day' ? addDays : viewMode === 'week' ? addDays : viewMode === 'month' ? addMonths : addYears) 
                                  : (viewMode === 'day' ? subDays : viewMode === 'week' ? subDays : viewMode === 'month' ? subMonths : subYears);
      const amount = viewMode === 'week' ? 7 : 1;
      setCurrentDate(func(currentDate, amount));
  }

  const getListTitle = () => {
      if (viewMode === 'day') return format(currentDate, 'EEEE, dd/MM/yyyy', { locale: vi });
      if (viewMode === 'week') { const start = startOfWeek(currentDate, { weekStartsOn: 1 }); const end = endOfWeek(currentDate, { weekStartsOn: 1 }); return `${format(start, 'dd/MM')} - ${format(end, 'dd/MM/yyyy')}`; }
      if (viewMode === 'month') return `Tháng ${format(currentDate, 'MM/yyyy')}`;
      return `Năm ${format(currentDate, 'yyyy')}`;
  }

  const HOURS = Array.from({length: 24}, (_, i) => i.toString().padStart(2, '0'));
  const MINUTES = Array.from({length: 12}, (_, i) => (i * 5).toString().padStart(2, '0'));

  return (
    <div ref={mainContainerRef} className="h-screen w-full bg-slate-950 text-slate-200 font-sans overflow-y-auto overflow-x-hidden pb-40">
      
      {/* HEADER */}
      <div className="sticky top-0 z-[60] bg-slate-950/90 backdrop-blur-md border-b border-white/10 px-4 py-3 flex justify-between items-center shadow-lg">
            <h1 className="font-serif text-lg font-bold text-gold flex items-center gap-2">
                <div className="bg-gold/20 p-1.5 rounded-lg"><User size={20} className="text-gold"/></div>
                <div className="flex flex-col">
                    <span>Admin Panel</span>
                    <span className="text-[10px] text-slate-400 font-normal">Hi, {currentUser?.email} ({currentUser?.role === 'super_admin' ? 'Super Admin' : 'Member'})</span>
                </div>
            </h1>
            <div className="flex items-center gap-2">
                {currentUser?.role === 'super_admin' && (
                    <>
                        <button onClick={() => { setShowAnnouncementModal(true); loadAnnouncements(); }} className="flex items-center gap-2 text-xs font-bold text-yellow-400 bg-yellow-900/20 px-4 py-2.5 rounded-xl hover:bg-yellow-900/30 transition active:scale-95 border border-yellow-500/30">
                            <Megaphone size={16}/> <span className="hidden sm:inline">Thông báo</span>
                        </button>
                        <button onClick={() => { setShowMemberModal(true); loadMembers(); }} className="flex items-center gap-2 text-xs font-bold text-blue-400 bg-blue-900/20 px-4 py-2.5 rounded-xl hover:bg-blue-900/30 transition active:scale-95 border border-blue-500/30">
                            <Users size={16}/> <span className="hidden sm:inline">Thành Viên</span>
                        </button>
                    </>
                )}
                <button onClick={async () => { await supabase.auth.signOut(); router.push('/login'); }} className="flex items-center gap-2 text-xs font-bold text-red-400 bg-red-900/20 px-4 py-2.5 rounded-xl hover:bg-red-900/30 transition active:scale-95">
                    <LogOut size={16}/> <span className="hidden sm:inline">Thoát</span>
                </button>
            </div>
      </div>

      <div className="max-w-[1600px] mx-auto p-4 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* --- CỘT TRÁI: FORM NHẬP LIỆU --- */}
        <div className="lg:col-span-3 h-fit">
            <div className={`border p-5 rounded-3xl backdrop-blur-md shadow-2xl transition-all ${editingId ? 'bg-blue-900/10 border-blue-500/50 ring-1 ring-blue-500/30' : 'bg-white/5 border-white/10'}`}>
                <h2 className={`font-bold mb-4 flex items-center gap-2 text-lg border-b pb-3 ${editingId ? 'text-blue-400 border-blue-500/30' : 'text-white border-white/10'}`}>
                    {editingId ? <><Edit className="text-blue-400" size={24}/> Chỉnh Sửa Lễ</> : <><Plus className="text-gold" size={24}/> Thêm Lễ Mới</>}
                </h2>
                <form onSubmit={handleSave} className="space-y-5">
                    <div className="space-y-1.5 relative" ref={calRef}>
                        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest pl-1">Ngày diễn ra</label>
                        <div onClick={() => setShowCalendar(!showCalendar)} className="w-full bg-black/40 border border-white/10 hover:border-white/30 rounded-xl p-3.5 text-white flex justify-between items-center cursor-pointer active:scale-95 transition group">
                            <span className="font-bold text-lg group-hover:text-gold transition font-mono">{displayDateInput()}</span>
                            <CalIcon size={20} className="text-white/50 group-hover:text-gold"/>
                        </div>
                        {showCalendar && (
                            <div className="absolute top-full left-0 mt-2 w-full bg-slate-900 border border-white/20 rounded-2xl shadow-2xl p-4 z-[100] animate-fade-in">
                                <div className="flex justify-between items-center mb-4">
                                    <button type="button" onClick={() => setSelectedDateForInput(format(subMonths(parseISO(selectedDateForInput), 1), 'yyyy-MM-dd'))} className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition"><ChevronLeft size={20}/></button>
                                    <span className="font-bold text-white capitalize">{format(parseISO(selectedDateForInput), 'MMMM yyyy', { locale: vi })}</span>
                                    <button type="button" onClick={() => setSelectedDateForInput(format(addMonths(parseISO(selectedDateForInput), 1), 'yyyy-MM-dd'))} className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition"><ChevronRight size={20}/></button>
                                </div>
                                <div className="grid grid-cols-7 gap-1">
                                    {['T2','T3','T4','T5','T6','T7','CN'].map(d => <div key={d} className="text-center text-[10px] text-slate-500 font-bold mb-2">{d}</div>)}
                                    {eachDayOfInterval({start: startOfWeek(startOfMonth(parseISO(selectedDateForInput)), {weekStartsOn:1}), end: endOfWeek(endOfMonth(parseISO(selectedDateForInput)), {weekStartsOn:1})}).map((day, idx) => {
                                        const isSelected = selectedDateForInput === format(day, 'yyyy-MM-dd');
                                        const isCurrentMonth = isSameMonth(day, parseISO(selectedDateForInput));
                                        return (
                                            <button key={idx} type="button" onClick={() => { setSelectedDateForInput(format(day, 'yyyy-MM-dd')); setShowCalendar(false); }}
                                                className={`aspect-square rounded-lg flex items-center justify-center text-sm font-medium transition font-mono ${!isCurrentMonth ? 'text-slate-700' : 'text-slate-300'} ${isSelected ? 'bg-gold text-black font-bold shadow-lg scale-110' : 'hover:bg-white/10'}`}>
                                                {format(day, 'd')}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="grid grid-cols-5 gap-3">
                        <div className="col-span-2 space-y-1.5 relative" ref={timeRef}>
                             <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest pl-1">Giờ</label>
                             <div onClick={() => setShowTimePicker(!showTimePicker)} className="w-full bg-black/40 border border-white/10 hover:border-white/30 rounded-xl p-3.5 text-white flex justify-center items-center cursor-pointer active:scale-95 transition group">
                                <span className="font-mono font-bold text-lg group-hover:text-gold transition">{form.start_time}</span>
                             </div>
                             {showTimePicker && (
                                <div className="absolute top-full left-0 mt-2 w-[280px] bg-slate-900 border border-white/20 rounded-2xl shadow-2xl p-4 z-[100] grid grid-cols-2 gap-2">
                                    <div className="max-h-[250px] overflow-y-auto custom-scrollbar pr-1 space-y-1">{HOURS.map(h => (<button key={h} type="button" onClick={() => setForm(prev => ({...prev, start_time: `${h}:${prev.start_time.split(':')[1]}`}))} className={`w-full py-2 rounded-lg text-sm font-bold transition font-mono ${form.start_time.startsWith(h) ? 'bg-gold text-black' : 'text-slate-400 bg-white/5 hover:bg-white/10'}`}>{h}</button>))}</div>
                                    <div className="max-h-[250px] overflow-y-auto custom-scrollbar pr-1 space-y-1">{MINUTES.map(m => (<button key={m} type="button" onClick={() => { setForm(prev => ({...prev, start_time: `${prev.start_time.split(':')[0]}:${m}`})); setShowTimePicker(false); }} className={`w-full py-2 rounded-lg text-sm font-bold transition font-mono ${form.start_time.endsWith(m) ? 'bg-gold text-black' : 'text-slate-400 bg-white/5 hover:bg-white/10'}`}>{m}</button>))}</div>
                                </div>
                             )}
                        </div>
                        <div className="col-span-3 space-y-1.5">
                             <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest pl-1">Tên Lễ</label>
                             <input type="text" placeholder="Vd: Lễ Sáng" required className="w-full bg-black/40 border border-white/10 rounded-xl p-3.5 text-white placeholder-white/20 focus:border-gold outline-none transition font-medium" value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
                        </div>
                    </div>
                    <div className="space-y-1.5 relative" ref={locRef}>
                         <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest pl-1">Địa điểm</label>
                         <div className="relative group">
                            <MapPin className="absolute left-3 top-3.5 text-white/30 group-focus-within:text-gold transition" size={20}/>
                            <input type="text" placeholder="Chọn hoặc nhập..." className="w-full bg-black/40 border border-white/10 rounded-xl p-3.5 pl-10 text-white placeholder-white/20 focus:border-gold outline-none transition font-medium" value={form.location} onChange={e => setForm({...form, location: e.target.value})} onFocus={() => setShowLocPicker(true)} />
                            {showLocPicker && (
                                <div className="absolute top-full left-0 mt-2 w-full bg-slate-900 border border-white/20 rounded-2xl shadow-2xl py-2 z-[100] max-h-[250px] overflow-y-auto custom-scrollbar">
                                    {locations.map(loc => (
                                        <div key={loc.id} className="flex justify-between items-center px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/5 group/item">
                                            <button type="button" onClick={() => { setForm(prev => ({...prev, location: loc.name})); setShowLocPicker(false); }} className="flex-grow text-left text-sm text-slate-300 group-hover/item:text-white font-medium">{loc.name}</button>
                                            <button type="button" onClick={(e) => deleteLocation(loc.id, e)} className="p-1.5 text-slate-600 hover:text-red-500 transition"><X size={18}/></button>
                                        </div>
                                    ))}
                                    {locations.length === 0 && <div className="p-4 text-center text-xs text-slate-500 italic">Chưa có địa điểm lưu</div>}
                                </div>
                            )}
                         </div>
                    </div>
                    <div className="space-y-1.5">
                         <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest pl-1">Linh mục (Tùy chọn)</label>
                         <input type="text" placeholder="Vd: Cha Giuse..." className="w-full bg-black/40 border border-white/10 rounded-xl p-3.5 text-white placeholder-white/20 focus:border-gold outline-none transition font-medium" value={form.priest_name} onChange={e => setForm({...form, priest_name: e.target.value})} />
                    </div>
                    <div className="flex gap-3 pt-4 border-t border-white/5">
                        {editingId && (
                            <button type="button" onClick={() => { setEditingId(null); setForm(prev => ({ ...prev, title: '', priest_name: '', note: '' })) }} 
                                className="w-1/3 bg-slate-800 hover:bg-slate-700 text-white font-bold py-3.5 rounded-xl transition active:scale-95">
                                Hủy
                            </button>
                        )}
                        <button disabled={loading} className={`flex-grow font-bold py-3.5 rounded-xl flex justify-center items-center gap-2 text-base shadow-lg active:scale-95 transition ${editingId ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-gold hover:bg-yellow-400 text-slate-900'}`}>
                            {loading ? <Loader2 className="animate-spin"/> : (editingId ? 'Lưu Thay Đổi' : 'Thêm Lịch Lễ')}
                        </button>
                    </div>
                </form>
            </div>
        </div>

        {/* --- CỘT PHẢI: DASHBOARD --- */}
        <div className="lg:col-span-9">
             <div className="bg-white/5 border border-white/10 rounded-3xl backdrop-blur-md overflow-hidden flex flex-col min-h-[600px] shadow-2xl">
                <div className="p-4 border-b border-white/10 flex flex-col sm:flex-row gap-4 justify-between items-center bg-black/20">
                    <div className="flex items-center gap-1 bg-black/40 p-1.5 rounded-xl w-full sm:w-auto overflow-x-auto no-scrollbar">
                        {['day', 'week', 'month', 'year'].map((m) => (
                            <button key={m} onClick={() => setViewMode(m as ViewMode)} className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold flex justify-center items-center gap-2 whitespace-nowrap transition capitalize ${viewMode===m ? 'bg-white/10 text-white shadow ring-1 ring-white/10' : 'text-slate-500 hover:text-slate-300'}`}>
                                {m==='day' && <LayoutList size={16}/>} {m==='week' && <List size={16}/>} {m==='month' && <Grid3X3 size={16}/>} {m==='year' && <CalendarRange size={16}/>}
                                {m === 'day' ? 'Ngày' : m === 'week' ? 'Tuần' : m === 'month' ? 'Tháng' : 'Năm'}
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-4 bg-black/40 p-1.5 rounded-xl w-full sm:w-auto justify-between sm:justify-end">
                        <button onClick={() => navigateDate('prev')} className="p-2.5 hover:bg-white/10 rounded-lg text-slate-300 transition active:scale-95"><ChevronLeft size={20}/></button>
                        <h2 className="text-white font-bold text-sm uppercase tracking-wider text-center min-w-[160px]">{getListTitle()}</h2>
                        <button onClick={() => navigateDate('next')} className="p-2.5 hover:bg-white/10 rounded-lg text-slate-300 transition active:scale-95"><ChevronRight size={20}/></button>
                    </div>
                </div>

                <div className="p-4 flex-grow bg-black/20 overflow-y-auto custom-scrollbar">
                    {viewMode === 'year' && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                            {eachMonthOfInterval({ start: startOfYear(currentDate), end: endOfYear(currentDate) }).map(month => {
                                const monthStr = format(month, 'yyyy-MM');
                                const isCurrentMonth = isSameMonth(month, new Date());
                                const count = listSchedules.filter(s => s.date.startsWith(monthStr)).length;
                                return (
                                    <button key={monthStr} onClick={() => { setCurrentDate(month); setViewMode('month'); }} className={`relative flex flex-col items-center justify-center p-4 rounded-2xl border h-[120px] active:scale-95 transition group ${isCurrentMonth ? 'bg-gold/10 border-gold/50' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}>
                                        <div className={`font-serif text-xl font-bold capitalize ${isCurrentMonth ? 'text-gold' : 'text-white'}`}>Tháng {format(month, 'MM', { locale: vi })}</div>
                                        {count > 0 ? <div className="mt-2 text-xs font-bold bg-gold text-black px-3 py-1 rounded-full shadow-lg font-mono">{count} lễ</div> : <div className="mt-2 text-xs font-bold text-slate-600 px-3 py-1">-</div>}
                                    </button>
                                )
                            })}
                        </div>
                    )}
                    {viewMode === 'month' && (
                        <div className="h-full flex flex-col">
                             <div className="grid grid-cols-7 gap-1 mb-2">
                                {['T2','T3','T4','T5','T6','T7','CN'].map(d => <div key={d} className="text-center text-xs font-bold text-slate-500 uppercase py-2">{d}</div>)}
                             </div>
                             <div className="grid grid-cols-7 gap-1 sm:gap-2 auto-rows-fr">
                                {eachDayOfInterval({ start: startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 }) }).map((day) => {
                                    const dayStr = format(day, 'yyyy-MM-dd');
                                    const isCurrent = isSameMonth(day, currentDate);
                                    const isSelected = selectedDateForInput === dayStr;
                                    const count = listSchedules.filter(s => s.date === dayStr).length;
                                    const isTodayDate = isToday(day);
                                    let cellClass = "relative aspect-square sm:aspect-[4/3] flex flex-col items-center justify-start pt-2 rounded-xl border cursor-pointer transition active:scale-95 ";
                                    if(!isCurrent) cellClass += "opacity-30 border-transparent hover:bg-white/5 ";
                                    else if(isSelected) cellClass += "bg-gold/20 border-gold text-gold ";
                                    else if(isTodayDate) cellClass += "bg-white/5 border-blue-500/50 text-blue-400 ";
                                    else cellClass += "bg-white/5 border-white/5 hover:bg-white/10 ";
                                    return (
                                        <div key={dayStr} onClick={() => { setCurrentDate(day); setViewMode('day'); prepareAddForDate(dayStr); }} className={cellClass}>
                                            <span className="text-base sm:text-xl font-bold font-mono">{format(day, 'd')}</span>
                                            {count > 0 && (<div className="mt-1 sm:mt-2 bg-gold text-slate-900 text-[10px] sm:text-xs font-bold px-1.5 sm:px-2 py-0.5 rounded-full shadow-lg animate-fade-in font-mono">{count}</div>)}
                                        </div>
                                    )
                                })}
                             </div>
                        </div>
                    )}
                    {viewMode === 'week' && (
                         <div className="space-y-6 pb-20">
                             {Array.from({length: 7}).map((_, i) => {
                                 const dayDate = addDays(startOfWeek(currentDate, { weekStartsOn: 1 }), i);
                                 const dayStr = format(dayDate, 'yyyy-MM-dd');
                                 const dayEvents = listSchedules.filter(s => s.date === dayStr);
                                 const isT = isToday(dayDate);
                                 return (
                                     <div key={i} className={`rounded-2xl border overflow-hidden ${isT ? 'border-gold/50 bg-gold/5' : 'border-white/10 bg-white/5'}`}>
                                         <div className={`flex justify-between items-center p-3 sm:p-4 border-b ${isT ? 'border-gold/20 bg-gold/10' : 'border-white/5 bg-white/5'}`}>
                                             <div className="flex items-center gap-3">
                                                 <div className={`text-2xl font-bold font-mono ${isT ? 'text-gold' : 'text-slate-400'}`}>{format(dayDate, 'dd')}</div>
                                                 <div className={`font-bold uppercase text-sm ${isT ? 'text-gold' : 'text-white'}`}>{format(dayDate, 'EEEE', { locale: vi })}</div>
                                             </div>
                                             <button onClick={() => prepareAddForDate(dayStr)} className="p-2 rounded-xl bg-white/10 hover:bg-gold hover:text-black transition active:scale-95"><Plus size={20}/></button>
                                         </div>
                                         <div className="p-2 sm:p-3 space-y-3">
                                            {dayEvents.length === 0 && <div className="text-center py-4 text-xs text-slate-600 italic">Chưa có lịch lễ</div>}
                                            {dayEvents.map(ev => {
                                                const isPast = isPastEvent(ev.date, ev.start_time);
                                                return (
                                                <div key={ev.id} className={`border p-4 rounded-xl flex flex-col sm:flex-row sm:items-center gap-4 transition ${isPast ? 'bg-slate-900/50 border-white/5 opacity-70' : 'bg-black/40 border-white/5 hover:border-white/20'}`}>
                                                    <div className="flex items-start sm:items-center gap-4 flex-grow">
                                                         <div className={`font-mono font-bold text-xl pt-1 sm:pt-0 ${isPast ? 'text-slate-500' : 'text-gold'}`}>{ev.start_time.slice(0,5)}</div>
                                                         <div className="min-w-0">
                                                             <div className={`font-bold text-lg truncate ${isPast ? 'text-slate-500' : 'text-white'}`}>{ev.title}</div>
                                                             <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-sm text-slate-400 mt-1">
                                                                 <span className="flex items-center gap-1"><MapPin size={14}/> {ev.location}</span>
                                                                 {ev.priest_name && <span className="flex items-center gap-1"><User size={14}/> {ev.priest_name}</span>}
                                                             </div>
                                                             {ev.last_updated_by && <div className="text-[10px] text-slate-600 italic mt-1">Sửa bởi: {ev.last_updated_by}</div>}
                                                         </div>
                                                    </div>
                                                    <div className="flex gap-3 pt-3 mt-1 border-t border-white/10 sm:pt-0 sm:mt-0 sm:border-t-0 sm:border-l sm:pl-4 sm:border-white/10">
                                                        <button onClick={() => startEdit(ev)} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-blue-900/20 text-blue-400 rounded-lg hover:bg-blue-600 hover:text-white transition font-medium text-sm active:scale-95"><Edit size={18}/> <span className="sm:hidden">Sửa</span></button>
                                                        <button onClick={() => handleDelete(ev.id)} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-red-900/20 text-red-400 rounded-lg hover:bg-red-600 hover:text-white transition font-medium text-sm active:scale-95"><Trash2 size={18}/> <span className="sm:hidden">Xóa</span></button>
                                                    </div>
                                                </div>
                                            )})}
                                         </div>
                                     </div>
                                 )
                             })}
                         </div>
                    )}
                    {viewMode === 'day' && (
                        <div className="space-y-4 pb-20">
                            {listSchedules.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-24 text-slate-500 border-2 border-dashed border-white/5 rounded-3xl bg-white/5">
                                    <Clock size={48} className="mb-4 opacity-20"/>
                                    <p className="mb-4 text-base font-medium">Hôm nay chưa có lễ nào</p>
                                    <button onClick={() => prepareAddForDate(format(currentDate, 'yyyy-MM-dd'))} className="bg-gold hover:bg-yellow-400 text-slate-900 px-6 py-3 rounded-xl font-bold text-sm flex items-center gap-2 transition shadow-lg shadow-gold/20 active:scale-95"><Plus size={20}/> Tạo Lịch Ngay</button>
                                </div>
                            ) : (
                                listSchedules.map(item => {
                                    const isPast = isPastEvent(item.date, item.start_time);
                                    return (
                                    <div key={item.id} className={`flex flex-col sm:flex-row gap-4 p-5 rounded-2xl border transition ${isPast ? 'bg-slate-900/50 border-slate-800 opacity-60' : 'bg-black/40 border-white/10'}`}>
                                        <div className="flex items-start gap-4 flex-grow">
                                            <div className={`font-mono font-bold text-2xl pt-1 sm:pt-0 ${isPast ? 'text-slate-500' : 'text-gold'}`}>{item.start_time.slice(0,5)}</div>
                                            <div className="flex-grow min-w-0">
                                                <div className={`font-bold text-xl truncate ${isPast ? 'text-slate-500' : 'text-white'}`}>{item.title}</div>
                                                <div className="text-sm text-slate-500 flex flex-wrap gap-3 mt-2">
                                                    <span className="flex items-center gap-1"><MapPin size={16}/> {item.location}</span>
                                                    {item.priest_name && <span className="flex items-center gap-1"><User size={16}/> {item.priest_name}</span>}
                                                </div>
                                                {item.last_updated_by && <div className="text-[10px] text-slate-600 italic mt-2 border-t border-white/5 pt-1">Cập nhật cuối: {item.last_updated_by}</div>}
                                            </div>
                                        </div>
                                        <div className="flex sm:flex-col gap-3 pt-3 border-t border-white/5 sm:border-t-0 sm:pt-0 sm:pl-4 sm:border-l sm:border-white/10">
                                            <button onClick={() => startEdit(item)} className="flex-1 sm:flex-none p-3 bg-blue-900/20 text-blue-400 rounded-xl hover:bg-blue-600 hover:text-white transition flex justify-center items-center active:scale-95"><Edit size={20}/> <span className="ml-2 font-bold sm:hidden">Sửa</span></button>
                                            <button onClick={() => handleDelete(item.id)} className="flex-1 sm:flex-none p-3 bg-red-900/20 text-red-400 rounded-xl hover:bg-red-600 hover:text-white transition flex justify-center items-center active:scale-95"><Trash2 size={20}/> <span className="ml-2 font-bold sm:hidden">Xóa</span></button>
                                        </div>
                                    </div>
                                )})
                            )}
                        </div>
                    )}
                </div>
             </div>
        </div>
      </div>

      {/* MEMBER MANAGEMENT MODAL (CHỈ HIỆN VỚI SUPER ADMIN) */}
      {showMemberModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
              <div className="bg-[#1a1a24] border border-white/20 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">
                  {/* MODAL HEADER */}
                  <div className="p-5 border-b border-white/10 flex justify-between items-center bg-white/5 rounded-t-2xl">
                      <h2 className="text-xl font-bold text-white flex items-center gap-2"><Shield className="text-blue-400"/> Quản lý thành viên</h2>
                      <div className="flex gap-2">
                          <button onClick={() => setShowAddUserForm(!showAddUserForm)} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition ${showAddUserForm ? 'bg-white/10 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/50'}`}>
                              {showAddUserForm ? 'Hủy thêm' : <><UserPlus size={18}/> Thêm thành viên mới</>}
                          </button>
                          <button onClick={() => setShowMemberModal(false)} className="p-2 hover:bg-white/10 rounded-full transition"><X/></button>
                      </div>
                  </div>

                  {/* CONTENT */}
                  <div className="overflow-y-auto p-5 custom-scrollbar flex-grow">
                      
                      {/* ADD USER FORM (TOGGLE) */}
                      {showAddUserForm && (
                          <div className="mb-6 p-5 bg-blue-900/10 border border-blue-500/30 rounded-xl animate-fade-in">
                              <div className="flex items-start gap-3 mb-4">
                                  <AlertCircle className="text-blue-400 shrink-0 mt-0.5" size={20}/>
                                  <div className="text-sm text-blue-200">
                                      <p className="font-bold mb-1">Lưu ý quan trọng:</p>
                                      <p className="opacity-80">Tính năng này sẽ tạo tài khoản đăng nhập trực tiếp. Hãy đảm bảo email chính xác.</p>
                                  </div>
                              </div>
                              <form onSubmit={handleAddUser} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                  <input type="email" required placeholder="Email đăng nhập..." className="bg-black/40 border border-white/10 rounded-lg p-3 text-white focus:border-blue-500 outline-none" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} />
                                  <input type="password" required placeholder="Mật khẩu tạm (tối thiểu 6 ký tự)..." className="bg-black/40 border border-white/10 rounded-lg p-3 text-white focus:border-blue-500 outline-none" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} />
                                  
                                  <button disabled={isCreatingUser} type="submit" className="sm:col-span-2 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg transition shadow-lg flex justify-center items-center gap-2">
                                      {isCreatingUser ? <Loader2 className="animate-spin" /> : 'Xác nhận tạo User'}
                                  </button>
                              </form>
                          </div>
                      )}

                      {/* MEMBER LIST */}
                      <div className="space-y-3">
                          {members.length === 0 ? <p className="text-center text-slate-500 py-10 italic">Chưa có thành viên nào.</p> :
                          members.map(mem => (
                              <div key={mem.id} className="flex flex-col lg:flex-row items-start lg:items-center justify-between p-4 bg-black/40 border border-white/10 rounded-xl gap-4 hover:border-white/20 transition">
                                  <div className="min-w-0 flex items-center gap-3">
                                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${mem.role === 'super_admin' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'}`}>
                                          {mem.email.charAt(0).toUpperCase()}
                                      </div>
                                      <div>
                                          <div className="font-bold text-white truncate text-base">{mem.email}</div>
                                          <div className="text-xs text-slate-500 flex items-center gap-2 mt-1">
                                              <span>Tham gia: {format(parseISO(mem.created_at), 'dd/MM/yyyy')}</span>
                                              {mem.role === 'super_admin' && <span className="text-blue-400 font-bold">• Super Admin</span>}
                                          </div>
                                      </div>
                                  </div>
                                  
                                  <div className="flex items-center gap-2 w-full lg:w-auto overflow-x-auto pb-1 lg:pb-0">
                                      {mem.role === 'super_admin' ? 
                                          <div className="px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30 text-xs font-bold whitespace-nowrap">Đang là Admin</div> 
                                          : <div className="px-3 py-1.5 rounded-lg bg-slate-700/50 text-slate-400 border border-white/5 text-xs font-bold whitespace-nowrap">Đang là Member</div>
                                      }

                                      {mem.email !== currentUser?.email && (
                                          <>
                                              <div className="w-px h-8 bg-white/10 mx-2"></div>
                                              
                                              {mem.role === 'member' ? (
                                                  <button onClick={() => toggleRole(mem)} className="flex items-center gap-2 px-3 py-2 bg-blue-900/30 hover:bg-blue-600 text-blue-300 hover:text-white rounded-lg transition text-xs font-bold whitespace-nowrap border border-blue-500/30">
                                                      <Shield size={14}/> Thăng chức Admin
                                                  </button>
                                              ) : (
                                                  <button onClick={() => toggleRole(mem)} className="flex items-center gap-2 px-3 py-2 bg-orange-900/30 hover:bg-orange-600 text-orange-300 hover:text-white rounded-lg transition text-xs font-bold whitespace-nowrap border border-orange-500/30">
                                                      <UserMinus size={14}/> Hạ xuống Member
                                                  </button>
                                              )}

                                              <button onClick={() => handleDeleteMember(mem.id)} className="flex items-center gap-2 px-3 py-2 bg-red-900/30 hover:bg-red-600 text-red-300 hover:text-white rounded-lg transition text-xs font-bold whitespace-nowrap border border-red-500/30">
                                                  <Trash2 size={14}/> Xóa User
                                              </button>
                                          </>
                                      )}
                                  </div>
                              </div>
                          ))}
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* ANNOUNCEMENT MANAGEMENT MODAL (CHỈ HIỆN VỚI SUPER ADMIN) */}
      {showAnnouncementModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
              <div className="bg-[#1a1a24] border border-white/20 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">
                  {/* MODAL HEADER */}
                  <div className="p-5 border-b border-white/10 flex justify-between items-center bg-white/5 rounded-t-2xl">
                      <h2 className="text-xl font-bold text-white flex items-center gap-2"><Megaphone className="text-yellow-400"/> Quản lý Thông báo Marquee</h2>
                      <div className="flex gap-2">
                          <button onClick={handleAddAnnouncement} className="px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 bg-yellow-600 hover:bg-yellow-500 text-white shadow-lg transition">
                              <Plus size={18}/> Thêm thông báo mới
                          </button>
                          <button onClick={() => setShowAnnouncementModal(false)} className="p-2 hover:bg-white/10 rounded-full transition"><X/></button>
                      </div>
                  </div>

                  {/* CONTENT */}
                  <div className="overflow-y-auto p-5 custom-scrollbar flex-grow space-y-4">
                      {announcements.length === 0 && <p className="text-center text-slate-500 italic py-10">Chưa có thông báo nào. Hãy thêm mới!</p>}
                      {announcements.map(ann => (
                          <div key={ann.id} className="bg-black/40 border border-white/10 p-4 rounded-xl flex gap-4 items-start group hover:border-white/20 transition">
                              <div className="flex-grow">
                                  <label className="text-[10px] text-slate-500 uppercase font-bold mb-1 block">Nội dung hiển thị</label>
                                  <textarea 
                                    className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-white focus:border-yellow-500 outline-none text-sm min-h-[80px]"
                                    value={ann.content}
                                    onChange={(e) => {
                                        const newContent = e.target.value;
                                        setAnnouncements(prev => prev.map(p => p.id === ann.id ? { ...p, content: newContent } : p));
                                    }}
                                  />
                              </div>
                              <div className="flex flex-col gap-2 pt-6">
                                  <button onClick={() => handleUpdateAnnouncement(ann.id, ann.content)} className="p-2 bg-blue-900/30 text-blue-400 hover:bg-blue-600 hover:text-white rounded-lg transition" title="Lưu thay đổi">
                                      <Save size={20}/>
                                  </button>
                                  <button onClick={() => handleDeleteAnnouncement(ann.id)} className="p-2 bg-red-900/30 text-red-400 hover:bg-red-600 hover:text-white rounded-lg transition" title="Xóa">
                                      <Trash2 size={20}/>
                                  </button>
                              </div>
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      )}
    </div>
  )
}