'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { format, parseISO, addDays, isSameDay, differenceInSeconds } from 'date-fns'
import { vi } from 'date-fns/locale'
import { Clock, MapPin, Calendar, Sun, CloudRain, X, Loader2, User } from 'lucide-react'

// --- TYPES ---
type Schedule = {
  id: number; date: string; start_time: string; title: string; priest_name: string; note: string; location: string; video_url?: string;
}

export default function CinematicHome() {
  const [schedules, setSchedules] = useState<Schedule[]>([]) 
  const [weekSchedules, setWeekSchedules] = useState<Schedule[]>([]) 
  const [nextDaySchedule, setNextDaySchedule] = useState<Schedule | null>(null)
  const [now, setNow] = useState(new Date())
  const [weather, setWeather] = useState({ temp: 28, code: 0, desc: 'Đang tải...' })
  const [marqueeList, setMarqueeList] = useState<string[]>([]) 

  // --- HỆ THỐNG PHÒNG THỦ IOS HARDCORE ---
  const [refreshKey, setRefreshKey] = useState(0)
  const lastActiveTime = useRef(Date.now())

  // Modal State
  const [showWeekModal, setShowWeekModal] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [loadingWeek, setLoadingWeek] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const MASS_DURATION_MINUTES = 30; 
  const COUNTDOWN_THRESHOLD_MINUTES = 15; 

  // 1. Máy phát điện: CHỈ kích hoạt cho iPhone/iPad để ép vẽ lại trang mỗi phút
  useEffect(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isIOS) {
      const keepAlive = setInterval(() => {
        setRefreshKey(prev => prev + 1);
      }, 60000); 
      return () => clearInterval(keepAlive);
    }
  }, []);

  // 2. Tự động F5 nếu vắng mặt quá 2 tiếng & Reset Animation khi quay lại
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const hoursPassed = (Date.now() - lastActiveTime.current) / (1000 * 60 * 60);
        if (hoursPassed > 2) {
          window.location.reload();
          return;
        }
        fetchSchedules();
        fetchAnnouncements();
        setRefreshKey(Date.now()); // Ép vẽ lại ngay lập tức
        lastActiveTime.current = Date.now();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // --- CÁC LOGIC XỬ LÝ DỮ LIỆU ---
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

  const fetchSchedules = async () => {
    const todayStr = format(new Date(), 'yyyy-MM-dd')
    const tomorrowStr = format(addDays(new Date(), 1), 'yyyy-MM-dd')
    const { data: todayData } = await supabase.from('schedules').select('*').eq('date', todayStr).order('start_time')
    if (todayData) setSchedules(todayData)
    const { data: tomorrowData } = await supabase.from('schedules').select('*').eq('date', tomorrowStr).order('start_time').limit(1).single()
    if (tomorrowData) setNextDaySchedule(tomorrowData)
  }

  const fetchAnnouncements = async () => {
      const { data } = await supabase.from('announcements').select('content').eq('is_active', true).order('id');
      if (data && data.length > 0) setMarqueeList(data.map(item => item.content));
      else setMarqueeList([]);
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
    fetchSchedules(); fetchAnnouncements();
    const ch = supabase.channel('home')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'schedules' }, () => { fetchSchedules(); if(showWeekModal) fetchWeekSchedules(); })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, () => { fetchAnnouncements(); })
    .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  useEffect(() => {
      if(showWeekModal) { fetchWeekSchedules(); setModalVisible(true); }
      else { setTimeout(() => setModalVisible(false), 300); }
  }, [showWeekModal])

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
  }, [weather.code, refreshKey])

  const getStatus = () => {
    const timeStr = format(now, 'HH:mm:ss');
    const current = schedules.find(s => {
        const [h, m] = s.start_time.split(':').map(Number);
        const endDate = new Date(now);
        endDate.setHours(h, m + MASS_DURATION_MINUTES, 0, 0);
        return timeStr >= s.start_time && timeStr < format(endDate, 'HH:mm:ss');
    });
    if(current) return { type: 'happening', item: current };
    const next = schedules.find(s => s.start_time > timeStr);
    if(next) {
        const target = new Date(now); const [h, m] = next.start_time.split(':').map(Number);
        target.setHours(h, m, 0, 0);
        const diffMinutes = (target.getTime() - now.getTime()) / 60000;
        if (diffMinutes <= COUNTDOWN_THRESHOLD_MINUTES) {
            const diffSec = differenceInSeconds(target, now);
            const mm = Math.floor(diffSec / 60).toString().padStart(2, '0');
            const ss = (diffSec % 60).toString().padStart(2, '0');
            return { type: 'countdown', item: next, diffString: `${mm}:${ss}` };
        }
        return { type: 'upcoming', item: next, isTomorrow: false };
    }
    if (nextDaySchedule) return { type: 'upcoming', item: nextDaySchedule, isTomorrow: true };
    return { type: 'finished' };
  }
  
  const status = getStatus();

  const getBgFilter = () => {
      if (weather.code >= 51) return 'none'; 
      if (weather.code <= 3) return 'brightness(1.05) saturate(1.1)'; 
      return 'brightness(1.1) saturate(1.2)'; 
  }

  // STYLES
  const glassStyle = "bg-black/40 backdrop-blur-md border border-white/10 overflow-hidden";
  const cardStyle = `${glassStyle} rounded-2xl sm:rounded-3xl shadow-xl p-5 sm:p-8 animate-fade-in w-full max-w-xl mx-auto lg:mx-0`;
  const widgetStyle = `${glassStyle} rounded-2xl shadow-xl px-4 py-2 sm:px-5 sm:py-3 flex items-center gap-2 sm:gap-3 flex-1 justify-center`;

  return (
    // THẦN CHÚ CHỐNG BUG: Dùng refreshKey để ép React remount toàn bộ trang trên iOS
    <div key={refreshKey} className="relative h-[100dvh] bg-slate-900 font-sans text-slate-100 overflow-hidden flex flex-col isolate">
        
        {/* BACKGROUND */}
        <div className="absolute inset-0 bg-basilica bg-cover bg-center animate-ken-burns z-0 transition-all duration-1000" style={{ filter: getBgFilter() }}></div>
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

        {/* MARQUEE - UPDATE: Cỡ chữ LG chuẩn xác cho Mobile */}
        {marqueeList.length > 0 && (
            <div className="sticky top-0 z-[60] w-full bg-black/40 backdrop-blur-md border-b border-white/10 shadow-lg pt-[env(safe-area-inset-top)] isolate">
                 <div className="relative w-full overflow-hidden flex items-center py-3 sm:py-2 px-4">
                     <div className="w-full flex select-none text-white font-medium text-lg sm:text-base leading-snug">
                        <div className="marquee-track flex items-center gap-12 sm:gap-16 shrink-0 min-w-full justify-around pr-12 sm:pr-16 animate-marquee">
                            {marqueeList.map((text, i) => ( <span key={`t1-${i}`} className="tracking-wide block">{text}</span> ))}
                        </div>
                        <div className="marquee-track flex items-center gap-12 sm:gap-16 shrink-0 min-w-full justify-around pr-12 sm:pr-16 animate-marquee" aria-hidden="true">
                            {marqueeList.map((text, i) => ( <span key={`t2-${i}`} className="tracking-wide block">{text}</span> ))}
                        </div>
                    </div>
                 </div>
            </div>
        )}

        {/* MAIN CONTAINER */}
        <div className="flex-grow overflow-y-auto z-10 custom-scrollbar relative w-full p-3 sm:p-4 lg:p-8">
            <div className="max-w-[1800px] mx-auto min-h-full flex flex-col lg:grid lg:grid-cols-12 gap-4 lg:gap-8 pb-20 lg:pb-0">
                <div className="lg:hidden w-full h-[45vh] shrink-0 pointer-events-none"></div>

                {/* LEFT COLUMN */}
                <div className="lg:col-span-7 h-auto lg:h-full relative flex flex-col justify-end transition-all duration-500 order-1 lg:pl-4 lg:pb-12">
                     <div className="h-full flex flex-col justify-end items-start gap-2">
                        {status.type === 'happening' && status.item && (
                            <div className={`${cardStyle} border-red-500/30`}>
                                <div className="flex items-center gap-2 mb-2"><span className="relative flex h-3 w-3"><span className="animate-ping absolute h-full w-full rounded-full bg-red-500 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-red-600"></span></span><span className="text-red-400 text-xs font-bold uppercase tracking-widest">Đang diễn ra</span></div>
                                <h1 className="font-serif font-bold text-3xl sm:text-4xl lg:text-5xl text-white mb-2 text-shadow">{status.item.title}</h1>
                                <div className="inline-flex items-center gap-1.5 text-white/80 font-medium mb-3 bg-black/20 px-3 py-1 rounded-lg border border-white/5 backdrop-blur-sm"><MapPin size={14} className="text-gold"/><span>{status.item.location}</span></div>
                                <div className="flex items-center gap-2 text-white/80 font-serif italic text-lg border-b border-white/10 pb-3 mb-0"><User size={18}/> <span className="truncate">Chủ tế: {status.item.priest_name}</span></div>
                                <div className="mt-4 flex items-center gap-3 text-red-400 font-bold uppercase animate-pulse">Thánh lễ đang cử hành</div>
                            </div>
                        )}
                        {status.type === 'countdown' && status.item && (
                            <div className={`${cardStyle} border-gold/30`}>
                                <div className="bg-gold text-marian-dark font-bold text-xs px-3 py-1 rounded inline-block mb-3 uppercase shadow-lg">Sắp diễn ra</div>
                                <h1 className="font-serif font-bold text-3xl sm:text-4xl lg:text-5xl text-white mb-3 text-shadow leading-tight">{status.item.title}</h1>
                                <div className="flex items-center gap-2 mb-4 text-white/90"><MapPin size={14} className="text-gold"/><span className="text-xs sm:text-sm font-bold uppercase tracking-widest">{status.item.location}</span></div>
                                <div className="bg-black/30 rounded-xl p-4 border border-white/10 mb-1 w-full text-center lg:text-left"><div className="text-[10px] text-white/60 uppercase mb-1 font-bold">Thời gian còn lại</div><div className="font-mono text-4xl sm:text-5xl lg:text-6xl font-bold text-white tabular-nums drop-shadow-2xl tracking-tighter">{status.diffString}</div></div>
                            </div>
                        )}
                        {status.type === 'upcoming' && status.item && (
                            <div className={cardStyle}>
                                <div className="flex items-center gap-2 mb-3"><div className={`w-2 h-2 rounded-full ${status.isTomorrow ? 'bg-blue-400 shadow-[0_0_10px_#60a5fa]' : 'bg-green-400 shadow-[0_0_10px_#4ade80]'}`}></div><span className="text-xs font-bold uppercase tracking-widest">{status.isTomorrow ? 'Lễ ngày mai' : 'Sẵn sàng'}</span></div>
                                <div className="mb-4"><div className="text-gold-light text-xs uppercase mb-4 font-bold tracking-[0.2em]">Thánh Lễ Kế Tiếp</div><h1 className="font-serif font-bold text-3xl sm:text-4xl lg:text-6xl text-white text-shadow leading-tight">{status.item.title}</h1></div>
                                <div className="flex gap-6 border-t border-white/20 pt-4"><div><div className="text-[10px] text-white/50 uppercase mb-0.5 font-bold">Thời gian</div><div className="text-xl sm:text-2xl font-bold text-white font-mono">{status.item.start_time.slice(0,5)}{status.isTomorrow && <span className="text-xs text-white/50 ml-1 font-sans">(Ngày mai)</span>}</div></div><div className="w-px bg-white/20"></div><div><div className="text-[10px] text-white/50 uppercase mb-0.5 font-bold">Địa điểm</div><div className="text-xl sm:text-2xl font-serif italic text-white">{status.item.location}</div></div></div>
                            </div>
                        )}
                        {status.type === 'finished' && (
                            <div className={cardStyle}><h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-2">Lạy Mẹ La Vang</h1><p className="text-lg text-white/80 italic font-serif">Xin cầu cho chúng con.</p></div>
                        )}
                        <div className="flex gap-3 sm:gap-4 mt-2 w-full max-w-xl mx-auto lg:mx-0">
                            <div className={widgetStyle}>{weather.code >= 51 ? <CloudRain className="text-blue-400 w-8 h-8"/> : <Sun className="text-yellow-400 w-8 h-8"/>}<div><div className="text-xl sm:text-2xl font-bold text-white font-mono">{weather.temp}°C</div><div className="text-[10px] sm:text-xs text-white/70 uppercase font-bold">{weather.desc}</div></div></div>
                            <div className={widgetStyle}><Clock className="text-white/60 w-6 h-6"/><div className="text-2xl sm:text-3xl font-bold font-mono text-white tracking-widest">{format(now, 'HH:mm')}</div></div>
                        </div>
                     </div>
                </div>

                {/* RIGHT COLUMN */}
                <div className="lg:col-span-5 h-auto flex flex-col order-2">
                    <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl sm:rounded-3xl flex flex-col overflow-hidden h-[500px] sm:h-[400px] lg:h-full shadow-2xl isolate">
                        <div className="p-5 sm:p-6 border-b border-white/10 bg-white/5 flex flex-col sm:flex-row justify-between items-center gap-4 flex-none">
                            <h2 className="font-serif text-2xl sm:text-xl font-bold text-white truncate tracking-wide">Thánh Lễ hôm nay</h2>
                            <div className="flex items-center gap-3 w-full sm:w-auto">
                                <button onClick={() => setShowWeekModal(true)} className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-gold/20 hover:bg-gold/40 border border-gold/30 py-2 px-4 rounded-full transition active:scale-95"><Calendar size={16} className="text-gold"/><span className="text-xs font-bold text-gold uppercase tracking-wider">Lịch Tuần</span></button>
                                <span className="flex-1 sm:flex-none text-center text-xs font-bold text-white/80 bg-white/10 py-2 px-4 rounded-full backdrop-blur border border-white/10 font-mono">{format(now, 'dd/MM/yyyy', {locale: vi})}</span>
                            </div>
                        </div>
                        <div className="overflow-y-auto flex-grow p-4 custom-scrollbar">
                            <div className="space-y-4 relative pl-8 before:absolute before:left-[35px] before:top-4 before:bottom-4 before:w-[1px] before:bg-white/20">
                                {schedules.length === 0 ? <p className="text-white/40 text-center italic mt-10">Không có lễ hôm nay.</p> :
                                schedules.map(ev => {
                                    const [h, m] = ev.start_time.split(':').map(Number);
                                    const start = new Date(now).setHours(h, m, 0, 0);
                                    const end = start + (MASS_DURATION_MINUTES * 60000);
                                    const isHappening = now.getTime() >= start && now.getTime() < end;
                                    let rowClass = "flex items-center gap-4 py-6 px-6 rounded-2xl transition-all border border-transparent group ";
                                    if (isHappening) rowClass += "bg-gradient-to-r from-red-600/20 to-transparent border-l-4 border-l-red-500 scale-[1.03] shadow-xl";
                                    else rowClass += (status.item?.id === ev.id ? "bg-white/5 border-l-4 border-l-gold/50" : "hover:bg-white/10");
                                    return (
                                        <div key={ev.id} className={rowClass}>
                                            <div className={`w-16 text-right text-2xl font-mono tracking-tight shrink-0 ${isHappening ? 'text-red-400 font-bold' : 'text-white'}`}>{ev.start_time.slice(0,5)}</div>
                                            <div className="flex-grow min-w-0 pl-2">
                                                <div className={`text-lg sm:text-2xl font-serif mb-1 leading-tight ${isHappening ? 'text-white font-bold' : 'text-white/90'}`}>{ev.title}</div>
                                                <div className="text-xs text-white/70 uppercase font-bold flex items-center gap-1.5"><MapPin size={12} className="text-gold-light shrink-0"/>{ev.location}</div>
                                                <div className="text-xs text-white/60 italic mt-0.5">{ev.priest_name}</div>
                                            </div>
                                            {isHappening && <span className="text-[10px] font-bold bg-red-600 text-white px-2 py-1 rounded shadow animate-pulse shrink-0">LIVE</span>}
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
            <div className={`fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md transition-opacity duration-300 ${modalVisible ? 'opacity-100' : 'opacity-0'} isolate`}>
                <div className={`bg-slate-900/90 backdrop-blur-xl border border-white/20 rounded-3xl w-full max-w-6xl max-h-[90vh] flex flex-col shadow-2xl transition-transform duration-300 ${modalVisible ? 'scale-100' : 'scale-95'}`}>
                    <div className="flex justify-between items-center p-6 border-b border-white/10 bg-white/5 rounded-t-3xl">
                        <div><h2 className="font-serif text-2xl sm:text-3xl font-bold text-white text-shadow">Lịch Thánh Lễ trong 7 ngày tới</h2><p className="text-white/60 text-xs sm:text-sm mt-1">Chi tiết các Thánh Lễ</p></div>
                        <button onClick={() => setShowWeekModal(false)} className="p-2 bg-white/10 rounded-full hover:bg-red-600/80 transition group active:scale-90"><X className="text-white" size={24}/></button>
                    </div>
                    <div className="overflow-y-auto p-6 bg-black/20 custom-scrollbar">
                        {loadingWeek ? <div className="h-40 flex items-center justify-center"><Loader2 className="animate-spin text-gold" size={32}/></div> : 
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            {(() => {
                                const grouped: any = {};
                                for(let i=0; i<7; i++) { const d = format(addDays(new Date(), i), 'yyyy-MM-dd'); grouped[d] = []; }
                                weekSchedules.forEach(s => { if(grouped[s.date]) grouped[s.date].push(s); });
                                return Object.entries(grouped).map(([date, items]: any) => (
                                    <div key={date} className={`rounded-xl border p-4 transition duration-300 ${isSameDay(parseISO(date), now) ? 'border-gold bg-gold/10 ring-1 ring-gold/50 shadow-lg' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}>
                                        <div className="flex justify-between items-center mb-3 border-b border-white/10 pb-2"><span className="font-serif font-bold text-lg text-white capitalize">{format(parseISO(date), 'EEEE', {locale: vi})}</span><span className={`text-[10px] font-bold border border-current px-2 py-0.5 rounded-full font-mono ${isSameDay(parseISO(date), now) ? 'text-gold' : 'text-white/70'}`}>{format(parseISO(date), 'dd/MM')}</span></div>
                                        <div className="space-y-3">{items.length === 0 ? <p className="text-xs text-white/30 italic text-center py-2">- Trống -</p> : items.map((ev: any) => (
                                            <div key={ev.id} className="flex flex-col gap-1 py-1.5 border-b border-white/5 last:border-0 group">
                                                <div className="flex items-start gap-2"><div className="font-mono text-white font-bold bg-white/10 px-1.5 rounded text-xs mt-0.5">{ev.start_time.slice(0,5)}</div><div className="text-sm font-bold text-white leading-snug break-words">{ev.title}</div></div>
                                                <div className="text-[10px] text-white/50 uppercase flex items-start gap-1 ml-10"><MapPin size={10} className="shrink-0 mt-0.5"/><span>{ev.location}</span></div>
                                                {ev.priest_name && <div className="text-[10px] text-white/40 italic flex items-start gap-1 ml-10"><User size={10} className="shrink-0 mt-0.5"/><span>{ev.priest_name}</span></div>}
                                            </div>
                                        ))}</div>
                                    </div>
                                ));
                            })()}
                        </div>}
                    </div>
                </div>
            </div>
        )}
    </div>
  )
}