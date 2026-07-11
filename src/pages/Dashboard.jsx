import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { formatIDR } from '../lib/utils';
import { Wallet, Activity, Landmark, Sparkles, AlertCircle, Eye, EyeOff, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// ==============================================================================
// 1. SKELETON LOADING (DIOPTIMALKAN UNTUK MOBILE RESPONSIVENESS)
// ==============================================================================
const DashboardSkeleton = () => (
  <div className="max-w-6xl mx-auto space-y-6 pb-12 px-4 md:px-0 animate-pulse w-full">
    {/* Header */}
    <div className="flex justify-between items-end">
      <div className="space-y-3">
        <div className="h-8 bg-slate-200 rounded-xl w-48 md:w-64"></div>
        <div className="h-4 bg-slate-200 rounded-lg w-72 md:w-96"></div>
      </div>
      <div className="h-10 w-10 bg-slate-200 rounded-xl"></div>
    </div>

    {/* Row 1 */}
    <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
      <div className="md:col-span-8 bg-slate-900 rounded-3xl p-6 sm:p-8 flex flex-col justify-between min-h-[220px]">
        <div><div className="h-4 bg-slate-800 rounded-lg w-40 mb-4"></div><div className="h-12 sm:h-14 bg-slate-800 rounded-2xl w-64 sm:w-80"></div></div>
        <div className="mt-8 border-t border-slate-800 pt-5 flex justify-between"><div className="space-y-2"><div className="h-3 bg-slate-800 rounded-md w-24"></div><div className="h-6 bg-slate-800 rounded-lg w-32"></div></div></div>
      </div>
      <div className="md:col-span-4 bg-indigo-50 border border-indigo-100 rounded-3xl p-6 flex flex-col justify-center">
        <div className="h-12 w-12 bg-indigo-100 rounded-2xl mb-4"></div><div className="h-4 bg-indigo-100 rounded-md w-32 mb-3"></div><div className="h-10 bg-indigo-100 rounded-xl w-48 mb-3"></div>
      </div>
    </div>

    {/* Row 2 */}
    <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
      <div className="md:col-span-4 bg-white p-6 rounded-3xl border border-slate-200 h-[400px]">
        <div className="h-6 bg-slate-200 rounded-lg w-32 mb-6"></div>
        <div className="space-y-4">{[1, 2, 3, 4].map(i => <div key={i} className="h-12 bg-slate-50 rounded-xl w-full"></div>)}</div>
      </div>
      <div className="md:col-span-8 bg-blue-50/50 p-6 rounded-3xl border border-blue-100 h-[400px]">
        <div className="flex items-center gap-3 mb-6"><div className="h-10 w-10 bg-blue-200 rounded-xl"></div><div className="space-y-2"><div className="h-5 bg-blue-200 rounded-lg w-40"></div></div></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{[1, 2].map(i => <div key={i} className="h-32 bg-white rounded-2xl border border-slate-200"></div>)}</div>
      </div>
    </div>

    {/* Row 3: Cash Flow & Activity (Responsif Mobile) */}
    <div className="grid grid-cols-1 gap-6 mt-6">
      <div className="bg-white p-4 sm:p-6 rounded-3xl border border-slate-200 h-[350px] flex flex-col">
        <div className="flex flex-col sm:flex-row justify-between gap-4 mb-6"><div className="h-6 bg-slate-200 rounded-lg w-40"></div><div className="h-8 bg-slate-200 rounded-xl w-32"></div></div>
        <div className="flex-1 bg-slate-50 rounded-xl w-full"></div>
      </div>
      <div className="bg-white p-4 sm:p-6 rounded-3xl border border-slate-200 flex flex-col">
        <div className="flex justify-between mb-6"><div className="h-6 bg-slate-200 rounded-lg w-40"></div><div className="h-5 bg-slate-200 rounded-lg w-24"></div></div>
        <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-14 bg-slate-50 rounded-xl border border-slate-100 w-full"></div>)}</div>
      </div>
    </div>
  </div>
);


// ==============================================================================
// 2. KOMPONEN UTAMA
// ==============================================================================
export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [showBalances, setShowBalances] = useState(false);
  const [showDebtDetails, setShowDebtDetails] = useState(false);
  const [cashFlowMode, setCashFlowMode] = useState('expense'); // 'income' atau 'expense'

  // === STATE BARU UNTUK FILTER ARUS KAS ===
  const [periodType, setPeriodType] = useState('bulan'); // 'minggu' | 'bulan' | 'tahun'
  const [periodValue, setPeriodValue] = useState(6);

  // Mencegah nilai melampaui batas saat tipe diubah
  const handlePeriodTypeChange = (e) => {
    const newType = e.target.value;
    setPeriodType(newType);
    if (newType === 'minggu' && periodValue > 4) setPeriodValue(4);
    if (newType === 'tahun' && periodValue > 5) setPeriodValue(5);
  };

  const { data, isLoading, isError } = useQuery({
    // Masukkan state ke dalam queryKey agar otomatis refetch saat filter diganti
    queryKey: ['dashboardData', user?.id, periodType, periodValue], 
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      
      // 1. Hitung Batas Waktu Mulai (Start Date) secara dinamis
      const startDate = new Date();
      startDate.setHours(0, 0, 0, 0);

      if (periodType === 'minggu') {
        // Kurangi N minggu (N * 7 hari)
        startDate.setDate(startDate.getDate() - (periodValue * 7) + 1);
      } else if (periodType === 'bulan') {
        startDate.setMonth(startDate.getMonth() - periodValue + 1);
        startDate.setDate(1); // Set ke tanggal 1
      } else if (periodType === 'tahun') {
        startDate.setFullYear(startDate.getFullYear() - periodValue + 1);
        startDate.setMonth(0, 1); // Set ke 1 Januari
      }

      const [statsRes, accountsRes, insightsRes, recentTxRes, flowTxRes] = await Promise.all([
        supabase.from('user_dashboard_stats').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('accounts').select('*').eq('user_id', user.id).order('type', { ascending: true }),
        supabase.rpc('get_budget_predictive_analysis', { user_id_param: user.id }),
        supabase.from('transactions')
          .select(`id, amount, type, date, description, categories (name), accounts!transactions_account_id_fkey (name)`)
          .eq('user_id', user.id).is('deleted_at', null).order('date', { ascending: false }).limit(5),
        // Gunakan startDate yang sudah dihitung secara dinamis
        supabase.from('transactions')
          .select('amount, type, date')
          .eq('user_id', user.id)
          .gte('date', startDate.toISOString())
          .is('deleted_at', null)
      ]);

      if (accountsRes.error) throw accountsRes.error;
      if (statsRes.error) throw statsRes.error;
      if (recentTxRes.error) throw recentTxRes.error; 
      if (flowTxRes.error) throw flowTxRes.error;

      // 2. Siapkan Wadah Kosong (Buckets) sesuai Tipe
      const buckets = [];
      if (periodType === 'minggu') {
        const totalDays = periodValue * 7;
        for(let i = totalDays - 1; i >= 0; i--) {
          const d = new Date(); d.setDate(d.getDate() - i);
          buckets.push({
            label: d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
            matchKey: d.toDateString(), // Contoh: Wed Jul 11 2026
            year: d.getFullYear(), income: 0, expense: 0
          });
        }
      } else if (periodType === 'bulan') {
        for(let i = periodValue - 1; i >= 0; i--) {
          const d = new Date(); d.setMonth(d.getMonth() - i);
          buckets.push({
            label: d.toLocaleDateString('id-ID', { month: 'short' }),
            matchKey: `${d.getMonth()}-${d.getFullYear()}`,
            year: d.getFullYear(), income: 0, expense: 0
          });
        }
      } else if (periodType === 'tahun') {
        for(let i = periodValue - 1; i >= 0; i--) {
          const d = new Date(); d.setFullYear(d.getFullYear() - i);
          buckets.push({
            label: d.getFullYear().toString(),
            matchKey: d.getFullYear().toString(),
            year: d.getFullYear(), income: 0, expense: 0
          });
        }
      }

      // 3. Masukkan Data Transaksi ke dalam Bucket yang Tepat
      if (flowTxRes.data) {
        flowTxRes.data.forEach(tx => {
          if (tx.type === 'transfer') return;
          const txDate = new Date(tx.date);
          
          let key;
          if (periodType === 'minggu') key = txDate.toDateString();
          else if (periodType === 'bulan') key = `${txDate.getMonth()}-${txDate.getFullYear()}`;
          else if (periodType === 'tahun') key = txDate.getFullYear().toString();

          const match = buckets.find(b => b.matchKey === key);
          if (match) {
            const safeAmount = Number(tx.amount) || 0;
            if (tx.type === 'income') match.income += safeAmount;
            if (tx.type === 'expense') match.expense += safeAmount;
          }
        });
      }
      
      return {
        stats: statsRes.data || { total_assets: 0, total_liabilities: 0, net_worth: 0 },
        accounts: accountsRes.data || [],
        aiInsights: insightsRes.data || [],
        recentTransactions: recentTxRes.data || [],
        cashFlow: buckets // Data yang sudah di-bucket
      };
    }
  });

  // Hotkey N
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

  const maskIDR = (num) => showBalances ? formatIDR(num) : 'Rp ••••••••••';

  if (isError) return <div className="text-center text-red-500 mt-10 font-bold" role="alert">Gagal memuat dasbor. Periksa koneksi Anda.</div>;
  if (isLoading) return <DashboardSkeleton />;

  const liquidAssets = data.accounts.filter(a => ['bank', 'cash', 'e-wallet'].includes(a.type)).reduce((acc, curr) => acc + curr.balance, 0);
  const investmentAssets = data.accounts.filter(a => ['crypto', 'investment'].includes(a.type)).reduce((acc, curr) => acc + curr.balance, 0);
  const totalDebt = data.stats.total_liabilities;

  // Nilai Maksimal untuk menghitung persentase Tinggi Grafik Bar
  const maxFlowValue = Math.max(...data.cashFlow.map(d => cashFlowMode === 'income' ? d.income : d.expense), 1);

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
                {showDebtDetails && <p className="text-sm font-bold text-red-400 mt-1">- {formatIDR(totalDebt)}</p>}
              </div>
            )}
          </div>
          <div className="absolute -right-12 -bottom-12 opacity-10 pointer-events-none"><Activity size={250} strokeWidth={1} /></div>
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
                  <span className={`text-sm font-extrabold block ${acc.type === 'debt' ? 'text-red-600' : 'text-slate-900'}`}>{maskIDR(Math.abs(acc.balance))}</span>
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

      {/* ==============================================================================
          FITUR ARUS KAS & AKTIVITAS (SUDAH RESPONSIF & DATA ASLI)
          ============================================================================== */}
      
      {/* SECTION ARUS KAS (CASH FLOW) */}
      <div className="grid grid-cols-1 gap-6 mt-6">
        <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-6 shadow-sm flex flex-col overflow-hidden">
          
          {/* Header & Filter Responsif */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div className="w-full sm:w-auto">
              <h3 className="font-bold text-lg text-slate-900 mb-2">Arus Kas (Cash Flow)</h3>
              <div className="flex items-center gap-2">
                <select 
                  value={periodType} 
                  onChange={handlePeriodTypeChange}
                  className="text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-700 cursor-pointer"
                >
                  <option value="minggu">Harian (Minggu)</option>
                  <option value="bulan">Bulanan</option>
                  <option value="tahun">Tahunan</option>
                </select>
                <select 
                  value={periodValue} 
                  onChange={(e) => setPeriodValue(Number(e.target.value))}
                  className="text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-700 cursor-pointer"
                >
                  {Array.from({ length: periodType === 'minggu' ? 4 : periodType === 'bulan' ? 12 : 5 }, (_, i) => (
                    <option key={i+1} value={i+1}>{i+1} {periodType}</option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="bg-slate-100 p-1 rounded-xl flex text-xs font-bold w-full sm:w-auto">
              <button 
                onClick={() => setCashFlowMode('income')}
                className={`flex-1 sm:flex-none px-4 py-2 rounded-lg transition-all outline-none ${cashFlowMode === 'income' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
              >Pemasukan</button>
              <button 
                onClick={() => setCashFlowMode('expense')}
                className={`flex-1 sm:flex-none px-4 py-2 rounded-lg transition-all outline-none ${cashFlowMode === 'expense' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
              >Pengeluaran</button>
            </div>
          </div>
          
          {/* Scrollable Chart Wrapper (Penting untuk mengatasi batas layar HP) */}
          <div className="overflow-x-auto pb-4 scrollbar-thin">
            <div className="min-w-[600px] flex-none flex items-end justify-between gap-1 px-1 h-[200px] mt-2 border-b border-slate-100 pb-0 relative">
              {/* Garis Dasar */}
              <div className="absolute left-0 bottom-0 w-full border-t border-dashed border-slate-200 z-0"></div>
              
              {data.cashFlow.map((item, i) => {
                const value = cashFlowMode === 'income' ? item.income : item.expense;
                const validMax = maxFlowValue > 0 ? maxFlowValue : 1; 
                const heightPercent = (value / validMax) * 100;
                const visualHeight = Math.max(Number(heightPercent) || 0, 4); 

                return (
                  <div key={i} className="flex-1 max-w-[64px] h-full flex flex-col justify-end relative z-10 group cursor-pointer px-1">
                    {/* Tooltip */}
                    <div className="hidden group-hover:block absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-xs font-bold px-3 py-2 rounded-lg whitespace-nowrap shadow-lg z-50 pointer-events-none">
                      <span className="block text-[10px] text-slate-400 font-normal mb-0.5">{item.label} {periodType !== 'tahun' && item.year}</span>
                      {showBalances ? formatIDR(value) : 'Rp •••••••••'}
                    </div>
                    
                    {/* Batang Grafik */}
                    <div 
                      className={`w-full rounded-t-lg transition-all duration-700 ease-out ${
                        cashFlowMode === 'income' ? 'bg-emerald-100 group-hover:bg-emerald-500' : 'bg-red-100 group-hover:bg-red-500'
                      }`} 
                      style={{ height: `${visualHeight}%` }}
                    ></div>
                  </div>
                );
              })}
            </div>
            
            {/* Label Sumbu X */}
            <div className="min-w-[600px] flex justify-between px-1 mt-2 text-[10px] sm:text-xs font-bold text-slate-400">
              {data.cashFlow.map((item, i) => (
                <span key={i} className="flex-1 max-w-[64px] text-center truncate px-1">{item.label}</span>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* SECTION AKTIVITAS TERBARU (RESPONSIF & SCROLLABLE MOBILE) */}
      <div className="grid grid-cols-1 gap-6 mt-6">
        <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
          
          <div className="p-4 sm:p-6 border-b border-slate-100 flex items-center justify-between gap-4">
            <h3 className="font-bold text-lg text-slate-900">Aktivitas Terbaru</h3>
            <button className="text-sm font-bold text-blue-600 hover:text-blue-800 outline-none whitespace-nowrap">Lihat Semua</button>
          </div>
          
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-sm text-slate-500 min-w-[600px]">
              <thead className="bg-slate-50 text-xs uppercase font-bold text-slate-400">
                <tr>
                  <th className="px-6 py-4">Transaksi</th>
                  <th className="px-6 py-4">Kategori</th>
                  <th className="px-6 py-4">Tanggal</th>
                  <th className="px-6 py-4">Dompet</th>
                  <th className="px-6 py-4 text-right">Nominal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {data.recentTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-slate-900 font-bold truncate max-w-[150px] sm:max-w-xs">
                      {tx.description || tx.categories?.name || 'Tanpa Catatan'}
                    </td>
                    <td className="px-6 py-4">
                      <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded-md text-xs whitespace-nowrap">
                        {tx.type === 'income' ? 'Pemasukan' : tx.type === 'expense' ? 'Pengeluaran' : 'Transfer'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">{new Date(tx.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</td>
                    <td className="px-6 py-4 truncate max-w-[120px]">{tx.accounts?.name || 'Dompet Dihapus'}</td>
                    <td className={`px-6 py-4 text-right font-bold whitespace-nowrap ${tx.type === 'income' ? 'text-emerald-600' : 'text-slate-900'}`}>
                      {showBalances ? `${tx.type === 'expense' ? '-' : '+'} ${formatIDR(tx.amount)}` : 'Rp •••••••••'}
                    </td>
                  </tr>
                ))}
                {data.recentTransactions.length === 0 && (
                  <tr>
                    <td colSpan="5" className="px-6 py-8 text-center text-slate-400 text-sm italic">Belum ada aktivitas transaksi.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

        </div>
      </div>

    </div>
  );
}