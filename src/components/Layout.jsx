import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useSync } from '../hooks/useSync';
import { useRealtimeSync } from '../hooks/useRealtimeSync'; // Pastikan file hook ini sudah dibuat
import { Menu, Home, PlusCircle, PieChart, LogOut, X, CalendarDays, Wallet, WifiOff, CreditCard } from 'lucide-react';

// ==============================================================================
// 1. KOMPONEN LOGO (Dioptimalkan menggunakan file statis di folder /public)
// ==============================================================================
const Logo = () => (
  <div className="flex items-center pl-1">
    <img
      src="/logo.svg" 
      alt="ManagJeh Logo"
      className="h-6 md:h-7 w-auto flex-shrink-0 object-contain"
      width="120"
      height="28"
      loading="eager" // Prioritaskan pemuatan karena berada di area above-the-fold
    />
  </div>
);

// ==============================================================================
// 2. KOMPONEN LAYOUT UTAMA
// ==============================================================================
export default function Layout() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Memicu sinkronisasi WebSocket untuk Dompet Komunitas
  useRealtimeSync(user?.id); 

  const [isExpanded, setIsExpanded] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Deteksi Jaringan Global
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => setIsOffline(false);

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const navLinks = [
    { name: 'Dashboard', path: '/dashboard', icon: Home },
    { name: 'Dompet & Akun', path: '/akun', icon: Wallet },
    { name: 'Transaksi', path: '/transaksi', icon: PlusCircle },
    { name: 'Laporan', path: '/laporan', icon: PieChart },
    { name: 'Langganan', path: '/langganan', icon: CreditCard },
  ];

  return (
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden font-sans flex-col md:flex-row">
      
      {/* -------------------------------------------------------------
          INDIKATOR OFFLINE GLOBAL
      ------------------------------------------------------------- */}
      {isOffline && (
        <div 
          className="absolute top-0 inset-x-0 bg-amber-500 text-white text-xs font-bold text-center py-2 px-4 z-[60] flex items-center justify-center gap-2 shadow-md animate-in slide-in-from-top-2"
          role="alert"
        >
          <WifiOff size={14} /> Mode Luring Aktif. Transaksi akan disimpan sementara di memori perangkat.
        </div>
      )}

      {/* -------------------------------------------------------------
          OVERLAY MOBILE (Menutup sidebar saat klik di luar area)
      ------------------------------------------------------------- */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 z-40 md:hidden backdrop-blur-sm transition-all"
          onClick={() => setIsMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ================= SIDEBAR ================= */}
      <aside
        className={`fixed md:relative inset-y-0 left-0 z-50 flex flex-col bg-white border-r border-slate-200 transition-all duration-300 ease-in-out
          ${isExpanded ? 'w-64' : 'md:w-20 w-64'}
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        {/* Header Sidebar - Margin dinamis saat banner offline muncul */}
        <div className={`h-16 flex items-center mb-6 px-4 justify-between md:px-0 md:justify-center transition-all ${isExpanded ? 'md:px-4 md:justify-start' : ''} ${isOffline ? 'mt-10 md:mt-4' : 'mt-2'}`}>
          <div className={`overflow-hidden whitespace-nowrap ${!isExpanded ? 'md:hidden' : ''} ${isExpanded ? 'md:order-2' : ''}`}>
            <Logo />
          </div>

          <button
            onClick={() => {
              if (window.innerWidth >= 768) setIsExpanded(!isExpanded);
              else setIsMobileOpen(false);
            }}
            className={`p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 rounded-lg outline-none transition-colors flex-shrink-0 focus:ring-2 focus:ring-slate-200 ${isExpanded ? 'md:order-1 md:mr-3' : ''}`}
            aria-label="Toggle Navigation Menu"
          >
            {isMobileOpen ? <X size={22} className="md:hidden" /> : <Menu size={22} />}
          </button>
        </div>

        {/* List Menu Navigasi */}
        <nav className="flex-1 space-y-2 overflow-y-auto overflow-x-hidden scrollbar-none">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = location.pathname === link.path;

            return (
              <Link
                key={link.name}
                to={link.path}
                onClick={() => { if (window.innerWidth < 768) setIsMobileOpen(false) }}
                title={!isExpanded ? link.name : ''}
                className={`flex items-center rounded-xl font-medium transition-all outline-none focus:ring-2 focus:ring-slate-300
                  ${isActive ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}
                  px-4 py-3 mx-4 justify-start w-auto h-auto
                  md:justify-center md:w-12 md:h-12 md:mx-auto md:px-0 md:py-0
                  ${isExpanded ? 'md:justify-start md:w-auto md:h-auto md:mx-4 md:px-4 md:py-3' : ''}
                `}
              >
                <Icon size={22} className="flex-shrink-0" />
                <span className={`whitespace-nowrap transition-all duration-300
                  opacity-100 w-auto ml-3
                  md:opacity-0 md:w-0 md:ml-0
                  ${isExpanded ? 'md:opacity-100 md:w-auto md:ml-3' : ''}
                `}>
                  {link.name}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Footer Sidebar (Logout) */}
        <div className="pb-6 pt-4">
          <button
            onClick={handleLogout}
            title={!isExpanded ? 'Keluar Aplikasi' : ''}
            className={`flex items-center rounded-xl font-medium text-red-600 transition-all outline-none focus:ring-2 focus:ring-red-200 hover:bg-red-50
              px-4 py-3 mx-4 justify-start w-auto h-auto
              md:justify-center md:w-12 md:h-12 md:mx-auto md:px-0 md:py-0
              ${isExpanded ? 'md:justify-start md:w-auto md:h-auto md:mx-4 md:px-4 md:py-3' : ''}
            `}
          >
            <LogOut size={22} className="flex-shrink-0" />
            <span className={`whitespace-nowrap transition-all duration-300
              opacity-100 w-auto ml-3
              md:opacity-0 md:w-0 md:ml-0
              ${isExpanded ? 'md:opacity-100 md:w-auto md:ml-3' : ''}
            `}>
              Keluar
            </span>
          </button>
        </div>
      </aside>

      {/* ================= MAIN CONTENT AREA ================= */}
      {/* Container utama merespons spasi banner offline saat di-load di layar HP */}
      <div className={`flex-1 flex flex-col min-w-0 overflow-hidden relative transition-all ${isOffline ? 'pt-8 md:pt-0' : ''}`}>
        
        {/* Header Mobile (Darurat / Fallback) */}
        <header className="md:hidden h-16 flex items-center justify-between px-4 bg-white border-b border-slate-200 shadow-sm z-30 relative">
          <Logo />
          <button
            onClick={() => setIsMobileOpen(true)}
            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg outline-none focus:ring-2 focus:ring-slate-300"
            aria-label="Buka Menu"
          >
            <Menu size={24} />
          </button>
        </header>

        {/* Titik Masuk Router */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 relative z-10">
          <div
            key={location.pathname}
              className="max-w-6xl mx-auto pb-24 md:pb-10 animate-page-enter"
          >
            <Outlet />
           </div>
        </main>

        {/* --- FAB (FLOATING ACTION BUTTON) GLOBAL --- */}
        {/* Menggunakan navigate API alih-alih merusak state cache dengan window.location */}
        <button
          onClick={() => navigate('/transaksi')}
          className="fixed bottom-6 right-6 md:bottom-10 md:right-10 z-40 bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-xl shadow-blue-600/30 hover:scale-110 hover:shadow-2xl transition-all duration-300 outline-none focus:ring-4 focus:ring-blue-200 group"
          aria-label="Catat Transaksi Cepat"
        >
          <PlusCircle size={32} className="group-hover:rotate-90 transition-transform duration-300" />
        </button>
      </div>
      
    </div>
  );
}