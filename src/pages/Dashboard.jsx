import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { formatIDR } from '../lib/utils';
import { Wallet, Activity, Landmark, Sparkles, AlertCircle, Eye, EyeOff, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// ==============================================================================
// KOMPONEN SKELETON LOADING (Meningkatkan Perceived Performance & Mencegah CLS)
// ==============================================================================
const DashboardSkeleton = () => (
  <div className="max-w-6xl mx-auto space-y-6 pb-12 px-4 md:px-0 animate-pulse w-full">
    {/* Header Skeleton */}
    <div className="flex justify-between items-end">
      <div className="space-y-3">
        <div className="h-8 bg-slate-200 rounded-xl w-48 md:w-64"></div>
        <div className="h-4 bg-slate-200 rounded-lg w-72 md:w-96"></div>
      </div>
      <div className="h-10 w-10 bg-slate-200 rounded-xl"></div>
    </div>

    {/* Row 1 Skeleton: Metrik Utama */}
    <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
      {/* Main Card Skeleton (Dark Theme) */}
      <div className="md:col-span-8 bg-slate-900 rounded-3xl p-6 sm:p-8 flex flex-col justify-between min-h-[220px]">
        <div>
          <div className="h-4 bg-slate-800 rounded-lg w-40 mb-4"></div>
          <div className="h-12 sm:h-14 bg-slate-800 rounded-2xl w-64 sm:w-80"></div>
        </div>
        <div className="mt-8 border-t border-slate-800 pt-5 flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-3 bg-slate-800 rounded-md w-24"></div>
            <div className="h-6 bg-slate-800 rounded-lg w-32"></div>
          </div>
          <div className="h-4 bg-slate-800 rounded-md w-20"></div>
        </div>
      </div>

      {/* Portofolio Card Skeleton */}
      <div className="md:col-span-4 bg-indigo-50/50 border border-indigo-100 rounded-3xl p-6 flex flex-col justify-center">
        <div className="h-12 w-12 bg-indigo-100/70 rounded-2xl mb-4"></div>
        <div className="h-4 bg-indigo-100/70 rounded-md w-32 mb-3"></div>
        <div className="h-10 bg-indigo-100/70 rounded-xl w-48 mb-3"></div>
        <div className="h-3 bg-indigo-100/70 rounded-md w-40"></div>
      </div>
    </div>

    {/* Row 2 Skeleton: Detail & AI */}
    <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
      {/* Distribusi Saldo Skeleton */}
      <div className="md:col-span-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm h-[400px]">
        <div className="h-6 bg-slate-200 rounded-lg w-32 mb-6"></div>
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex justify-between items-center p-3 rounded-xl border border-slate-100 bg-slate-50">
              <div className="space-y-2">
                <div className="h-4 bg-slate-200 rounded-md w-24"></div>
                <div className="h-3 bg-slate-200 rounded-md w-16"></div>
              </div>
              <div className="h-5 bg-slate-200 rounded-lg w-20"></div>
            </div>
          ))}
        </div>
      </div>

      {/* AI Insights Skeleton */}
      <div className="md:col-span-8 bg-blue-50/50 p-6 rounded-3xl border border-blue-100 shadow-sm h-[400px]">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 bg-blue-200/50 rounded-xl"></div>
          <div className="space-y-2">
            <div className="h-5 bg-blue-200/50 rounded-lg w-40"></div>
            <div className="h-3 bg-blue-200/50 rounded-md w-64"></div>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="p-4 rounded-2xl border border-slate-200 bg-white h-32 flex gap-3">
              <div className="h-5 w-5 bg-slate-200 rounded-full flex-shrink-0"></div>
              <div className="space-y-3 w-full">
                <div className="h-3 bg-slate-200 rounded-md w-20"></div>
                <div className="h-4 bg-slate-200 rounded-md w-full"></div>
                <div className="h-4 bg-slate-200 rounded-md w-3/4"></div>
                <div className="h-3 bg-slate-200 rounded-md w-full mt-4"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

