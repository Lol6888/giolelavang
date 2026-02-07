'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import { LogOut, Plus, Trash2, Calendar as CalIcon, Loader2, User, ChevronLeft, ChevronRight, MapPin, LayoutList, Grid3X3, List, Edit, CalendarRange, Clock, Menu } from 'lucide-react'
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
  const mainContainerRef = useRef<HTMLDivElement>(null)

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
      mainContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const startEdit = (item: Schedule) => {
      setForm({ start_time: item.start_time.slice(0,5), title: item.title, priest_name: item.priest_name, note: item.note, location: item.location })
      setSelectedDateForInput(item.date)
      setEditingId(item.id)
      mainContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
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
    <div ref={mainContainerRef} className="h-screen w-full bg-slate-950 text-slate-200 font-sans overflow-y-auto overflow-x-hidden pb-32">
      
      {/* HEADER */}
      <div className="sticky top-0 z-[60] bg-slate-950/90 backdrop-blur-md border-b border-white/10 px-4 py-3 flex justify-between items-center shadow-lg">
            <h1 className="font-serif text-lg font-bold text-gold flex items-center gap-2">
                <div className="bg-gold/20 p-1.5 rounded-lg"><User size={20} className="text-gold"/></div>
                Admin Panel
            </h1>
            <button onClick={async () => { await supabase.auth.signOut(); router.push('/login'); }} className="flex items-center gap-2 text-xs font-bold text-red-400 bg-red-900/20 px-4 py-2.5 rounded-xl hover:bg-red-900/30 transition">
                <LogOut size={16}/> <span className="hidden sm:inline">Thoát</span>
            </button>
      </div>

      <div className="max-w-[1600px] mx-auto p-4 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* CỘT TRÁI: FORM */}
        <div className="lg:col-span-3 h-fit">
            <div className={`border p-5 rounded-3xl backdrop-blur-md shadow-2xl transition-colors ${editingId ? 'bg-blue-900/10 border-blue-500/50' : 'bg-white/5 border-white/10'}`}>
                <h2 className={`font-bold mb-4 flex items-center gap-2 text-lg border-b pb-2 ${editingId ? 'text-blue-400 border-blue-500/30' : 'text-white border-white/10'}`}>
                    {editingId ? <><Edit className="text-blue-400" size={24}/> Sửa Lễ</> : <><Plus className="text-gold" size={24}/> Nhập Mới</>}
                </h2>
                <form onSubmit={handleSave} className="space-y-4">
                    {/* NGÀY */}
                    <div className="space-y-1 relative" ref={calRef}>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ngày diễn ra</label>
                        <div onClick={() => setShowCalendar(!showCalendar)} className="w-full bg-black/40 border border-white/10 rounded-xl p-3.5 text-white flex justify-between items-center cursor-pointer active:scale-95 transition">
                            <span className="font-bold text-lg">{displayDateInput()}</span>
                            <CalIcon size={20} className="text-gold"/>
                        </div>
                        {showCalendar && (
                            <div className="absolute top-full left-0 mt-2 w-full bg-slate-900 border border-white/20 rounded-2xl shadow-2xl p-4 z-[100] animate-fade-in">
                                <div className="flex justify-between items-center mb-4">
                                    <button type="button" onClick={() => setSelectedDateForInput(format(subMonths(parseISO(selectedDateForInput), 1), 'yyyy-MM-dd'))} className="p-2 bg-white/10 rounded-lg"><ChevronLeft size={24}/></button>
                                    <span className="font-bold text-white capitalize text-lg">{format(parseISO(selectedDateForInput), 'MMMM', { locale: vi })}</span>
                                    <button type="button" onClick={() => setSelectedDateForInput(format(addMonths(parseISO(selectedDateForInput), 1), 'yyyy-MM-dd'))} className="p-2 bg-white/10 rounded-lg"><ChevronRight size={24}/></button>
                                </div>
                                <div className="grid grid-cols-7 gap-1">
                                    {eachDayOfInterval({start: startOfWeek(startOfMonth(parseISO(selectedDateForInput)), {weekStartsOn:1}), end: endOfWeek(endOfMonth(parseISO(selectedDateForInput)), {weekStartsOn:1})}).map((day, idx) => {
                                        const isSelected = selectedDateForInput === format(day, 'yyyy-MM-dd');
                                        const isCurrentMonth = isSameMonth(day, parseISO(selectedDateForInput));
                                        return (
                                            <button key={idx} type="button" onClick={() => { setSelectedDateForInput(format(day, 'yyyy-MM-dd')); setShowCalendar(false); }}
                                                className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold transition ${!isCurrentMonth ? 'text-slate-700' : 'text-slate-300'} ${isSelected ? 'bg-gold text-black shadow-lg scale-110' : ''}`}>
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
                             <div onClick={() => setShowTimePicker(!showTimePicker)} className="w-full bg-black/40 border border-white/10 rounded-xl p-3.5 text-white flex justify-center items-center cursor-pointer active:scale-95 transition">
                                <span className="font-mono font-bold text-lg">{form.start_time}</span>
                             </div>
                             {showTimePicker && (
                                <div className="absolute top-full left-0 mt-2 w-[300px] bg-slate-900 border border-white/20 rounded-2xl shadow-2xl p-4 z-[100] grid grid-cols-2 gap-4">
                                    <div className="max-h-[250px] overflow-y-auto custom-scrollbar pr-1">{HOURS.map(h => (<button key={h} type="button" onClick={() => setForm(prev => ({...prev, start_time: `${h}:${prev.start_time.split(':')[1]}`}))} className={`w-full py-2.5 rounded mb-1 text-base font-bold ${form.start_time.startsWith(h) ? 'bg-gold text-black' : 'text-slate-300 bg-white/5'}`}>{h}</button>))}</div>
                                    <div>{MINUTES.map(m => (<button key={m} type="button" onClick={() => { setForm(prev => ({...prev, start_time: `${prev.start_time.split(':')[0]}:${m}`})); setShowTimePicker(false); }} className={`w-full py-2.5 rounded mb-1 text-base font-bold ${form.start_time.endsWith(m) ? 'bg-gold text-black' : 'text-slate-300 bg-white/5'}`}>{m}</button>))}</div>
                                </div>
                             )}
                        </div>
                        <div className="col-span-3 space-y-1">
                             <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tên Lễ</label>
                             <input type="text" placeholder="Vd: Lễ Sáng" required className="w-full bg-black/40 border border-white/10 rounded-xl p-3.5 text-base text-white focus:border-gold outline-none" value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
                        </div>
                    </div>
                    {/* ĐỊA ĐIỂM */}
                    <div className="space-y-1 relative" ref={locRef}>
                         <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nơi tổ chức</label>
                         <div className="relative">
                            <MapPin className="absolute left-3 top-3.5 text-white/30" size={20}/>
                            <input type="text" placeholder="Chọn hoặc nhập..." className="w-full bg-black/40 border border-white/10 rounded-xl p-3.5 pl-10 text-base text-white focus:border-gold outline-none" value={form.location} onChange={e => setForm({...form, location: e.target.value})} onFocus={() => setShowLocPicker(true)} />
                            {showLocPicker && (
                                <div className="absolute top-full left-0 mt-2 w-full bg-slate-900 border border-white/20 rounded-2xl shadow-2xl py-2 z-[100] max-h-[250px] overflow-y-auto custom-scrollbar">
                                    {locations.map(loc => (
                                        <div key={loc.id} className="flex justify-between items-center px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/5">
                                            <button type="button" onClick={() => { setForm(prev => ({...prev, location: loc.name})); setShowLocPicker(false); }} className="flex-grow text-left text-base text-slate-300 font-medium">{loc.name}</button>
                                            <button type="button" onClick={(e) => deleteLocation(loc.id, e)} className="p-2 text-slate-500 hover:text-red-500"><X size={20}/></button>
                                        </div>
                                    ))}
                                </div>
                            )}
                         </div>
                    </div>
                    {/* LINH MỤC */}
                    <div className="space-y-1">
                         <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Linh mục</label>
                         <input type="text" placeholder="Tên Cha..." className="w-full bg-black/40 border border-white/10 rounded-xl p-3.5 text-base text-white focus:border-gold outline-none" value={form.priest_name} onChange={e => setForm({...form, priest_name: e.target.value})} />
                    </div>
                    {/* BUTTONS */}
                    <div className="flex gap-3 pt-2">
                        {editingId && (<button type="button" onClick={() => { setEditingId(null); setForm(prev => ({ ...prev, title: '', priest_name: '' })) }} className="w-1/3 bg-slate-800 text-white font-bold py-4 rounded-xl text-base">Hủy</button>)}
                        <button disabled={loading} className={`flex-grow font-bold py-4 rounded-xl flex justify-center items-center gap-2 text-base shadow-lg active:scale-95 transition ${editingId ? 'bg-blue-600 text-white' : 'bg-gold text-slate-900'}`}>{loading ? <Loader2 className="animate-spin"/> : (editingId ? 'Cập Nhật' : 'Thêm Mới')}</button>
                    </div>
                </form>
            </div>
        </div>

        {/* CỘT PHẢI: DASHBOARD */}
        <div className="lg:col-span-9">
             <div className="bg-white/5 border border-white/10 rounded-3xl backdrop-blur-md overflow-hidden flex flex-col min-h-[600px] shadow-2xl">
                {/* TOOLBAR */}
                <div className="p-4 border-b border-white/10 flex flex-col sm:flex-row gap-4 justify-between items-center bg-white/5">
                    <div className="flex items-center gap-1 bg-black/40 p-1.5 rounded-xl w-full sm:w-auto overflow-x-auto no-scrollbar">
                        {['day', 'week', 'month', 'year'].map((m) => (
                            <button key={m} onClick={() => setViewMode(m as ViewMode)} className={`px-5 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 whitespace-nowrap transition capitalize ${viewMode===m ? 'bg-white/10 text-white shadow ring-1 ring-white/10' : 'text-slate-400 hover:text-white'}`}>
                                {m==='day' && <LayoutList size={16}/>} {m==='week' && <List size={16}/>} {m==='month' && <Grid3X3 size={16}/>} {m==='year' && <CalendarRange size={16}/>}
                                {m === 'day' ? 'Ngày' : m === 'week' ? 'Tuần' : m === 'month' ? 'Tháng' : 'Năm'}
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-4 bg-black/40 p-1.5 rounded-xl w-full sm:w-auto justify-between sm:justify-end">
                        <button onClick={() => navigateDate('prev')} className="p-2.5 hover:bg-white/10 rounded-lg text-slate-300 transition"><ChevronLeft size={24}/></button>
                        <h2 className="text-white font-bold text-base uppercase tracking-wider text-center min-w-[150px]">{getListTitle()}</h2>
                        <button onClick={() => navigateDate('next')} className="p-2.5 hover:bg-white/10 rounded-lg text-slate-300 transition"><ChevronRight size={24}/></button>
                    </div>
                </div>

                <div className="p-4 flex-grow bg-black/20 overflow-y-auto custom-scrollbar">
                    
                    {/* VIEW NĂM */}
                    {viewMode === 'year' && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                            {eachMonthOfInterval({ start: startOfYear(currentDate), end: endOfYear(currentDate) }).map(month => {
                                const monthStr = format(month, 'yyyy-MM');
                                const isCurrentMonth = isSameMonth(month, new Date());
                                const count = listSchedules.filter(s => s.date.startsWith(monthStr)).length;
                                return (
                                    <button key={monthStr} onClick={() => { setCurrentDate(month); setViewMode('month'); }}
                                        className={`relative flex flex-col items-center justify-center p-4 rounded-2xl border h-[120px] active:scale-95 transition group ${isCurrentMonth ? 'bg-gold/10 border-gold/50' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}>
                                        <div className={`font-serif text-xl font-bold capitalize ${isCurrentMonth ? 'text-gold' : 'text-white'}`}>Tháng {format(month, 'MM', { locale: vi })}</div>
                                        {count > 0 && <div className="mt-2 text-xs font-bold bg-gold text-black px-3 py-1 rounded-full shadow-lg">{count} lễ</div>}
                                    </button>
                                )
                            })}
                        </div>
                    )}

                    {/* VIEW THÁNG */}
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
                                    else if(isTodayDate) cellClass += "bg-white/10 border-blue-500/50 text-blue-400 ";
                                    else cellClass += "bg-white/5 border-white/5 hover:bg-white/10 ";

                                    return (
                                        <div key={dayStr} onClick={() => { setCurrentDate(day); setViewMode('day'); prepareAddForDate(dayStr); }} className={cellClass}>
                                            <span className="text-base sm:text-xl font-bold font-mono">{format(day, 'd')}</span>
                                            {count > 0 && (
                                                <div className="mt-1 sm:mt-2 bg-gold text-slate-900 text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full shadow-lg">
                                                    {count}
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                             </div>
                        </div>
                    )}

                    {/* VIEW TUẦN (SỬA LỚN: NÚT HIỆN LUÔN, DỄ BẤM) */}
                    {viewMode === 'week' && (
                         <div className="space-y-6 pb-10">
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
                                             <button onClick={() => prepareAddForDate(dayStr)} className="p-2 rounded-xl bg-white/10 hover:bg-gold hover:text-black transition"><Plus size={20}/></button>
                                         </div>
                                         
                                         <div className="p-2 sm:p-3 space-y-3">
                                            {dayEvents.length === 0 && <div className="text-center py-4 text-xs text-slate-600 italic">Chưa có lịch lễ</div>}
                                            {dayEvents.map(ev => (
                                                <div key={ev.id} className="bg-black/40 border border-white/5 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center gap-4 group">
                                                    {/* Thông tin */}
                                                    <div className="flex items-center gap-4 flex-grow">
                                                         <div className="font-mono text-gold font-bold text-xl">{ev.start_time.slice(0,5)}</div>
                                                         <div className="min-w-0">
                                                             <div className="font-bold text-white text-lg truncate">{ev.title}</div>
                                                             <div className="flex flex-wrap gap-3 text-sm text-slate-400 mt-1">
                                                                 <span className="flex items-center gap-1"><MapPin size={14}/> {ev.location}</span>
                                                                 {ev.priest_name && <span className="flex items-center gap-1"><User size={14}/> {ev.priest_name}</span>}
                                                             </div>
                                                         </div>
                                                    </div>
                                                    
                                                    {/* NÚT BẤM (HIỆN LUÔN, KHÔNG CẦN HOVER) */}
                                                    <div className="flex gap-3 justify-end border-t border-white/5 pt-3 sm:border-t-0 sm:pt-0">
                                                        <button onClick={() => startEdit(ev)} className="flex items-center gap-2 px-4 py-2 bg-blue-900/30 text-blue-400 rounded-lg hover:bg-blue-600 hover:text-white transition font-medium text-sm">
                                                            <Edit size={18}/> <span className="sm:hidden">Sửa</span>
                                                        </button>
                                                        <button onClick={() => handleDelete(ev.id)} className="flex items-center gap-2 px-4 py-2 bg-red-900/30 text-red-400 rounded-lg hover:bg-red-600 hover:text-white transition font-medium text-sm">
                                                            <Trash2 size={18}/> <span className="sm:hidden">Xóa</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                         </div>
                                     </div>
                                 )
                             })}
                         </div>
                    )}

                    {/* VIEW NGÀY (SỬA LỚN: NÚT TO, DỄ BẤM) */}
                    {viewMode === 'day' && (
                        <div className="space-y-4 pb-10">
                            {listSchedules.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-24 text-slate-500 border-2 border-dashed border-white/5 rounded-3xl bg-white/5">
                                    <Clock size={48} className="mb-4 opacity-20"/>
                                    <p className="mb-4 text-base font-medium">Hôm nay chưa có lễ nào</p>
                                    <button onClick={() => prepareAddForDate(format(currentDate, 'yyyy-MM-dd'))} className="bg-gold hover:bg-yellow-400 text-slate-900 px-6 py-3 rounded-xl font-bold text-sm flex items-center gap-2 transition shadow-lg shadow-gold/20">
                                        <Plus size={20}/> Tạo Lịch Ngay
                                    </button>
                                </div>
                            ) : (
                                listSchedules.map(item => {
                                    const isPast = isPastEvent(item.date, item.start_time);
                                    return (
                                    <div key={item.id} className={`flex gap-4 p-5 rounded-2xl border transition ${isPast ? 'bg-slate-900/50 border-slate-800 opacity-60' : 'bg-black/40 border-white/10'}`}>
                                        <div className={`font-mono font-bold text-2xl ${isPast ? 'text-slate-500' : 'text-gold'}`}>{item.start_time.slice(0,5)}</div>
                                        <div className="flex-grow min-w-0">
                                            <div className={`font-bold text-xl truncate ${isPast ? 'text-slate-500' : 'text-white'}`}>{item.title}</div>
                                            <div className="text-sm text-slate-500 flex flex-wrap gap-3 mt-1.5">
                                                <span className="flex items-center gap-1"><MapPin size={14}/> {item.location}</span>
                                                <span className="flex items-center gap-1"><User size={14}/> {item.priest_name}</span>
                                            </div>
                                        </div>
                                        {/* Nút bấm dọc bên phải, luôn hiển thị */}
                                        <div className="flex flex-col gap-3 justify-center pl-4 border-l border-white/5">
                                            <button onClick={() => startEdit(item)} className="p-3 bg-blue-900/20 text-blue-400 rounded-xl hover:bg-blue-600 hover:text-white transition">
                                                <Edit size={20}/>
                                            </button>
                                            <button onClick={() => handleDelete(item.id)} className="p-3 bg-red-900/20 text-red-400 rounded-xl hover:bg-red-600 hover:text-white transition">
                                                <Trash2 size={20}/>
                                            </button>
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