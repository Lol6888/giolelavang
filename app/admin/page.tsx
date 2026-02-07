'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import { LogOut, Plus, Trash2, Calendar as CalIcon, Loader2, User, Clock, ChevronLeft, ChevronRight, MapPin, X, LayoutList, Grid3X3, List, Edit, Save, CalendarRange, Menu } from 'lucide-react'
import { format, parseISO, isValid, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, startOfWeek, endOfWeek, addMonths, subMonths, addDays, subDays, isSameDay, isBefore, startOfYear, endOfYear, eachMonthOfInterval, addYears, subYears } from 'date-fns'
import { vi } from 'date-fns/locale'

// --- TYPES ---
type Schedule = { id: number, date: string, start_time: string, title: string, priest_name: string, note: string, location: string }
type LocationItem = { id: number, name: string }
type ViewMode = 'day' | 'week' | 'month' | 'year'

export default function AdminPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [listSchedules, setListSchedules] = useState<Schedule[]>([])
  const [locations, setLocations] = useState<LocationItem[]>([])
  
  // -- STATE QUẢN LÝ VIEW --
  const [viewMode, setViewMode] = useState<ViewMode>('day') 
  const [currentDate, setCurrentDate] = useState(new Date()) 
  
  // -- STATE POPUP --
  const [showCalendar, setShowCalendar] = useState(false)
  const [showTimePicker, setShowTimePicker] = useState(false)
  const [showLocPicker, setShowLocPicker] = useState(false)
  
  // -- STATE FORM --
  const [selectedDateForInput, setSelectedDateForInput] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [form, setForm] = useState({ start_time: '05:00', title: '', priest_name: '', note: '', location: '' })
  const [editingId, setEditingId] = useState<number | null>(null)

  const calRef = useRef<HTMLDivElement>(null)
  const timeRef = useRef<HTMLDivElement>(null)
  const locRef = useRef<HTMLDivElement>(null)

  // Click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (calRef.current && !calRef.current.contains(event.target as Node)) setShowCalendar(false)
      if (timeRef.current && !timeRef.current.contains(event.target as Node)) setShowTimePicker(false)
      if (locRef.current && !locRef.current.contains(event.target as Node)) setShowLocPicker(false)
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // LOAD USER & DATA
  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) router.push('/login')
      else {
          fetchDataByViewMode()
          loadLocations()
      }
    }
    checkUser()
  }, [viewMode, currentDate, router]) 

  // --- LOGIC FETCH DATA ---
  const fetchDataByViewMode = async () => {
      let startStr = '', endStr = '';
      if (viewMode === 'day') { startStr = format(currentDate, 'yyyy-MM-dd'); endStr = startStr; } 
      else if (viewMode === 'week') { startStr = format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'yyyy-MM-dd'); endStr = format(endOfWeek(currentDate, { weekStartsOn: 1 }), 'yyyy-MM-dd'); } 
      else if (viewMode === 'month') { startStr = format(startOfMonth(currentDate), 'yyyy-MM-dd'); endStr = format(endOfMonth(currentDate), 'yyyy-MM-dd'); } 
      else { startStr = format(startOfYear(currentDate), 'yyyy-MM-dd'); endStr = format(endOfYear(currentDate), 'yyyy-MM-dd'); }

      const { data } = await supabase.from('schedules').select('*').gte('date', startStr).lte('date', endStr).order('date').order('start_time'); 
      if (data) setListSchedules(data);
  }

  const loadLocations = async () => {
    const { data } = await supabase.from('locations').select('*').order('name')
    if (data) {
        setLocations(data)
        if (!editingId && !form.location && data.length > 0) setForm(prev => ({ ...prev, location: data[0].name }))
    }
  }

  // --- ACTIONS ---
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedDateForInput) { alert("Vui lòng chọn ngày!"); return; }
    if (!form.location) { alert("Vui lòng nhập địa điểm!"); return; }
    
    setLoading(true)
    const exists = locations.find(l => l.name.toLowerCase() === form.location.toLowerCase());
    if (!exists) { await supabase.from('locations').insert([{ name: form.location }]); loadLocations(); }

    let error;
    if (editingId) {
        const res = await supabase.from('schedules').update({ ...form, date: selectedDateForInput }).eq('id', editingId)
        error = res.error
    } else {
        const res = await supabase.from('schedules').insert([{ ...form, date: selectedDateForInput }])
        error = res.error
    }
    setLoading(false)
    if (!error) {
      setForm(prev => ({ ...prev, title: '', start_time: form.start_time })) 
      setEditingId(null)
      fetchDataByViewMode()
    } else alert("Lỗi: " + error.message)
  }

  const prepareAddForDate = (dateStr: string) => {
      setSelectedDateForInput(dateStr);
      setEditingId(null);
      setForm(prev => ({ ...prev, title: '', priest_name: '', note: '' }));
      window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const startEdit = (item: Schedule) => {
      setForm({ start_time: item.start_time.slice(0,5), title: item.title, priest_name: item.priest_name, note: item.note, location: item.location })
      setSelectedDateForInput(item.date)
      setEditingId(item.id)
      window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDelete = async (id: number) => {
    if(!confirm('Xóa lễ này?')) return;
    await supabase.from('schedules').delete().eq('id', id)
    fetchDataByViewMode()
    if (editingId === id) { setEditingId(null); setForm(prev => ({ ...prev, title: '', priest_name: '' })); }
  }

  const deleteLocation = async (id: number, e: React.MouseEvent) => {
      e.stopPropagation();
      if(!confirm('Xóa địa điểm này?')) return;
      await supabase.from('locations').delete().eq('id', id); loadLocations();
  }

  const isPastEvent = (dateStr: string, timeStr: string) => isBefore(new Date(`${dateStr}T${timeStr}`), new Date());
  
  // --- HELPERS ---
  const displayDateInput = () => isValid(parseISO(selectedDateForInput)) ? format(parseISO(selectedDateForInput), 'dd/MM/yyyy') : '...';
  
  const navigateDate = (dir: 'prev' | 'next') => {
      if (viewMode === 'day') setCurrentDate(dir==='next' ? addDays(currentDate, 1) : subDays(currentDate, 1));
      if (viewMode === 'week') setCurrentDate(dir==='next' ? addDays(currentDate, 7) : subDays(currentDate, 7));
      if (viewMode === 'month') setCurrentDate(dir==='next' ? addMonths(currentDate, 1) : subMonths(currentDate, 1));
      if (viewMode === 'year') setCurrentDate(dir==='next' ? addYears(currentDate, 1) : subYears(currentDate, 1));
  }

  const getListTitle = () => {
      if (viewMode === 'day') return `${format(currentDate, 'dd/MM/yyyy')}`;
      if (viewMode === 'week') {
          const start = startOfWeek(currentDate, { weekStartsOn: 1 });
          const end = endOfWeek(currentDate, { weekStartsOn: 1 });
          return `${format(start, 'dd/MM')} - ${format(end, 'dd/MM')}`;
      }
      if (viewMode === 'month') return `Tháng ${format(currentDate, 'MM/yyyy')}`;
      return `Năm ${format(currentDate, 'yyyy')}`;
  }

  const HOURS = Array.from({length: 19}, (_, i) => (i + 4).toString().padStart(2, '0'));
  const MINUTES = ['00', '15', '30', '45'];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans pb-20"> {/* Cho phép cuộn trang, thêm padding dưới */}
      
      {/* HEADER MOBILE & DESKTOP */}
      <div className="sticky top-0 z-[60] bg-slate-950/90 backdrop-blur-md border-b border-white/10 px-4 py-3 flex justify-between items-center">
            <h1 className="font-serif text-lg font-bold text-gold flex items-center gap-2">
                <div className="bg-gold/20 p-1.5 rounded-lg"><User size={18} className="text-gold"/></div>
                Admin Panel
            </h1>
            <button onClick={async () => { await supabase.auth.signOut(); router.push('/login'); }} className="text-xs font-bold text-red-400 bg-red-900/20 px-3 py-2 rounded-lg">
                <LogOut size={16}/>
            </button>
      </div>

      <div className="max-w-[1600px] mx-auto p-4 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* CỘT TRÁI: FORM NHẬP (Luôn hiển thị trên cùng ở mobile) */}
        <div className="lg:col-span-3 h-fit">
            <div className={`border p-5 rounded-2xl backdrop-blur-md shadow-2xl transition-colors ${editingId ? 'bg-blue-900/10 border-blue-500/50' : 'bg-white/5 border-white/10'}`}>
                <h2 className={`font-bold mb-4 flex items-center gap-2 text-lg border-b pb-2 ${editingId ? 'text-blue-400 border-blue-500/30' : 'text-white border-white/10'}`}>
                    {editingId ? <><Edit className="text-blue-400" size={20}/> Sửa Lễ</> : <><Plus className="text-gold" size={20}/> Nhập Mới</>}
                </h2>
                <form onSubmit={handleSave} className="space-y-4">
                    {/* NGÀY */}
                    <div className="space-y-1 relative" ref={calRef}>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ngày diễn ra</label>
                        <div onClick={() => setShowCalendar(!showCalendar)} className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white flex justify-between items-center cursor-pointer active:scale-95 transition">
                            <span className="font-bold">{displayDateInput()}</span>
                            <CalIcon size={18} className="text-gold"/>
                        </div>
                        {showCalendar && (
                            <div className="absolute top-full left-0 mt-2 w-full bg-slate-900 border border-white/20 rounded-2xl shadow-2xl p-4 z-[100] animate-fade-in">
                                <div className="flex justify-between items-center mb-4">
                                    <button type="button" onClick={() => setSelectedDateForInput(format(subMonths(parseISO(selectedDateForInput), 1), 'yyyy-MM-dd'))} className="p-2 bg-white/10 rounded-lg"><ChevronLeft size={20}/></button>
                                    <span className="font-bold text-white capitalize">{format(parseISO(selectedDateForInput), 'MMMM', { locale: vi })}</span>
                                    <button type="button" onClick={() => setSelectedDateForInput(format(addMonths(parseISO(selectedDateForInput), 1), 'yyyy-MM-dd'))} className="p-2 bg-white/10 rounded-lg"><ChevronRight size={20}/></button>
                                </div>
                                <div className="grid grid-cols-7 gap-1">
                                    {eachDayOfInterval({start: startOfWeek(startOfMonth(parseISO(selectedDateForInput)), {weekStartsOn:1}), end: endOfWeek(endOfMonth(parseISO(selectedDateForInput)), {weekStartsOn:1})}).map((day, idx) => {
                                        const isSelected = selectedDateForInput === format(day, 'yyyy-MM-dd');
                                        const isCurrentMonth = isSameMonth(day, parseISO(selectedDateForInput));
                                        return (
                                            <button key={idx} type="button" onClick={() => { setSelectedDateForInput(format(day, 'yyyy-MM-dd')); setShowCalendar(false); }}
                                                className={`h-9 w-9 rounded-full flex items-center justify-center text-sm transition ${!isCurrentMonth ? 'text-slate-700' : 'text-slate-300'} ${isSelected ? 'bg-gold text-black font-bold shadow-lg' : ''}`}>
                                                {format(day, 'd')}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                    {/* GIỜ & TÊN */}
                    <div className="grid grid-cols-5 gap-3">
                        <div className="col-span-2 space-y-1 relative" ref={timeRef}>
                             <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Giờ</label>
                             <div onClick={() => setShowTimePicker(!showTimePicker)} className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white flex justify-center items-center cursor-pointer active:scale-95 transition">
                                <span className="font-mono font-bold text-lg">{form.start_time}</span>
                             </div>
                             {showTimePicker && (
                                <div className="absolute top-full left-0 mt-2 w-[280px] bg-slate-900 border border-white/20 rounded-2xl shadow-2xl p-4 z-[100] grid grid-cols-2 gap-4">
                                    <div className="max-h-[200px] overflow-y-auto custom-scrollbar pr-1">{HOURS.map(h => (<button key={h} type="button" onClick={() => setForm(prev => ({...prev, start_time: `${h}:${prev.start_time.split(':')[1]}`}))} className={`w-full py-2 rounded mb-1 text-sm font-bold ${form.start_time.startsWith(h) ? 'bg-gold text-black' : 'text-slate-300 bg-white/5'}`}>{h}</button>))}</div>
                                    <div>{MINUTES.map(m => (<button key={m} type="button" onClick={() => { setForm(prev => ({...prev, start_time: `${prev.start_time.split(':')[0]}:${m}`})); setShowTimePicker(false); }} className={`w-full py-2 rounded mb-1 text-sm font-bold ${form.start_time.endsWith(m) ? 'bg-gold text-black' : 'text-slate-300 bg-white/5'}`}>{m}</button>))}</div>
                                </div>
                             )}
                        </div>
                        <div className="col-span-3 space-y-1">
                             <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tên Lễ</label>
                             <input type="text" placeholder="Vd: Lễ Sáng" required className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white focus:border-gold outline-none" value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
                        </div>
                    </div>
                    {/* ĐỊA ĐIỂM */}
                    <div className="space-y-1 relative" ref={locRef}>
                         <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nơi tổ chức</label>
                         <div className="relative">
                            <MapPin className="absolute left-3 top-3 text-white/30" size={18}/>
                            <input type="text" placeholder="Chọn hoặc nhập..." className="w-full bg-black/40 border border-white/10 rounded-xl p-3 pl-10 text-white focus:border-gold outline-none" value={form.location} onChange={e => setForm({...form, location: e.target.value})} onFocus={() => setShowLocPicker(true)} />
                            {showLocPicker && (
                                <div className="absolute top-full left-0 mt-2 w-full bg-slate-900 border border-white/20 rounded-2xl shadow-2xl py-2 z-[100] max-h-[200px] overflow-y-auto custom-scrollbar">
                                    {locations.map(loc => (
                                        <div key={loc.id} className="flex justify-between items-center px-3 py-2 border-b border-white/5 last:border-0 hover:bg-white/5">
                                            <button type="button" onClick={() => { setForm(prev => ({...prev, location: loc.name})); setShowLocPicker(false); }} className="flex-grow text-left text-sm text-slate-300 font-medium">{loc.name}</button>
                                            <button type="button" onClick={(e) => deleteLocation(loc.id, e)} className="p-2 text-slate-500 hover:text-red-500"><X size={16}/></button>
                                        </div>
                                    ))}
                                </div>
                            )}
                         </div>
                    </div>
                    {/* LINH MỤC */}
                    <div className="space-y-1">
                         <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Linh mục</label>
                         <input type="text" placeholder="Tên Cha..." className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white focus:border-gold outline-none" value={form.priest_name} onChange={e => setForm({...form, priest_name: e.target.value})} />
                    </div>
                    {/* BUTTONS */}
                    <div className="flex gap-3 pt-2">
                        {editingId && (<button type="button" onClick={() => { setEditingId(null); setForm(prev => ({ ...prev, title: '', priest_name: '' })) }} className="w-1/3 bg-slate-800 text-white font-bold py-3.5 rounded-xl">Hủy</button>)}
                        <button disabled={loading} className={`flex-grow font-bold py-3.5 rounded-xl flex justify-center items-center gap-2 ${editingId ? 'bg-blue-600 text-white' : 'bg-gold text-slate-900'}`}>{loading ? <Loader2 className="animate-spin"/> : (editingId ? 'Cập Nhật' : 'Thêm Mới')}</button>
                    </div>
                </form>
            </div>
        </div>

        {/* CỘT PHẢI: DASHBOARD */}
        <div className="lg:col-span-9">
             <div className="bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md overflow-hidden flex flex-col min-h-[500px]"> {/* Bỏ height cố định để tự dãn */}
                {/* TOOLBAR */}
                <div className="p-4 border-b border-white/10 flex flex-col gap-4 bg-white/5">
                    {/* Hàng 1: Tabs - Scroll ngang trên mobile */}
                    <div className="flex items-center gap-2 bg-black/20 p-1 rounded-xl overflow-x-auto no-scrollbar">
                        {['day', 'week', 'month', 'year'].map((m) => (
                            <button key={m} onClick={() => setViewMode(m as ViewMode)} className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 whitespace-nowrap transition capitalize ${viewMode===m ? 'bg-white/10 text-white shadow' : 'text-slate-400'}`}>
                                {m==='day' && <LayoutList size={14}/>} {m==='week' && <List size={14}/>} {m==='month' && <Grid3X3 size={14}/>} {m==='year' && <CalendarRange size={14}/>}
                                {m === 'day' ? 'Ngày' : m === 'week' ? 'Tuần' : m === 'month' ? 'Tháng' : 'Năm'}
                            </button>
                        ))}
                    </div>
                    {/* Hàng 2: Navigation */}
                    <div className="flex items-center justify-between bg-black/20 p-2 rounded-xl">
                        <button onClick={() => navigateDate('prev')} className="p-2 hover:bg-white/10 rounded-lg text-slate-300"><ChevronLeft/></button>
                        <h2 className="text-white font-bold text-sm uppercase tracking-wider text-center">{getListTitle()}</h2>
                        <button onClick={() => navigateDate('next')} className="p-2 hover:bg-white/10 rounded-lg text-slate-300"><ChevronRight/></button>
                    </div>
                </div>

                <div className="p-4 flex-grow bg-black/20">
                    
                    {/* VIEW NĂM */}
                    {viewMode === 'year' && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                            {eachMonthOfInterval({ start: startOfYear(currentDate), end: endOfYear(currentDate) }).map(month => {
                                const monthStr = format(month, 'yyyy-MM');
                                const isCurrentMonth = isSameMonth(month, new Date());
                                const count = listSchedules.filter(s => s.date.startsWith(monthStr)).length;
                                return (
                                    <button key={monthStr} onClick={() => { setCurrentDate(month); setViewMode('month'); }}
                                        className={`flex flex-col items-center justify-center p-4 rounded-xl border h-[100px] active:scale-95 transition ${isCurrentMonth ? 'bg-gold/10 border-gold/50' : 'bg-white/5 border-white/5'}`}>
                                        <div className={`font-bold capitalize ${isCurrentMonth ? 'text-gold' : 'text-white'}`}>Tháng {format(month, 'MM')}</div>
                                        <div className={`text-xs mt-2 px-2 py-0.5 rounded-full ${count > 0 ? 'bg-gold text-slate-900 font-bold' : 'bg-white/10 text-slate-500'}`}>{count} lễ</div>
                                    </button>
                                )
                            })}
                        </div>
                    )}

                    {/* VIEW THÁNG */}
                    {viewMode === 'month' && (
                        <div>
                             <div className="grid grid-cols-7 gap-1 mb-2">
                                {['T2','T3','T4','T5','T6','T7','CN'].map(d => <div key={d} className="text-center text-[10px] font-bold text-slate-500 uppercase">{d}</div>)}
                             </div>
                             <div className="grid grid-cols-7 gap-1">
                                {eachDayOfInterval({ start: startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 }) }).map((day) => {
                                    const dayStr = format(day, 'yyyy-MM-dd');
                                    const isCurrent = isSameMonth(day, currentDate);
                                    const count = listSchedules.filter(s => s.date === dayStr).length;
                                    const isTodayDate = isToday(day);
                                    return (
                                        <div key={dayStr} onClick={() => { setCurrentDate(day); setViewMode('day'); prepareAddForDate(dayStr); }}
                                            className={`aspect-square flex flex-col items-center justify-center rounded-lg cursor-pointer ${!isCurrent ? 'opacity-30' : ''} ${isTodayDate ? 'border border-gold text-gold' : 'bg-white/5'}`}>
                                            <span className="text-sm font-bold">{format(day, 'd')}</span>
                                            {count > 0 && <div className="mt-1 w-1.5 h-1.5 bg-gold rounded-full"></div>}
                                        </div>
                                    )
                                })}
                             </div>
                        </div>
                    )}

                    {/* VIEW TUẦN */}
                    {viewMode === 'week' && (
                         <div className="space-y-4">
                             {Array.from({length: 7}).map((_, i) => {
                                 const dayDate = addDays(startOfWeek(currentDate, { weekStartsOn: 1 }), i);
                                 const dayStr = format(dayDate, 'yyyy-MM-dd');
                                 const dayEvents = listSchedules.filter(s => s.date === dayStr);
                                 const isT = isToday(dayDate);
                                 
                                 return (
                                     <div key={i} className={`rounded-xl border p-3 ${isT ? 'border-gold/50 bg-gold/5' : 'border-white/10 bg-white/5'}`}>
                                         <div className="flex justify-between items-center mb-3">
                                             <div className="font-bold text-white capitalize">{format(dayDate, 'EEEE', { locale: vi })}</div>
                                             <div className="text-xs text-slate-400">{format(dayDate, 'dd/MM')}</div>
                                         </div>
                                         <div className="space-y-2">
                                            {dayEvents.length === 0 && <button onClick={() => prepareAddForDate(dayStr)} className="w-full py-2 border border-dashed border-white/10 rounded text-slate-500 text-xs flex items-center justify-center gap-1"><Plus size={12}/> Thêm Lễ</button>}
                                            {dayEvents.map(ev => (
                                                <div key={ev.id} className="bg-black/30 p-3 rounded-lg flex gap-3 relative group">
                                                    <div className="font-mono text-gold font-bold">{ev.start_time.slice(0,5)}</div>
                                                    <div className="flex-grow">
                                                        <div className="font-bold text-white">{ev.title}</div>
                                                        <div className="text-xs text-slate-400">{ev.location}</div>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button onClick={() => startEdit(ev)} className="text-slate-500 hover:text-blue-400"><Edit size={16}/></button>
                                                        <button onClick={() => handleDelete(ev.id)} className="text-slate-500 hover:text-red-400"><Trash2 size={16}/></button>
                                                    </div>
                                                </div>
                                            ))}
                                            {dayEvents.length > 0 && <button onClick={() => prepareAddForDate(dayStr)} className="w-full py-1.5 border border-dashed border-white/10 rounded text-slate-500 hover:text-gold text-xs mt-2">+ Thêm</button>}
                                         </div>
                                     </div>
                                 )
                             })}
                         </div>
                    )}

                    {/* VIEW NGÀY */}
                    {viewMode === 'day' && (
                        <div className="space-y-3">
                            {listSchedules.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-slate-500 border-2 border-dashed border-white/5 rounded-2xl">
                                    <p className="mb-4 text-sm">Trống lịch</p>
                                    <button onClick={() => prepareAddForDate(format(currentDate, 'yyyy-MM-dd'))} className="bg-gold text-slate-900 px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2">
                                        <Plus size={16}/> Tạo Lịch Ngay
                                    </button>
                                </div>
                            ) : (
                                listSchedules.map(item => {
                                    const isPast = isPastEvent(item.date, item.start_time);
                                    return (
                                    <div key={item.id} className={`flex gap-3 p-4 rounded-xl border transition ${isPast ? 'bg-slate-900/50 border-slate-800 opacity-60' : 'bg-black/40 border-white/10'}`}>
                                        <div className={`font-mono font-bold text-lg ${isPast ? 'text-slate-500' : 'text-gold'}`}>{item.start_time.slice(0,5)}</div>
                                        <div className="flex-grow">
                                            <div className={`font-bold ${isPast ? 'text-slate-500' : 'text-white'}`}>{item.title}</div>
                                            <div className="text-xs text-slate-500 flex items-center gap-1 mt-1"><MapPin size={10}/> {item.location}</div>
                                            <div className="text-xs text-slate-500 mt-1 italic">{item.priest_name}</div>
                                        </div>
                                        <div className="flex flex-col gap-2 justify-center">
                                            <button onClick={() => startEdit(item)} className="p-2 bg-white/5 rounded text-slate-400"><Edit size={16}/></button>
                                            <button onClick={() => handleDelete(item.id)} className="p-2 bg-red-900/20 rounded text-red-400"><Trash2 size={16}/></button>
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
    </div>
  )
}