// ==============================================================================
// KOMPONEN UTAMA DASHBOARD
// ==============================================================================
export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [showBalances, setShowBalances] = useState(false);
  const [showDebtDetails, setShowDebtDetails] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboardData', user?.id],
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const [statsRes, accountsRes, insightsRes] = await Promise.all([
        supabase.from('user_dashboard_stats').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('accounts').select('*').eq('user_id', user.id).order('type', { ascending: true }),
        supabase.rpc('get_budget_predictive_analysis', { user_id_param: user.id })
      ]);

      if (accountsRes.error) throw accountsRes.error;
      if (statsRes.error) throw statsRes.error;
      
      return {
        stats: statsRes.data || { total_assets: 0, total_liabilities: 0, net_worth: 0 },
        accounts: accountsRes.data || [],
        aiInsights: insightsRes.data || []
      };
    }
  });

  // Aksesibilitas: Interseptor Hotkey "N"
  useEffect(() => {
    const handleKeyPress = (e) => {
      const active = document.activeElement;
      const isEditable = active.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(active.tagName);
      if (e.key.toLowerCase() === 'n' && !isEditable) {
        e.preventDefault();
        navigate('/transaksi');
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [navigate]);

  const maskIDR = (num) => {
    if (!showBalances) return 'Rp ••••••••••';
    return formatIDR(num);
  };

  if (isError) return <div className="text-center text-red-500 mt-10 font-bold" role="alert">Gagal memuat dasbor. Periksa koneksi Anda.</div>;
  
  // Render SKELETON saat data sedang diambil (fetching)
  if (isLoading) return <DashboardSkeleton />;

  const liquidAssets = data.accounts.filter(a => ['bank', 'cash', 'e-wallet'].includes(a.type)).reduce((acc, curr) => acc + curr.balance, 0);
  const investmentAssets = data.accounts.filter(a => ['crypto', 'investment'].includes(a.type)).reduce((acc, curr) => acc + curr.balance, 0);
  const totalDebt = data.stats.total_liabilities;

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12 px-4 md:px-0">
      
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Kecerdasan Finansial</h1>
          <p className="text-sm text-slate-500">Ringkasan aset, distribusi dompet, dan analisis cerdas.</p>
        </div>
        <button 
          onClick={() => setShowBalances(!showBalances)}
          className="p-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-colors outline-none focus:ring-2 focus:ring-slate-300"
          title={showBalances ? 'Sembunyikan Saldo' : 'Tampilkan Saldo'}
        >
          {showBalances ? <EyeOff size={20} /> : <Eye size={20} />}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* KARTU NET WORTH */}
        <div className="md:col-span-8 bg-slate-900 rounded-3xl p-6 sm:p-8 text-white flex flex-col justify-between relative overflow-hidden shadow-lg">
          <div>
            <p className="text-slate-400 text-sm font-bold tracking-wider uppercase mb-2 flex items-center gap-2"><Wallet size={16}/> Total Kekayaan Bersih</p>
            <h2 className="text-4xl sm:text-5xl font-black tracking-tighter">{maskIDR(data.stats.net_worth)}</h2>
          </div>
          
          <div className="mt-8 border-t border-slate-700/50 pt-5 flex items-center justify-between relative z-10">
            <div>
              <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1 flex items-center gap-1"><Landmark size={12}/> Kas & Likuid</p>
              <p className="text-lg font-bold text-emerald-400">{maskIDR(liquidAssets)}</p>
            </div>
            
            {totalDebt > 0 && (
              <div className="text-right">
                <button 
                  onClick={() => setShowDebtDetails(!showDebtDetails)}
                  className="text-xs font-semibold text-slate-400 hover:text-white flex items-center gap-1 ml-auto outline-none transition-colors"
                >
                  Liabilitas {showDebtDetails ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                </button>
                {showDebtDetails && (
                  <p className="text-sm font-bold text-red-400 mt-1">
                    - {formatIDR(totalDebt)}
                  </p>
                )}
              </div>
            )}
          </div>
          <div className="absolute -right-12 -bottom-12 opacity-10 pointer-events-none">
            <Activity size={250} strokeWidth={1} />
          </div>
        </div>

        {/* KARTU PORTOFOLIO */}
        <div className="md:col-span-4 bg-gradient-to-br from-indigo-50 to-white border border-indigo-100 rounded-3xl p-6 shadow-sm flex flex-col justify-center">
          <div className="p-3 bg-indigo-100 text-indigo-600 rounded-2xl w-fit mb-4"><TrendingUp size={24} /></div>
          <p className="text-slate-500 text-sm font-bold uppercase tracking-wider mb-1">Portofolio Investasi</p>
          <h3 className="text-3xl font-black text-slate-900">{maskIDR(investmentAssets)}</h3>
          <p className="text-xs text-slate-400 mt-2 font-medium">Crypto & Tabungan Berjangka.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* DISTRIBUSI SALDO */}
        <div className="md:col-span-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col h-full max-h-[400px]">
          <h3 className="text-base font-bold text-slate-900 mb-4">Distribusi Saldo</h3>
          <div className="space-y-3 overflow-y-auto pr-2 flex-1 scrollbar-thin">
            {data.accounts.map(acc => (
              <div key={acc.id} className="flex justify-between items-center p-3 rounded-xl border bg-slate-50 border-slate-100">
                <div>
                  <p className="text-sm font-bold text-slate-800">{acc.name}</p>
                  <p className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider">{acc.type.replace('-', ' ')}</p>
                </div>
                <div className="text-right">
                  <span className={`text-sm font-extrabold block ${acc.type === 'debt' ? 'text-red-600' : 'text-slate-900'}`}>
                    {maskIDR(Math.abs(acc.balance))}
                  </span>
                </div>
              </div>
            ))}
            {data.accounts.length === 0 && <p className="text-sm text-slate-400 italic text-center py-4">Belum ada akun dompet.</p>}
          </div>
        </div>

        {/* AI INSIGHTS */}
        <div className="md:col-span-8 bg-gradient-to-br from-blue-50 via-indigo-50 to-white p-6 rounded-3xl border border-blue-100 shadow-sm flex flex-col h-full max-h-[400px]">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2.5 bg-blue-600 rounded-xl text-white shadow-md shadow-blue-200 flex-shrink-0"><Sparkles size={20} className="text-white" /></div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Analisis Proaktif AI</h3>
              <p className="text-xs text-slate-500">Deteksi anomali pada anggaran pengeluaran bulan ini.</p>
            </div>
          </div>
          <div className="overflow-y-auto pr-2 flex-1 space-y-3 scrollbar-thin">
            {data.aiInsights.length === 0 ? (
              <div className="flex items-center justify-center h-full text-sm text-slate-500 italic py-6">Semua kategori pengeluaran terpantau aman.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {data.aiInsights.map((insight, i) => (
                  <div key={i} className={`p-4 rounded-2xl border flex gap-3 items-start bg-white border-slate-200 text-slate-700 ${insight.is_anomaly ? 'bg-red-50/70 border-red-100 text-red-900' : ''}`}>
                    <AlertCircle size={18} className={`flex-shrink-0 mt-0.5 ${insight.is_anomaly ? 'text-red-500' : 'text-emerald-500'}`} />
                    <div className="space-y-1 w-full">
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{insight.category_name}</p>
                      <p className="text-sm font-medium leading-snug">{insight.ai_warning_message}</p>
                      <div className="flex justify-between pt-2 text-[11px] font-semibold text-slate-400 border-t border-slate-100 mt-2">
                        <span>Proyeksi: <strong className={insight.is_anomaly ? 'text-red-600' : 'text-slate-700'}>{formatIDR(insight.projected_end_spent)}</strong></span>
                        <span>Limit: <strong>{formatIDR(insight.budget_limit)}</strong></span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}