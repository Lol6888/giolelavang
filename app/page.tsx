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
  
  // State cho thông báo chạy (Marquee)
  const [marqueeList, setMarqueeList] = useState<string[]>([]) 

  // --- PHƯƠNG ÁN VÔ CHIÊU THẮNG HỮU CHIÊU ---
  const [refreshKey, setRefreshKey] = useState(0)
  const lastActiveTime = useRef(Date.now())

  // 1. Máy phát điện
  useEffect(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isIOS) {
      const keepAlive = setInterval(() => {
        setRefreshKey(prev => prev + 1);
      }, 60000); 
      return () => clearInterval(keepAlive);
    }
  }, []);

  // 2. Reload tức thì
  useEffect(() => {
    const handleVisibilityChange = () => {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      if (document.visibilityState === 'visible' && isIOS) {
        window.location.replace(window.location.href); 
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Modal State
  const [showWeekModal, setShowWeekModal] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [loadingWeek, setLoadingWeek] = useState(false)
  
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // --- CONFIG ---
  const MASS_DURATION_MINUTES = 30; 
  const COUNTDOWN_THRESHOLD_MINUTES = 15; 

  // --- LOGIC ---
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t) }, [])

  // Fetch Weather
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

  // Fetch Schedules & Announcements
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
      if (data && data.length > 0) {
          setMarqueeList(data.map(item => item.content));
      } else {
          setMarqueeList([]); 
      }
  }

  const fetchWeekSchedules = async () => {
      setLoadingWeek(true);
      const start = format(new Date(), 'yyyy-MM-dd');
      const end = format(addDays(new Date(), 7), 'yyyy-MM-dd');
      const { data } = await supabase.from('schedules').select('*').gte('date', start).lte('date', end).order('date').order('start_time')
      if(data) setWeekSchedules(data);
      setLoadingWeek(false);
  }

  // Realtime Subscription
  useEffect(() => {
    fetchSchedules()
    fetchAnnouncements() 

    const ch = supabase.channel('home')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'schedules' }, () => {
        fetchSchedules(); if(showWeekModal) fetchWeekSchedules();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, () => {
        fetchAnnouncements(); 
    })
    .subscribe()

    return () => { supabase.removeChannel(ch) }
  }, [])

  // AUTO SCROLL BÊN TRONG BOX DANH SÁCH
  useEffect(() => {
      if (schedules.length === 0) return;
      
      const timeStr = format(now, 'HH:mm:ss');
      
      const targetItem = schedules.find(ev => {
          const [h, m] = ev.start_time.split(':').map(Number);
          const endDate = new Date(now);
          endDate.setHours(h, m + MASS_DURATION_MINUTES, 0, 0);
          const endStr = format(endDate, 'HH:mm:ss');
          return timeStr < endStr; 
      });

      if (targetItem) {
          setTimeout(() => {
              const container = listRef.current;
              const el = document.getElementById(`schedule-row-${targetItem.id}`);
              
              if (container && el) {
                  const containerRect = container.getBoundingClientRect();
                  const elRect = el.getBoundingClientRect();
                  const scrollOffset = elRect.top - containerRect.top - (containerRect.height / 2) + (elRect.height / 2);
                  
                  container.scrollBy({
                      top: scrollOffset,
                      behavior: 'smooth'
                  });
              }
          }, 500);
      }
  }, [schedules]);

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
  }, [weather.code, refreshKey]) 

  // --- HELPER: FORMAT COUNTDOWN (MM:SS) ---
  const getCountdownString = (targetTimeStr: string) => {
      const [h, m] = targetTimeStr.split(':').map(Number);
      const target = new Date(now);
      target.setHours(h, m, 0, 0);
      
      let diffSec = differenceInSeconds(target, now);
      if (diffSec < 0) return "00:00"; 

      const minutes = Math.floor(diffSec / 60);
      const seconds = diffSec % 60;
      const mm = minutes.toString().padStart(2, '0');
      const ss = seconds.toString().padStart(2, '0');

      return `${mm}:${ss}`;
  }

  // --- CORE LOGIC: GOM NHÓM THÁNH LỄ ---
  const getStatus = () => {
    const timeStr = format(now, 'HH:mm:ss');
    
    const currents = schedules.filter(s => {
        const [h, m] = s.start_time.split(':').map(Number);
        const endDate = new Date(now);
        endDate.setHours(h, m + MASS_DURATION_MINUTES, 0, 0);
        const endStr = format(endDate, 'HH:mm:ss');
        return timeStr >= s.start_time && timeStr < endStr;
    });

    if(currents.length > 0) return { type: 'happening', items: currents };

    const nexts = schedules.filter(s => s.start_time > timeStr);
    if(nexts.length > 0) {
        const firstNextTime = nexts[0].start_time;
        const nextItems = nexts.filter(s => s.start_time === firstNextTime);

        const [h, m] = firstNextTime.split(':').map(Number);
        const target = new Date(now);
        target.setHours(h, m, 0, 0);
        const diffMinutes = (target.getTime() - now.getTime()) / 60000;

        if (diffMinutes <= COUNTDOWN_THRESHOLD_MINUTES) {
            return { type: 'countdown', items: nextItems, diffString: getCountdownString(firstNextTime) };
        } else {
            return { type: 'upcoming', items: nextItems, isTomorrow: false };
        }
    }
    
    if (nextDaySchedule) {
        return { type: 'upcoming', items: [nextDaySchedule], isTomorrow: true };
    }

    return { type: 'finished' };
  }
  
  const status = getStatus();

  const getBgFilter = () => {
      if (weather.code >= 51) return 'none'; 
      if (weather.code <= 3) return 'brightness(1.05) saturate(1.1)'; 
      return 'brightness(1.1) saturate(1.2)'; 
  }

  // CSS CLASSES - Chỉnh lại text-left và mx-auto
  const widgetContainerStyle = "flex gap-3 sm:gap-4 mt-2 w-full max-w-xl mx-auto shrink-0"; 
  const widgetStyle = "bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl shadow-xl px-4 py-2 sm:px-5 sm:py-3 flex items-center gap-2 sm:gap-3 flex-1 justify-center";
  const cardStyle = "bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl sm:rounded-3xl shadow-xl p-6 sm:p-8 animate-fade-in w-full max-w-xl mx-auto shrink-0 flex flex-col text-left";
  
  // UI CHUNG CHO CÁC THẺ 
  const tagStyle = "inline-flex items-center gap-1.5 sm:gap-2 bg-white/10 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl border border-white/10 backdrop-blur-md shadow-sm text-white/90 transition-all hover:bg-white/20";

  return (
    <div key={refreshKey} className="relative h-[100dvh] font-sans text-slate-100 overflow-hidden flex flex-col isolate">
        {/* BACKGROUND */}
        <div 
            className="absolute inset-0 bg-basilica bg-cover bg-center animate-ken-burns z-0 transition-all duration-1000"
            style={{ filter: getBgFilter() }}
        ></div>
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

        {/* MARQUEE */}
        {marqueeList.length > 0 && (
            <div className="sticky top-0 z-[60] bg-black/40 backdrop-blur-md text-white font-medium text-lg sm:text-base py-3 sm:py-2 px-4 border-b border-white/10 shrink-0 shadow-lg">
                 <div className="marquee-container w-full flex overflow-hidden select-none">
                    <div 
                        className="marquee-track flex items-center gap-12 sm:gap-16 shrink-0 min-w-full justify-around pr-12 sm:pr-16 animate-marquee will-change-transform"
                        style={{ transform: 'translateZ(0)', WebkitTransform: 'translateZ(0)' }}
                    >
                        {marqueeList.map((text, i) => (
                            <span key={`t1-${i}`} className="tracking-wide">{text}</span>
                        ))}
                    </div>
                    <div 
                        className="marquee-track flex items-center gap-12 sm:gap-16 shrink-0 min-w-full justify-around pr-12 sm:pr-16 animate-marquee will-change-transform" 
                        aria-hidden="true"
                        style={{ transform: 'translateZ(0)', WebkitTransform: 'translateZ(0)' }}
                    >
                        {marqueeList.map((text, i) => (
                            <span key={`t2-${i}`} className="tracking-wide">{text}</span>
                        ))}
                    </div>
                </div>
            </div>
        )}

        {/* MAIN SCROLL CONTAINER */}
        <div className="flex-grow overflow-y-auto z-10 custom-scrollbar relative w-full p-3 sm:p-4 lg:p-8">
            <div className="max-w-6xl mx-auto min-h-full flex flex-col lg:grid lg:grid-cols-12 gap-4 lg:gap-8 pb-20 lg:pb-0 relative justify-center">
                
                {/* SPACER MOBILE */}
                <div className="lg:hidden w-full h-[45vh] shrink-0 pointer-events-none"></div>

                {/* LEFT COLUMN - Sticky Scroll */}
                <div className="lg:col-span-7 h-auto lg:h-[calc(100dvh-6rem)] lg:sticky lg:top-4 relative flex flex-col justify-end transition-all duration-500 order-1 self-start z-20 w-full">
                     <div className="h-full flex flex-col justify-end items-center lg:items-end gap-3 w-full">
                        
                        {/* 1. HAPPENING */}
                        {status.type === 'happening' && status.items && (
                            <div className={`${cardStyle} border-red-500/30`}>
                                <div className="flex items-center gap-2 sm:gap-3 mb-5 w-full">
                                    <span className="relative flex h-3 w-3 sm:h-4 sm:w-4">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-full w-full bg-red-600"></span>
                                    </span>
                                    <span className="text-red-400 text-xs sm:text-sm font-bold uppercase tracking-widest">Đang diễn ra</span>
                                </div>
                                
                                <div className="flex flex-col gap-6 sm:gap-8 w-full">
                                    {status.items.map((item, idx) => (
                                        <div key={item.id} className={`flex flex-col w-full ${idx > 0 ? "pt-6 sm:pt-8 border-t border-white/10" : ""}`}>
                                            {/* SỬA 1: leading-snug thay vì leading-tight */}
                                            <h1 className={`font-serif font-bold ${status.items.length > 1 ? 'text-3xl sm:text-4xl lg:text-5xl' : 'text-4xl sm:text-5xl lg:text-6xl'} leading-snug text-white mb-4 sm:mb-5 text-shadow`}>
                                                {item.title}
                                            </h1>
                                            <div className="flex flex-wrap items-center gap-3 sm:gap-4 w-full">
                                                <div className={`${tagStyle} font-mono`}>
                                                    <Clock size={16} className="text-gold"/>
                                                    <span className="text-sm sm:text-base font-bold">{item.start_time.slice(0,5)}</span>
                                                </div>
                                                <div className={`${tagStyle}`}>
                                                    <MapPin size={16} className="text-gold"/>
                                                    <span className="text-sm sm:text-base font-bold uppercase tracking-widest">{item.location}</span>
                                                </div>
                                                {item.priest_name && (
                                                    <div className={`${tagStyle} font-serif italic`}>
                                                        <User size={16} className="text-gold"/>
                                                        <span className="text-sm sm:text-base truncate">Chủ tế: {item.priest_name}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="mt-8 flex items-center gap-3 text-red-400 font-bold uppercase tracking-widest animate-pulse text-xs sm:text-sm w-full border-t border-white/10 pt-5">
                                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                                    Thánh lễ đang cử hành
                                </div>
                            </div>
                        )}

                        {/* 2. COUNTDOWN */}
                        {status.type === 'countdown' && status.items && (
                            <div className={`${cardStyle} border-gold/30`}>
                                <div className="bg-gold text-marian-dark font-bold text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg inline-flex mb-5 uppercase tracking-widest shadow-lg self-start">Sắp diễn ra</div>
                                
                                <div className="flex flex-col gap-5 sm:gap-6 mb-6 sm:mb-8 w-full">
                                    {status.items.map((item, idx) => (
                                        <div key={item.id} className={`flex flex-col w-full ${idx > 0 ? "pt-5 sm:pt-6 border-t border-white/10" : ""}`}>
                                            {/* SỬA 1: leading-snug */}
                                            <h1 className={`font-serif font-bold ${status.items.length > 1 ? 'text-3xl sm:text-4xl lg:text-5xl' : 'text-4xl sm:text-5xl lg:text-6xl'} text-white mb-4 sm:mb-5 text-shadow leading-snug`}>
                                                {item.title}
                                            </h1>
                                            <div className="flex flex-wrap items-center gap-3 sm:gap-4 w-full">
                                                <div className={`${tagStyle} font-mono`}>
                                                    <Clock size={16} className="text-gold"/>
                                                    <span className="text-sm sm:text-base font-bold">{item.start_time.slice(0,5)}</span>
                                                </div>
                                                <div className={`${tagStyle}`}>
                                                    <MapPin size={16} className="text-gold"/>
                                                    <span className="text-sm sm:text-base font-bold uppercase tracking-widest">{item.location}</span>
                                                </div>
                                                {item.priest_name && (
                                                    <div className={`${tagStyle} font-serif italic`}>
                                                        <User size={16} className="text-gold"/>
                                                        <span className="text-sm sm:text-base truncate">Chủ tế: {item.priest_name}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="bg-black/30 rounded-2xl p-4 sm:p-5 border border-white/10 inline-block w-full">
                                    <div className="text-xs sm:text-sm text-white/70 uppercase tracking-widest mb-2 font-bold">Sẽ bắt đầu sau</div>
                                    <div className="font-mono text-5xl sm:text-6xl lg:text-7xl font-bold text-white tabular-nums drop-shadow-2xl tracking-tighter">
                                        {status.diffString}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 3. UPCOMING */}
                        {status.type === 'upcoming' && status.items && (
                            <div className={cardStyle}>
                                <div className="flex items-center gap-2 sm:gap-3 mb-5 w-full">
                                    <div className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full ${status.isTomorrow ? 'bg-blue-400 shadow-[0_0_10px_#60a5fa]' : 'bg-green-400 shadow-[0_0_10px_#4ade80]'}`}></div>
                                    <span className={`text-xs sm:text-sm font-bold uppercase tracking-widest ${status.isTomorrow ? 'text-blue-300' : 'text-green-300'}`}>
                                        {status.isTomorrow ? 'Lễ ngày mai' : 'Sẵn sàng'}
                                    </span>
                                </div>
                                
                                <div className="text-gold-light text-sm sm:text-base uppercase tracking-[0.2em] mb-5 sm:mb-6 font-bold w-full">Thánh Lễ Kế Tiếp</div>

                                <div className="flex flex-col gap-5 sm:gap-6 w-full">
                                    {status.items.map((item, idx) => (
                                        <div key={item.id} className={`flex flex-col w-full ${idx > 0 ? "pt-5 sm:pt-6 border-t border-white/10" : ""}`}>
                                            {/* SỬA 1: leading-snug */}
                                            <h1 className={`font-serif font-bold ${status.items.length > 1 ? 'text-3xl sm:text-4xl lg:text-5xl' : 'text-4xl sm:text-5xl lg:text-6xl'} text-white text-shadow leading-snug mb-4 sm:mb-5`}>
                                                {item.title}
                                            </h1>
                                            <div className="flex flex-wrap items-center gap-3 sm:gap-4 w-full">
                                                <div className={`${tagStyle} font-mono`}>
                                                    <Clock size={16} className="text-gold"/>
                                                    <span className="text-sm sm:text-base font-bold">
                                                        {item.start_time.slice(0,5)}
                                                        {status.isTomorrow && <span className="text-xs sm:text-sm text-white/60 ml-1.5 font-sans font-medium">(Ngày mai)</span>}
                                                    </span>
                                                </div>
                                                <div className={`${tagStyle}`}>
                                                    <MapPin size={16} className="text-gold"/>
                                                    <span className="text-sm sm:text-base font-bold uppercase tracking-widest">{item.location}</span>
                                                </div>
                                                {item.priest_name && (
                                                    <div className={`${tagStyle} font-serif italic`}>
                                                        <User size={16} className="text-gold"/>
                                                        <span className="text-sm sm:text-base truncate">Chủ tế: {item.priest_name}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 4. FINISHED */}
                        {status.type === 'finished' && (
                            <div className={cardStyle}>
                                <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-4 text-shadow w-full">Lạy Mẹ La Vang</h1>
                                <p className="text-lg sm:text-xl text-white/80 italic font-serif w-full">Xin cầu cho chúng con.</p>
                            </div>
                        )}

                        {/* WIDGETS */}
                        <div className={widgetContainerStyle}>
                            <div className={widgetStyle}>
                                {weather.code >= 51 ? <CloudRain className="text-blue-400 w-6 h-6 sm:w-8 sm:h-8"/> : <Sun className="text-yellow-400 w-6 h-6 sm:w-8 sm:h-8"/>}
                                <div><div className="text-xl sm:text-2xl font-bold text-white font-mono">{weather.temp}°C</div><div className="text-[10px] sm:text-xs text-white/70 uppercase font-bold">{weather.desc}</div></div>
                            </div>
                            <div className={widgetStyle}>
                                <Clock className="text-white/60 w-5 h-5 sm:w-6 sm:h-6"/>
                                <div className="text-2xl sm:text-3xl font-bold font-mono text-white tracking-widest">{format(now, 'HH:mm')}</div>
                            </div>
                        </div>
                     </div>
                </div>

                {/* --- BẢNG BÊN PHẢI --- */}
                <div className="lg:col-span-5 h-auto lg:h-[calc(100dvh-6rem)] lg:sticky lg:top-4 relative flex flex-col order-2 self-start z-20 w-full">
                    <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl sm:rounded-3xl flex flex-col overflow-hidden h-[500px] sm:h-[400px] lg:h-full shadow-2xl">
                        <div className="p-5 sm:p-6 border-b border-white/10 bg-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0 flex-none">
                            <h2 className="font-serif text-2xl sm:text-xl font-bold text-white tracking-wide truncate">Thánh Lễ hôm nay</h2>
                            <div className="flex items-center gap-3 w-full sm:w-auto">
                                <button onClick={() => setShowWeekModal(true)} className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-gold/20 hover:bg-gold/40 border border-gold/30 py-3 sm:py-1.5 px-4 sm:px-3 rounded-full transition group cursor-pointer active:scale-95">
                                    <Calendar size={16} className="text-gold sm:w-3.5 sm:h-3.5"/>
                                    <span className="text-sm sm:text-xs font-bold text-gold uppercase tracking-wider">Lịch Tuần</span>
                                </button>
                                <span className="flex-1 sm:flex-none text-center text-sm sm:text-xs font-bold text-white/80 bg-white/10 py-3 sm:py-1.5 px-4 sm:px-3 rounded-full backdrop-blur border border-white/10 font-mono">
                                    {format(now, 'dd/MM/yyyy', {locale: vi})}
                                </span>
                            </div>
                        </div>

                        {/* Vùng scroll */}
                        <div ref={listRef} className="overflow-y-auto flex-grow p-3 sm:p-4 custom-scrollbar scroll-smooth">
                            <div className="space-y-3 sm:space-y-6 relative pl-6 sm:pl-8 before:absolute before:left-[27px] sm:before:left-[35px] before:top-4 before:bottom-4 before:w-[1px] before:bg-white/20">
    {schedules.length === 0 ? <p className="text-white/40 text-center italic mt-10 text-base">Không có lễ hôm nay.</p> :
    schedules.map(ev => {
        const timeStr = format(now, 'HH:mm:ss');
        const [h, m] = ev.start_time.split(':').map(Number);
        
        const endDate = new Date(now);
        endDate.setHours(h, m + MASS_DURATION_MINUTES, 0, 0);
        const endStr = format(endDate, 'HH:mm:ss');

        const isHappening = timeStr >= ev.start_time && timeStr < endStr;
        const isUpcoming = timeStr < ev.start_time;

        // SỬA 2: Thêm class relative để absolute badge chuẩn góc
        let rowClass = "flex items-center gap-3 sm:gap-6 py-5 px-4 sm:py-6 sm:px-6 rounded-2xl transition-all border border-transparent group relative ";
        
        if (isHappening) {
            rowClass += "bg-gradient-to-r from-red-600/20 to-transparent border-l-4 border-l-red-500 shadow-xl transform scale-[1.03]";
        } else if (isUpcoming) {
            if (status.type !== 'finished' && status.items?.some(i => i.id === ev.id)) {
                 rowClass += "bg-white/5 border-l-4 border-l-gold/50";
            } else {
                 rowClass += "hover:bg-white/10";
            }
        } else {
            rowClass += "opacity-40 grayscale hover:opacity-100 hover:grayscale-0";
        }

        return (
            <div key={ev.id} id={`schedule-row-${ev.id}`} className={rowClass}>
                <div className={`w-16 sm:w-24 text-right text-2xl sm:text-4xl text-shadow-light font-mono tracking-tight shrink-0
                    ${isHappening ? 'text-red-400 font-bold' : (isUpcoming ? 'text-gold font-bold' : 'text-white')}`}>
                    {ev.start_time.slice(0,5)}
                </div>

                <div className="flex-grow min-w-0 pl-2 sm:pl-2 pr-6 sm:pr-10">
                    {/* SỬA 1: leading-snug cho title */}
                    <div className={`text-lg sm:text-2xl text-shadow-light font-serif leading-snug mb-1
                        ${isHappening ? 'text-white font-bold' : (isUpcoming ? 'text-gold-light font-bold' : 'text-white/90')}`}>
                        {ev.title}
                    </div>
                    <div className="flex items-start gap-1.5 text-xs sm:text-base text-white/70 uppercase font-bold tracking-wider">
                        <MapPin size={12} className="shrink-0 mt-0.5 sm:mt-1"/>
                        <span className="leading-snug">{ev.location}</span>
                    </div>
                    <div className="text-xs sm:text-sm text-white/60 italic mt-0.5">{ev.priest_name}</div>
                </div>

                {/* SỬA 2: Đưa tag Sắp diễn ra / LIVE lên góc trên bên phải bằng absolute */}
                {isHappening && <span className="absolute top-3 right-3 sm:top-4 sm:right-5 text-[9px] sm:text-[10px] font-bold bg-red-600 text-white px-2 py-0.5 rounded shadow animate-pulse">LIVE</span>}
                {isUpcoming && status.items?.some(i => i.id === ev.id) && <span className="absolute top-3 right-3 sm:top-4 sm:right-5 text-[9px] sm:text-[10px] font-bold bg-gold/20 text-gold border border-gold/30 px-2 py-0.5 rounded">SẮP TỚI</span>}
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
                <div className={`bg-slate-900/90 backdrop-blur-xl border border-white/20 rounded-2xl sm:rounded-3xl w-[95%] sm:w-full max-w-6xl max-h-[85vh] sm:max-h-[90vh] flex flex-col shadow-2xl transition-transform duration-300 ${modalVisible ? 'scale-100' : 'scale-95'}`}>
                    <div className="flex justify-between items-center p-4 sm:p-6 border-b border-white/10 bg-white/5 rounded-t-2xl sm:rounded-t-3xl">
                        <div>
                            <h2 className="font-serif text-xl sm:text-3xl font-bold text-white text-shadow">Lịch Thánh Lễ trong 7 ngày tới</h2>
                            <p className="text-white/60 text-xs sm:text-sm mt-1">Chi tiết các Thánh Lễ</p>
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
                                                <span className={`text-[10px] sm:text-xs font-bold border border-current px-2 py-0.5 rounded-full font-mono ${isTodayDate ? 'text-gold' : 'text-white/70'}`}>{format(parseISO(date), 'dd/MM')}</span>
                                            </div>
                                            <div className="space-y-2 sm:space-y-2">
                                                {items.length === 0 ? <p className="text-[10px] text-white/30 italic py-2 text-center">- Trống -</p> : 
                                                items.map((ev: any) => (
                                                    <div key={ev.id} className="flex items-start gap-2 sm:gap-3 py-2 border-b border-white/5 last:border-0 group">
                                                        <div className="font-mono text-white font-bold bg-white/10 px-1.5 rounded text-xs sm:text-sm whitespace-nowrap mt-0.5">{ev.start_time.slice(0,5)}</div>
                                                        <div className="flex-grow min-w-0">
                                                            <div className="text-xs sm:text-sm font-bold text-white leading-tight break-words whitespace-normal">{ev.title}</div>
                                                            <div className="text-[10px] sm:text-[11px] text-white/50 uppercase flex items-start gap-1 mt-1">
                                                                <MapPin size={10} className="shrink-0 mt-0.5"/> 
                                                                <span className="break-words whitespace-normal">{ev.location}</span>
                                                            </div>
                                                            {ev.priest_name && (
                                                                <div className="text-[10px] sm:text-[11px] text-white/40 italic mt-0.5 break-words whitespace-normal flex items-start gap-1">
                                                                    <User size={10} className="shrink-0 mt-0.5"/> 
                                                                    <span>{ev.priest_name}</span>
                                                                </div>
                                                            )}
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