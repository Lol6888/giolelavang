'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { format, differenceInMinutes, parseISO, addDays, startOfWeek, endOfWeek, isSameDay } from 'date-fns'
import { vi } from 'date-fns/locale'
import { Clock, MapPin, Calendar, Sun, CloudRain, X, Loader2, PlayCircle, User } from 'lucide-react'

// --- TYPES ---
type Schedule = {
  id: number; date: string; start_time: string; title: string; priest_name: string; note: string; location: string; video_url?: string;
}

export default function CinematicHome() {
  const [schedules, setSchedules] = useState<Schedule[]>([]) 
  const [weekSchedules, setWeekSchedules] = useState<Schedule[]>([]) 
  const [now, setNow] = useState(new Date())
  const [weather, setWeather] = useState({ temp: 28, code: 0, desc: 'Đang tải...' })
  
  // Modal State
  const [showWeekModal, setShowWeekModal] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [loadingWeek, setLoadingWeek] = useState(false)
  
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // --- LOGIC ---
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t) }, [])

  useEffect(() => {
    async function fetchWeather() {
      try {
        const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=16.705&longitude=107.195&current_weather=true')
        const data = await res.json()
        const code = data.current_weather.weathercode
        setWeather({ 
            temp: Math.round(data.current_weather.temperature), 
            code: code, 
            desc: code >= 51 ? 'Có mưa' : (code <= 3 ? 'Nắng đẹp' : 'Nhiều mây') 
        })
      } catch (e) {}
    }
    fetchWeather(); setInterval(fetchWeather, 600000)
  }, [])

  const fetchTodaySchedules = async () => {
    const todayStr = format(new Date(), 'yyyy-MM-dd')
    const { data } = await supabase.from('schedules').select('*').eq('date', todayStr).order('start_time')
    if (data) setSchedules(data)
  }

  const fetchWeekSchedules = async () => {
      setLoadingWeek(true);
      const start = format(new Date(), 'yyyy-MM-dd');
      const end = format(addDays(new Date(), 7), 'yyyy-MM-dd');
      const { data } = await supabase.from('schedules').select('*').gte('date', start).lte('date', end).order('date').order('start_time')
      if(data) setWeekSchedules(data);
      setLoadingWeek(false);
  }

  useEffect(() => {
    fetchTodaySchedules()
    const ch = supabase.channel('home').on('postgres_changes', { event: '*', schema: 'public', table: 'schedules' }, () => {
        fetchTodaySchedules(); if(showWeekModal) fetchWeekSchedules();
    }).subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  // Modal Animation
  useEffect(() => {
      if(showWeekModal) {
          fetchWeekSchedules();
          setModalVisible(true);
      } else {
          setTimeout(() => setModalVisible(false), 300);
      }
  }, [showWeekModal])

  // Canvas Rain
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas || weather.code < 51) return;
    const ctx = canvas.getContext('2d'); if(!ctx) return;
    let particles: any[] = [];
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }; window.addEventListener('resize', resize); resize();
    const createParticles = () => { particles = []; const count = window.innerWidth < 768 ? 100 : 350; for(let i=0; i<count; i++) particles.push({ x: Math.random()*canvas.width, y: Math.random()*canvas.height, v: Math.random()*20+15, l: Math.random()*20+10, o: Math.random()*0.4+0.1 }); }
    createParticles();
    const draw = () => {
        ctx.clearRect(0,0, canvas.width, canvas.height); ctx.strokeStyle = 'rgba(180, 200, 235, 0.8)'; ctx.lineWidth = 1.5; ctx.beginPath();
        particles.forEach(p => { ctx.globalAlpha = p.o; ctx.moveTo(p.x, p.y); ctx.lineTo(p.x, p.y + p.l); p.y += p.v; p.x -= 1; if(p.y > canvas.height) { p.y = -20; p.x = Math.random() * canvas.width; } if(p.x < 0) p.x = canvas.width; });
        ctx.stroke(); requestAnimationFrame(draw);
    }
    draw();
  }, [weather.code])

  // --- RENDER HELPERS ---
  const getStatus = () => {
    const timeStr = format(now, 'HH:mm:ss');
    const current = schedules.find(s => {
        const endHour = parseInt(s.start_time.split(':')[0]) + 1;
        const end = `${endHour.toString().padStart(2,'0')}:${s.start_time.split(':')[1]}:00`;
        return timeStr >= s.start_time && timeStr < end;
    });
    if(current) return { type: 'happening', item: current };
    const next = schedules.find(s => s.start_time > timeStr);
    if(next) {
        const diff = differenceInMinutes(parseISO(`${next.date}T${next.start_time}`), now);
        return { type: diff <= 60 ? 'countdown' : 'upcoming', item: next, diff };
    }
    return { type: 'finished' };
  }
  const status = getStatus();

  // CSS CLASSES
  const widgetContainerStyle = "flex gap-3 sm:gap-4 mt-2 w-full max-w-xl mx-auto lg:mx-0"; 
  const widgetStyle = "bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl shadow-xl px-4 py-2 sm:px-5 sm:py-3 flex items-center gap-2 sm:gap-3 flex-1 justify-center";
  const cardStyle = "bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl sm:rounded-3xl shadow-xl p-5 sm:p-8 animate-fade-in w-full max-w-xl mx-auto lg:mx-0";

  return (
    <div className="relative h-screen font-sans text-slate-100 overflow-hidden flex flex-col">
        {/* BACKGROUND */}
        <div className={`absolute inset-0 bg-basilica bg-cover bg-center animate-ken-burns z-0 transition-all duration-1000 ${weather.code >= 51 ? 'filter grayscale brightness-75' : ''}`}></div>
        <div className="absolute inset-0 bg-black/40 z-0"></div>
        <canvas ref={canvasRef} className="absolute inset-0 z-1 pointer-events-none"></canvas>
        
        {/* SUN RAYS */}
        {weather.code <= 3 && (
            <div className="absolute inset-0 z-1 pointer-events-none">
                <div className="ray_box">
                    <div className="ray" style={{height:'600px', width:'100px', transform:'rotate(180deg)', top:'-300px', left:'0'}}></div>
                    <div className="ray" style={{height:'700px', width:'100px', transform:'rotate(220deg)', top:'-300px', left:'50px'}}></div>
                    <div className="ray" style={{height:'800px', width:'100px', transform:'rotate(300deg)', top:'-300px', left:'100px'}}></div>
                </div>
            </div>
        )}

        {/* MARQUEE - Đã chỉnh khoảng cách chữ */}
        <div className="sticky top-0 z-[60] bg-black/60 backdrop-blur-md text-white/90 text-xs sm:text-sm py-2 px-4 border-b border-white/10 shrink-0">
             <div className="marquee-container w-full">
                <div className="marquee-content font-medium flex items-center">
                    <span className="mr-24">🔔 Xin quý khách giữ vệ sinh chung nơi tôn nghiêm.</span>
                    <span className="mr-24">🙏 Giờ Giải Tội: Trước và sau mỗi Thánh Lễ tại Nhà Nguyện.</span>
                    <span className="mr-24">🏥 Trạm Y Tế trực 24/24 tại Cổng Số 2.</span>
                </div>
            </div>
        </div>

        {/* MAIN SCROLL CONTAINER */}
        <div className="flex-grow overflow-y-auto z-10 custom-scrollbar relative w-full p-3 sm:p-4 lg:p-8">
            <div className="max-w-[1800px] mx-auto min-h-full flex flex-col lg:grid lg:grid-cols-12 gap-4 lg:gap-8 pb-20 lg:pb-0">
                
                {/* SPACER MOBILE - Tạo khoảng trống để thấy hình nền trên điện thoại */}
                <div className="lg:hidden w-full h-[45vh] shrink-0 pointer-events-none"></div>

                {/* LEFT COLUMN */}
                <div className="lg:col-span-7 h-auto lg:h-full relative flex flex-col justify-end transition-all duration-500 order-1 lg:pl-4 lg:pb-12">
                     <div className="h-full flex flex-col justify-end items-start gap-2">
                        
                        {/* 1. HAPPENING */}
                        {status.type === 'happening' && status.item && (
                            <div className={`${cardStyle} border-red-500/30`}>
                                <div className="flex items-center gap-2 sm:gap-3 mb-2"><span className="relative flex h-2.5 w-2.5 sm:h-3 sm:w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span><span className="relative inline-flex rounded-full h-full w-full bg-red-600"></span></span><span className="text-red-400 text-[10px] sm:text-xs font-bold uppercase tracking-widest">Đang diễn ra</span></div>
                                <h1 className="font-serif font-bold text-3xl sm:text-4xl lg:text-5xl leading-tight text-white mb-2 text-shadow">{status.item.title}</h1>
                                <div className="inline-flex items-center gap-1.5 text-white/80 font-medium mb-3 bg-black/20 px-2 py-0.5 sm:px-3 sm:py-1 rounded-lg border border-white/5 backdrop-blur-sm">
                                    <MapPin size={14} className="text-gold"/>
                                    <span className="text-xs sm:text-sm uppercase tracking-wide">{status.item.location}</span>
                                </div>
                                <div className="flex items-center gap-2 text-white/80 font-serif italic text-base sm:text-lg border-b border-white/10 pb-3 sm:pb-4 mb-0">
                                    <User size={18}/> <span className="truncate">Chủ tế: {status.item.priest_name}</span>
                                </div>
                                <button className="mt-2 group flex items-center gap-2 sm:gap-3 bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 sm:px-6 sm:py-3 rounded-xl font-bold transition shadow-lg shadow-red-900/40 animate-pulse-slow w-full lg:w-fit justify-center lg:justify-start">
                                    <div className="bg-white/20 p-1.5 rounded-full"><PlayCircle size={20}/></div>
                                    <span className="tracking-wider text-sm sm:text-base">XEM TRỰC TIẾP</span>
                                </button>
                            </div>
                        )}

                        {/* 2. COUNTDOWN */}
                        {status.type === 'countdown' && status.item && (
                            <div className={`${cardStyle} border-gold/30`}>
                                <div className="bg-gold text-marian-dark font-bold text-[10px] sm:text-xs px-2 sm:px-3 py-1 rounded inline-block mb-2 sm:mb-3 uppercase tracking-widest shadow-lg">Sắp diễn ra</div>
                                <h1 className="font-serif font-bold text-3xl sm:text-4xl lg:text-5xl text-white mb-2 sm:mb-3 text-shadow leading-tight">{status.item.title}</h1>
                                <div className="flex items-center gap-2 mb-3 sm:mb-4 text-white/90">
                                    <MapPin size={14} className="text-gold"/>
                                    <span className="text-xs sm:text-sm font-bold uppercase tracking-widest">{status.item.location}</span>
                                </div>
                                <div className="bg-black/30 rounded-xl p-2 sm:p-3 border border-white/10 mb-1 inline-block w-full text-center lg:text-left">
                                    <div className="text-[10px] text-white/60 uppercase tracking-widest mb-1 font-bold">Thời gian còn lại</div>
                                    <div className="font-mono text-4xl sm:text-5xl lg:text-7xl font-bold text-white tabular-nums drop-shadow-2xl tracking-tighter">
                                        {status.diff} phút
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 3. UPCOMING */}
                        {status.type === 'upcoming' && status.item && (
                            <div className={cardStyle}>
                                <div className="flex items-center gap-2 mb-2 sm:mb-3"><div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-400 rounded-full shadow-[0_0_10px_#4ade80]"></div><span className="text-[10px] sm:text-xs font-bold text-green-300 uppercase tracking-widest">Sẵn sàng</span></div>
                                <div className="mb-3 sm:mb-4">
                                    <div className="text-gold-light text-[10px] sm:text-xs uppercase tracking-[0.2em] mb-1 font-bold">Thánh Lễ Kế Tiếp</div>
                                    <h1 className="font-serif font-bold text-3xl sm:text-4xl lg:text-6xl text-white text-shadow leading-tight">{status.item.title}</h1>
                                </div>
                                <div className="flex gap-4 sm:gap-6 border-t border-white/20 pt-3 sm:pt-4">
                                    <div><div className="text-[10px] text-white/50 uppercase mb-0.5 font-bold">Thời gian</div><div className="text-xl sm:text-2xl font-bold text-white">{status.item.start_time.slice(0,5)}</div></div>
                                    <div className="w-px bg-white/20"></div>
                                    <div><div className="text-[10px] text-white/50 uppercase mb-0.5 font-bold">Địa điểm</div><div className="text-xl sm:text-2xl font-serif italic text-white">{status.item.location}</div></div>
                                </div>
                            </div>
                        )}

                        {/* 4. FINISHED */}
                        {status.type === 'finished' && (
                            <div className={cardStyle}>
                                <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-2 text-shadow">Lạy Mẹ La Vang</h1>
                                <p className="text-base sm:text-lg text-white/80 italic font-serif">Xin cầu cho chúng con.</p>
                            </div>
                        )}

                        {/* WIDGETS */}
                        <div className={widgetContainerStyle}>
                            <div className={widgetStyle}>
                                {weather.code >= 51 ? <CloudRain className="text-blue-400 w-6 h-6 sm:w-8 sm:h-8"/> : <Sun className="text-yellow-400 w-6 h-6 sm:w-8 sm:h-8"/>}
                                <div><div className="text-xl sm:text-2xl font-bold text-white">{weather.temp}°C</div><div className="text-[10px] sm:text-xs text-white/70 uppercase font-bold">{weather.desc}</div></div>
                            </div>
                            <div className={widgetStyle}>
                                <Clock className="text-white/60 w-5 h-5 sm:w-6 sm:h-6"/>
                                <div className="text-2xl sm:text-3xl font-bold font-mono text-white tracking-widest">{format(now, 'HH:mm')}</div>
                            </div>
                        </div>
                     </div>
                </div>

                {/* RIGHT COLUMN */}
                <div className="lg:col-span-5 h-auto flex flex-col order-2">
                    <div className="glass-panel rounded-2xl sm:rounded-3xl flex flex-col overflow-hidden h-[400px] lg:h-full">
                        <div className="p-4 sm:p-6 border-b border-white/10 bg-white/5 flex justify-between items-center flex-none">
                            <h2 className="font-serif text-lg sm:text-xl font-bold text-white tracking-wide truncate">Thánh Lễ hôm nay</h2>
                            <div className="flex items-center gap-2 shrink-0">
                                <button onClick={() => setShowWeekModal(true)} className="flex items-center gap-2 bg-gold/20 hover:bg-gold/40 border border-gold/30 px-3 py-1.5 rounded-full transition group cursor-pointer active:scale-95">
                                    <Calendar size={14} className="text-gold"/>
                                    <span className="text-[10px] sm:text-xs font-bold text-gold uppercase tracking-wider hidden sm:block">Lịch Tuần</span>
                                </button>
                                <span className="text-[10px] sm:text-xs font-bold text-white/80 bg-white/10 px-2 sm:px-3 py-1.5 rounded-full backdrop-blur border border-white/10">
                                    {format(now, 'dd/MM/yyyy', {locale: vi})}
                                </span>
                            </div>
                        </div>
                        <div className="overflow-y-auto flex-grow p-3 sm:p-4 custom-scrollbar">
                            <div className="space-y-2 sm:space-y-3 relative pl-4 before:absolute before:left-[27px] before:top-4 before:bottom-4 before:w-[1px] before:bg-white/20">
                                {schedules.length === 0 ? <p className="text-white/40 text-center italic mt-10 text-xs">Không có lễ.</p> :
                                schedules.map(ev => {
                                    const isPast = ev.start_time < format(now, 'HH:mm:ss') && status.item?.id !== ev.id;
                                    const isActive = status.item?.id === ev.id;
                                    return (
                                        <div key={ev.id} className={`flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl transition-all border border-transparent group ${isActive ? 'bg-gradient-to-r from-red-600/20 to-transparent border-l-4 border-l-red-500 shadow-lg transform scale-[1.02]' : (isPast ? 'opacity-40 grayscale hover:opacity-100' : 'hover:bg-white/10')}`}>
                                            <div className={`w-12 sm:w-16 text-right text-base sm:text-lg text-shadow-light font-mono ${isActive ? 'text-red-400' : 'text-white'}`}>{ev.start_time.slice(0,5)}</div>
                                            <div className="flex-grow min-w-0">
                                                <div className={`text-sm sm:text-base text-shadow-light truncate ${isActive ? 'text-white font-bold' : 'text-white/90'}`}>{ev.title}</div>
                                                <div className="flex items-center gap-1 text-[9px] sm:text-[10px] text-white/70 uppercase font-bold tracking-wider my-0.5 truncate">
                                                    <MapPin size={10}/> {ev.location}
                                                </div>
                                                <div className="text-[11px] sm:text-xs text-white/60 truncate italic">{ev.priest_name}</div>
                                            </div>
                                            {isActive && <span className="text-[9px] sm:text-[10px] font-bold bg-red-600 text-white px-1.5 sm:px-2 py-0.5 rounded shadow animate-pulse shrink-0">LIVE</span>}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* WEEK MODAL */}
        {(showWeekModal || modalVisible) && (
            <div className={`fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md transition-opacity duration-300 ${modalVisible ? 'opacity-100' : 'opacity-0'}`}>
                <div className={`bg-[#1a1a24] border border-white/20 rounded-2xl sm:rounded-3xl w-[95%] sm:w-full max-w-6xl max-h-[85vh] sm:max-h-[90vh] flex flex-col shadow-2xl transition-transform duration-300 ${modalVisible ? 'scale-100' : 'scale-95'}`}>
                    <div className="flex justify-between items-center p-4 sm:p-6 border-b border-white/10 bg-white/5 rounded-t-2xl sm:rounded-t-3xl">
                        <div>
                            <h2 className="font-serif text-xl sm:text-3xl font-bold text-white text-shadow">Lịch Thánh Lễ trong tuần này</h2>
                            <p className="text-white/60 text-xs sm:text-sm mt-1">Chi tiết các Thánh Lễ trong 7 ngày tới</p>
                        </div>
                        <button onClick={() => setShowWeekModal(false)} className="p-2 bg-white/10 hover:bg-red-600/80 rounded-full transition group active:scale-90">
                            <X className="text-white" size={24}/>
                        </button>
                    </div>
                    <div className="overflow-y-auto p-4 sm:p-6 custom-scrollbar bg-black/20">
                        {loadingWeek ? <div className="h-40 flex items-center justify-center"><Loader2 className="animate-spin text-gold" size={32}/></div> : 
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                            {(() => {
                                const grouped: any = {};
                                for(let i=0; i<7; i++) { const d = format(addDays(new Date(), i), 'yyyy-MM-dd'); grouped[d] = []; }
                                weekSchedules.forEach(s => { if(grouped[s.date]) grouped[s.date].push(s); });
                                return Object.entries(grouped).map(([date, items]: any) => {
                                    const isTodayDate = isSameDay(parseISO(date), now);
                                    return (
                                        <div key={date} className={`rounded-xl border p-3 sm:p-4 transition duration-300 ${isTodayDate ? 'border-gold bg-gold/10 ring-1 ring-gold/50' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}>
                                            <div className="flex justify-between items-center mb-2 sm:mb-3 border-b border-white/10 pb-2">
                                                <span className="font-serif font-bold text-lg sm:text-xl text-white capitalize">{format(parseISO(date), 'EEEE', {locale: vi})}</span>
                                                <span className={`text-[10px] sm:text-xs font-bold border border-current px-2 py-0.5 rounded-full ${isTodayDate ? 'text-gold' : 'text-white/70'}`}>{format(parseISO(date), 'dd/MM')}</span>
                                            </div>
                                            <div className="space-y-0.5 sm:space-y-1">
                                                {items.length === 0 ? <p className="text-[10px] text-white/30 italic py-2 text-center">- Trống -</p> : 
                                                items.map((ev: any) => (
                                                    <div key={ev.id} className="flex items-start gap-2 sm:gap-3 py-2 border-b border-white/5 last:border-0 group">
                                                        <div className="font-mono text-white font-bold bg-white/10 px-1.5 rounded text-xs sm:text-sm whitespace-nowrap">{ev.start_time.slice(0,5)}</div>
                                                        <div className="min-w-0">
                                                            <div className="text-xs sm:text-sm font-bold text-white leading-tight truncate">{ev.title}</div>
                                                            <div className="text-[10px] sm:text-[11px] text-white/50 uppercase flex items-center gap-1 mt-0.5 truncate">
                                                                <MapPin size={10}/> <span className="truncate">{ev.location}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )
                                })
                            })()}
                        </div>}
                    </div>
                </div>
            </div>
        )}
    </div>
  )
}