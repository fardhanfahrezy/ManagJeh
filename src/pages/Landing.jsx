import { Link } from 'react-router-dom';
import { ArrowRight,LayoutGrid, CheckCircle2, Sparkles, Activity, Wallet, WifiOff, Users, ShieldCheck, Lock, Zap, Server, Gauge, Database, CreditCard, PieChart, AlertCircle, BarChart3, TrendingUp } from 'lucide-react';

export default function Landing() {
  return (
    <div className="min-h-screen bg-[#FDFDFD] font-sans selection:bg-blue-100 text-slate-900 overflow-x-hidden">
      
      {/* ========================================================= 
          1. NAVIGATION BAR 
          ========================================================= */}
      <nav className="fixed top-0 inset-x-0 bg-white/80 backdrop-blur-md border-b border-slate-100 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center outline-none focus:ring-2 focus:ring-blue-200 rounded-lg">
  {/* Sesuaikan ekstensi .svg atau .png sesuai dengan format file asli Anda */}
  <img 
    src="/logo.svg" 
    alt="ManagJeh Logo" 
    className="h-7 md:h-8 w-auto object-contain"
    loading="eager"
  />
</Link>
          <div className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-600">
            <a href="#cara-kerja" className="hover:text-blue-600 transition-colors">Cara Kerja</a>
            <a href="#infrastruktur" className="hover:text-blue-600 transition-colors">Infrastruktur</a>
            <a href="#kecepatan" className="hover:text-blue-600 transition-colors">Performa</a>
            <a href="#keamanan" className="hover:text-blue-600 transition-colors">Keamanan</a>
            <a href="#gratis" className="text-emerald-600 hover:text-emerald-700 font-bold transition-colors">100% Gratis</a>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/login" className="text-sm font-bold text-slate-700 hover:text-blue-600 transition-colors hidden sm:block outline-none">
              Masuk
            </Link>
            <Link to="/login" className="bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold px-5 py-2.5 rounded-full transition-all outline-none focus:ring-4 focus:ring-slate-200">
              Buat Akun
            </Link>
          </div>
        </div>
      </nav>

      <main className="pt-28 pb-20">
        
        {/* ========================================================= 
            2. HERO SECTION 
            ========================================================= */}
        <section className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center mb-32 mt-10">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 text-blue-600 font-bold text-xs uppercase tracking-wider mb-6 border border-blue-100">
              <Sparkles size={14} /> Bebas Biaya. Bebas Iklan.
            </div>
            <h1 className="text-5xl lg:text-7xl font-black tracking-tighter leading-[1.1] mb-6">
              Kendalikan <span className="text-blue-600">finansial</span> Anda dalam hitungan detik.
            </h1>
            <p className="text-lg text-slate-500 font-medium mb-8 leading-relaxed max-w-lg">
              Catat transaksi offline, pantau dompet bersama secara realtime, dan biarkan AI memprediksi kesehatan arus kas Anda secara gratis.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <Link to="/login" className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3.5 rounded-full flex items-center gap-2 transition-all shadow-lg shadow-blue-600/20 outline-none focus:ring-4 focus:ring-blue-200">
                Mulai Sekarang <ArrowRight size={18} />
              </Link>
            </div>
          </div>

          <div className="relative w-full h-[400px] lg:h-[500px] perspective-1000">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-gradient-to-tr from-blue-50 to-indigo-50 rounded-full blur-3xl -z-10"></div>
            
            <div className="absolute top-10 right-0 w-[85%] bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 transform -rotate-2 hover:rotate-0 transition-transform duration-500 z-10">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <div className="h-3 w-24 bg-slate-100 rounded-full mb-2"></div>
                  <div className="h-8 w-40 bg-slate-800 rounded-lg"></div>
                </div>
                <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600"><Wallet size={20} /></div>
              </div>
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100">
                    <div className="flex gap-3 items-center">
                      <div className="h-10 w-10 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-center">
                        <Activity size={18} className="text-slate-400"/>
                      </div>
                      <div className="space-y-1.5">
                        <div className="h-3 w-20 bg-slate-200 rounded-full"></div>
                        <div className="h-2 w-12 bg-slate-200 rounded-full"></div>
                      </div>
                    </div>
                    <div className="h-4 w-16 bg-slate-800 rounded-md opacity-20"></div>
                  </div>
                ))}
              </div>
            </div>

            <div className="absolute bottom-10 left-0 w-[45%] bg-slate-900 text-white rounded-2xl shadow-2xl p-5 transform rotate-3 hover:rotate-0 transition-transform duration-500 z-20">
              <div className="flex gap-2 items-center mb-3 text-xs font-bold text-emerald-400">
                <Sparkles size={14}/> AI Insight
              </div>
              <p className="text-sm font-semibold leading-snug">Pengeluaran bulan ini diproyeksikan aman.</p>
            </div>
          </div>
        </section>

        {/* ========================================================= 
            3. CARA KERJA (VISUAL SHOWCASE 2x2) - ADAPTASI DESAIN BARU
            ========================================================= */}
        <section id="cara-kerja" className="py-24 bg-white border-y border-slate-100">
          <div className="max-w-7xl mx-auto px-6">
            
            <div className="flex flex-col md:flex-row md:justify-between md:items-end mb-16 gap-6">
              <div>
                <p className="text-blue-600 font-bold text-sm tracking-wider uppercase mb-3 flex items-center gap-2"><LayoutGrid size={16}/> Cara Kerja</p>
                <h2 className="text-3xl lg:text-4xl font-black tracking-tight text-slate-900 leading-tight">Alur sederhana menuju<br/>kendali finansial.</h2>
              </div>
              <p className="text-slate-500 font-medium max-w-md md:text-right">
                Visualisasikan arus uang Anda, buat keputusan yang lebih cerdas, dan bangun kebiasaan finansial yang bertahan lama tanpa kerumitan.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              
              {/* Card 1: Hubungkan Akun */}
              <div className="bg-white rounded-[2rem] p-6 lg:p-8 border border-slate-200 shadow-sm hover:shadow-md transition-shadow group">
                <div className="bg-slate-50 rounded-2xl h-56 mb-8 p-6 flex flex-col justify-center relative overflow-hidden border border-slate-100">
                   <div className="w-full max-w-[240px] mx-auto space-y-3 relative z-10 transform group-hover:scale-105 transition-transform duration-500">
                      <div className="bg-white p-3.5 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4">
                         <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center"><Wallet size={16}/></div>
                         <div className="h-3 w-24 bg-slate-200 rounded-full"></div>
                      </div>
                      <div className="bg-white p-3.5 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4 ml-4">
                         <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center"><CreditCard size={16}/></div>
                         <div className="h-3 w-20 bg-slate-200 rounded-full"></div>
                      </div>
                      <div className="bg-white p-3.5 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4">
                         <div className="w-8 h-8 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center"><CreditCard size={16}/></div>
                         <div className="h-3 w-28 bg-slate-200 rounded-full"></div>
                      </div>
                   </div>
                </div>
                <h3 className="text-xl font-bold mb-3">Integrasi Berbagai Dompet</h3>
                <p className="text-sm font-medium text-slate-500 leading-relaxed">
                  Kelola uang tunai, rekening bank, hingga e-wallet secara terpisah. Pantau total kekayaan bersih Anda dari satu dasbor terpusat.
                </p>
              </div>

              {/* Card 2: Pantau Pengeluaran */}
              <div className="bg-white rounded-[2rem] p-6 lg:p-8 border border-slate-200 shadow-sm hover:shadow-md transition-shadow group">
                <div className="bg-slate-50 rounded-2xl h-56 mb-8 p-6 flex items-center justify-center relative overflow-hidden border border-slate-100">
                   <div className="relative z-10 transform group-hover:scale-105 transition-transform duration-500 flex flex-col items-center">
                      {/* Abstract Donut Chart (CSS) */}
                      <div className="w-28 h-28 rounded-full relative flex items-center justify-center mb-6 shadow-sm" style={{ background: 'conic-gradient(#3b82f6 0% 45%, #10b981 45% 75%, #f43f5e 75% 100%)' }}>
                        <div className="w-20 h-20 bg-slate-50 rounded-full flex flex-col items-center justify-center">
                           <span className="text-xs font-bold text-slate-800">Bulan ini</span>
                        </div>
                      </div>
                      {/* Icons */}
                      <div className="flex gap-4">
                         <div className="w-10 h-10 rounded-full bg-white shadow-sm border border-slate-100 flex items-center justify-center text-blue-500"><PieChart size={18}/></div>
                         <div className="w-10 h-10 rounded-full bg-white shadow-sm border border-slate-100 flex items-center justify-center text-emerald-500"><TrendingUp size={18}/></div>
                      </div>
                   </div>
                </div>
                <h3 className="text-xl font-bold mb-3">Lacak Arus Pengeluaran</h3>
                <p className="text-sm font-medium text-slate-500 leading-relaxed">
                  Kategorikan setiap transaksi secara otomatis. Pahami dengan pasti ke mana uang Anda pergi setiap bulannya tanpa perhitungan manual.
                </p>
              </div>

              {/* Card 3: Wawasan Cerdas */}
              <div className="bg-white rounded-[2rem] p-6 lg:p-8 border border-slate-200 shadow-sm hover:shadow-md transition-shadow group">
                <div className="bg-slate-50 rounded-2xl h-56 mb-8 p-6 flex flex-col justify-center relative overflow-hidden border border-slate-100">
                   <div className="w-full max-w-[260px] mx-auto space-y-3 relative z-10 transform group-hover:scale-105 transition-transform duration-500">
                      <div className="bg-white p-4 rounded-2xl shadow-sm border border-red-100 flex items-start gap-3">
                         <div className="bg-red-50 text-red-500 p-1.5 rounded-lg shrink-0"><AlertCircle size={16}/></div>
                         <div className="space-y-1.5 w-full mt-1">
                           <div className="h-2 w-full bg-slate-200 rounded-full"></div>
                           <div className="h-2 w-3/4 bg-slate-200 rounded-full"></div>
                         </div>
                      </div>
                      <div className="bg-white p-4 rounded-2xl shadow-sm border border-emerald-100 flex items-start gap-3">
                         <div className="bg-emerald-50 text-emerald-500 p-1.5 rounded-lg shrink-0"><CheckCircle2 size={16}/></div>
                         <div className="space-y-1.5 w-full mt-1">
                           <div className="h-2 w-11/12 bg-slate-200 rounded-full"></div>
                           <div className="h-2 w-1/2 bg-slate-200 rounded-full"></div>
                         </div>
                      </div>
                   </div>
                </div>
                <h3 className="text-xl font-bold mb-3">Wawasan Cerdas AI</h3>
                <p className="text-sm font-medium text-slate-500 leading-relaxed">
                  Terima peringatan pengeluaran proaktif dan rekomendasi yang dipersonalisasi berdasarkan algoritma analisis riwayat transaksi Anda.
                </p>
              </div>

              {/* Card 4: Pertumbuhan */}
              <div className="bg-white rounded-[2rem] p-6 lg:p-8 border border-slate-200 shadow-sm hover:shadow-md transition-shadow group">
                <div className="bg-slate-50 rounded-2xl h-56 mb-8 p-6 flex items-end justify-center gap-3 relative overflow-hidden border border-slate-100">
                   <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:16px_16px] opacity-60"></div>
                   <div className="w-8 bg-blue-200 rounded-t-lg h-[40%] relative z-10 transform group-hover:h-[45%] transition-all"></div>
                   <div className="w-8 bg-blue-300 rounded-t-lg h-[60%] relative z-10 transform group-hover:h-[65%] transition-all"></div>
                   <div className="w-8 bg-blue-400 rounded-t-lg h-[50%] relative z-10 transform group-hover:h-[55%] transition-all"></div>
                   <div className="w-8 bg-blue-500 rounded-t-lg h-[85%] relative z-10 transform group-hover:h-[90%] transition-all"></div>
                   <div className="w-8 bg-blue-600 rounded-t-lg h-[70%] relative z-10 transform group-hover:h-[75%] transition-all"></div>
                </div>
                <h3 className="text-xl font-bold mb-3">Visualisasi Pertumbuhan</h3>
                <p className="text-sm font-medium text-slate-500 leading-relaxed">
                  Lacak surplus keuangan dan bangun kebiasaan finansial yang sehat. Visualisasikan data historis Anda melalui grafik yang mudah dimengerti.
                </p>
              </div>

            </div>
          </div>
        </section>

        {/* ========================================================= 
            4. INFRASTRUKTUR TEKNIS (Toolkit)
            ========================================================= */}
        <section id="infrastruktur" className="max-w-7xl mx-auto px-6 py-20">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-black tracking-tight mb-4">Infrastruktur <span className="text-blue-600">Enterprise</span>, antarmuka personal.</h2>
            <p className="text-slate-500 font-medium">Dibangun untuk mengatasi masalah klasik jaringan dan sinkronisasi pada aplikasi tradisional.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-[2rem] p-8 border border-slate-200 shadow-sm flex flex-col">
              <div className="h-12 w-12 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mb-6">
                <WifiOff size={24} />
              </div>
              <h3 className="text-xl font-bold mb-3">Sistem Tangguh Offline</h3>
              <p className="text-sm font-medium text-slate-500 leading-relaxed mb-8 flex-1">
                Aplikasi keuangan biasa akan *error* saat tidak ada internet. ManagJeh menyimpan transaksi di memori perangkat secara sementara dan menyinkronkannya ke peladen secara otomatis nanti.
              </p>
            </div>

            <div className="bg-slate-900 text-white rounded-[2rem] p-8 shadow-xl flex flex-col relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none"><Users size={120} /></div>
              <div className="h-12 w-12 bg-slate-800 text-emerald-400 rounded-2xl flex items-center justify-center mb-6 relative z-10">
                <Activity size={24} />
              </div>
              <h3 className="text-xl font-bold mb-3 relative z-10">Dompet Pasangan / Tim</h3>
              <p className="text-sm font-medium text-slate-400 leading-relaxed flex-1 relative z-10">
                Lupakan pembukuan ganda. Sinkronisasi antar-pengguna terjadi secara instan (realtime) berkat arsitektur WebSocket native. Jika satu mencatat, layar yang lain langsung diperbarui.
              </p>
            </div>
          </div>
        </section>

        {/* ========================================================= 
            5. KECEPATAN (PERFORMANCE) SECTION
            ========================================================= */}
        <section id="kecepatan" className="bg-slate-50 py-24 border-t border-slate-200">
          <div className="max-w-7xl mx-auto px-6">
            <div className="grid md:grid-cols-2 gap-16 items-center">
              <div className="order-2 md:order-1 bg-white rounded-[2rem] p-8 border border-slate-200 shadow-lg relative overflow-hidden flex flex-col items-center justify-center min-h-[400px]">
                <div className="absolute inset-0 bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:24px_24px] opacity-10"></div>
                <div className="relative z-10 w-full max-w-xs space-y-6">
                  <div className="flex items-center gap-4 bg-white p-4 rounded-2xl shadow-md border border-slate-100">
                    <div className="w-12 h-12 bg-blue-50 rounded-full flex justify-center items-center"><Gauge className="text-blue-600" size={24}/></div>
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase">Waktu Render Tampilan</p>
                      <p className="text-2xl font-black text-slate-900">0.05 <span className="text-sm font-semibold">detik</span></p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 bg-white p-4 rounded-2xl shadow-md border border-slate-100 transform translate-x-4">
                    <div className="w-12 h-12 bg-emerald-50 rounded-full flex justify-center items-center"><Zap className="text-emerald-600" size={24}/></div>
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase">Optimistic Mutation</p>
                      <p className="text-xl font-black text-slate-900">Instan Tanpa Jeda</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="order-1 md:order-2">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-600 font-bold text-xs uppercase tracking-wider mb-4 border border-emerald-100">
                  <Zap size={14} /> Infrastruktur Performa Tinggi
                </div>
                <h2 className="text-3xl lg:text-4xl font-black tracking-tight mb-6">Secepat berpikir.<br/>Tanpa <span className="text-blue-600">layar loading.</span></h2>
                <p className="text-slate-500 font-medium mb-8 leading-relaxed">
                  Aplikasi lambat akan merusak kebiasaan mencatat Anda. Kami mendesain antarmuka ini untuk bergerak secepat jari Anda.
                </p>
                <ul className="space-y-4 text-sm font-semibold text-slate-700">
                  <li className="flex items-start gap-3">
                    <CheckCircle2 size={20} className="text-blue-600 shrink-0" /> 
                    <span><strong>Optimistic UI:</strong> Saat Anda menekan "Simpan", layar merespons seketika tanpa perlu menunggu konfirmasi peladen jarak jauh.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 size={20} className="text-blue-600 shrink-0" /> 
                    <span><strong>Client-Side Aggregation:</strong> Grafik dan laporan dihitung langsung oleh memori perangkat Anda, menghemat kuota internet dan meniadakan jeda.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 size={20} className="text-blue-600 shrink-0" /> 
                    <span><strong>Zero-Bloatware:</strong> Tidak ada aset gambar raksasa atau *library* pelacak pihak ketiga yang membebani memori ponsel Anda.</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================= 
            6. KEAMANAN (SECURITY) SECTION
            ========================================================= */}
        <section id="keamanan" className="bg-slate-900 text-white py-24">
          <div className="max-w-7xl mx-auto px-6">
            <div className="grid md:grid-cols-2 gap-16 items-center">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800 text-amber-400 font-bold text-xs uppercase tracking-wider mb-4 border border-slate-700">
                  <Lock size={14} /> Privasi Arsitektural
                </div>
                <h2 className="text-3xl lg:text-4xl font-black tracking-tight mb-6">Data finansial Anda <span className="text-blue-400">dikunci</span> secara kriptografis.</h2>
                <p className="text-slate-400 font-medium mb-8 leading-relaxed">
                  Kami tidak hanya mengandalkan kata sandi. Keamanan ManagJeh dibangun di atas fondasi PostgreSQL tingkat lanjut yang mengisolasi data Anda pada tingkat basis data terdalam.
                </p>
                <ul className="space-y-4 text-sm font-semibold text-slate-300">
                  <li className="flex items-start gap-3">
                    <ShieldCheck size={20} className="text-emerald-400 shrink-0" /> 
                    <span><strong>Row Level Security (RLS):</strong> Bahkan administrator atau peretas (*hacker*) yang berhasil menembus server tidak dapat membaca transaksi Anda tanpa memiliki Token JWT sesi Anda yang sah.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <ShieldCheck size={20} className="text-emerald-400 shrink-0" /> 
                    <span><strong>Otentikasi OAuth 2.0:</strong> Kurangi risiko kebocoran kata sandi dengan mendelegasikan keamanan masuk kepada raksasa teknologi (Google & Apple).</span>
                  </li>
                </ul>
              </div>

              <div className="bg-slate-800 rounded-[2rem] p-8 border border-slate-700 shadow-2xl relative overflow-hidden flex flex-col items-center justify-center min-h-[400px]">
                <div className="absolute inset-0 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:24px_24px] opacity-40"></div>
                <div className="relative z-10 w-full max-w-sm space-y-4">
                  <div className="bg-slate-950 rounded-2xl p-4 shadow-xl transform translate-x-4 border border-slate-800">
                    <div className="flex justify-between items-center mb-3">
                      <div className="flex items-center gap-2 text-xs font-mono text-emerald-400"><Database size={14}/> Database Vault</div>
                      <Lock size={16} className="text-blue-400"/>
                    </div>
                    <div className="h-2 w-full bg-slate-800 rounded-full mb-2 overflow-hidden">
                       <div className="h-full bg-blue-500 w-[100%]"></div>
                    </div>
                    <p className="text-[10px] text-slate-500 font-mono">auth.uid() = transaction.user_id</p>
                  </div>
                  
                  <div className="bg-slate-800 rounded-2xl p-4 shadow-xl transform -translate-x-4 border border-slate-700">
                     <div className="flex gap-3 items-center">
                        <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400"><ShieldCheck size={14}/></div>
                        <div>
                          <div className="h-3 w-32 bg-slate-700 rounded-full mb-1"></div>
                          <div className="h-2 w-20 bg-slate-600 rounded-full"></div>
                        </div>
                     </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================= 
            7. 100% FREE CALL TO ACTION 
            ========================================================= */}
        <section id="gratis" className="py-24 bg-[#FDFDFD]">
          <div className="max-w-5xl mx-auto px-6">
            <div className="bg-gradient-to-br from-blue-600 to-indigo-800 rounded-[2.5rem] p-10 md:p-16 text-center shadow-2xl relative overflow-hidden text-white">
              <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none transform rotate-12"><Sparkles size={200} /></div>
              
              <h2 className="text-3xl md:text-5xl font-black tracking-tight mb-6 relative z-10">Tanpa Biaya. Tanpa Iklan.<br/>100% Gratis Selamanya.</h2>
              <p className="text-blue-100 font-medium mb-10 max-w-2xl mx-auto text-lg relative z-10">
                ManagJeh dibangun sebagai alat bantu untuk komunitas. Kami tidak menjual data pengguna kepada pihak ketiga, dan tidak ada paywall yang menyembunyikan fitur esensial.
              </p>
              
              <div className="flex justify-center items-center gap-4 relative z-10">
                <Link to="/login" className="bg-white text-blue-900 hover:bg-slate-50 font-bold px-8 py-4 rounded-full transition-all shadow-lg flex items-center gap-2 outline-none focus:ring-4 focus:ring-blue-300">
                  Buat Akun Anda Sekarang <ArrowRight size={18} />
                </Link>
              </div>

              <div className="mt-12 flex flex-wrap justify-center gap-x-8 gap-y-4 text-sm font-semibold text-blue-200 relative z-10">
                <span className="flex items-center gap-2"><CheckCircle2 size={16}/> Semua Fitur AI Terbuka</span>
                <span className="flex items-center gap-2"><CheckCircle2 size={16}/> Kolaborasi Bebas Hambatan</span>
                <span className="flex items-center gap-2"><CheckCircle2 size={16}/> Tanpa Batasan Riwayat</span>
              </div>
            </div>
          </div>
        </section>

      </main>

      {/* ========================================================= 
          8. FOOTER
          ========================================================= */}
      <footer className="bg-[#0B1528] text-slate-300 py-16 relative overflow-hidden">
        <div className="absolute -bottom-20 -left-10 text-[300px] font-black text-slate-800/30 leading-none select-none pointer-events-none">
          M
        </div>
        
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
            <div className="md:col-span-2">
              <Link to="/" className="inline-block mb-4 outline-none focus:ring-2 focus:ring-blue-200 rounded-lg">
                <img 
                  src="/logo.svg" 
                  alt="ManagJeh Logo" 
                  className="h-7 md:h-8 w-auto object-contain" 
                  loading="lazy"
                />
              </Link>
              <p className="text-sm text-slate-500 font-medium max-w-xs leading-relaxed">
                Platform modern, intuitif, dan aman untuk merencanakan arus kas finansial Anda. Sepenuhnya gratis untuk kemajuan bersama.
              </p>
            </div>
            
            <div>
              <h4 className="text-white font-bold mb-4">Infrastruktur</h4>
              <ul className="space-y-3 text-sm font-medium">
                <li><a href="#fitur" className="hover:text-blue-400 transition-colors outline-none">Mesin Offline</a></li>
                <li><a href="#kecepatan" className="hover:text-blue-400 transition-colors outline-none">Optimistic Render</a></li>
                <li><a href="#keamanan" className="hover:text-blue-400 transition-colors outline-none">Otorisasi RLS</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-white font-bold mb-4">Perusahaan</h4>
              <ul className="space-y-3 text-sm font-medium">
                <li><a href="#" className="hover:text-blue-400 transition-colors outline-none">Kontribusi Tim</a></li>
                <li><a href="#" className="hover:text-blue-400 transition-colors outline-none">Syarat & Ketentuan</a></li>
                <li><a href="#" className="hover:text-blue-400 transition-colors outline-none">Kebijakan Privasi</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-slate-800 pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs font-semibold text-slate-600">
            <p>&copy; 2026 ManagJeh Platform. Hak Cipta Dilindungi.</p>
          </div>
        </div>
      </footer>

    </div>
  );
}