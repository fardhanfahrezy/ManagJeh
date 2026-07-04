import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { getLivePrices } from '../lib/priceService';
import { useAuth } from '../contexts/AuthContext';
import { financialEvents } from '../lib/events';
import { 
  Wallet, Activity, CreditCard, Coins, Landmark, Sparkles, AlertCircle, Loader2 
} from 'lucide-react';

export default function Dashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  
  // State Finansial Makro
  const [netWorth, setNetWorth] = useState(0);
  const [assets, setAssets] = useState({ liquid: 0, volatile: 0 });
  const [liabilities, setLiabilities] = useState(0);
  
  // State Distribusi Mikro & AI
  const [accounts, setAccounts] = useState([]);
  const [aiInsights, setAiInsights] = useState([]);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);

    try {
      // Fetch Paralel Skala Penuh: Market Price, Akun, dan Analisis AI RPC
      const [marketPrices, { data: accountsData }, { data: insightsData }] = await Promise.all([
        getLivePrices(),
        supabase.from('accounts').select('*').order('type', { ascending: true }),
        supabase.rpc('get_budget_predictive_analysis', { user_id_param: user.id })
      ]);

      // 1. Kalkulasi Aset & Liabilitas
      let liquidIDR = 0;
      let volatileIDR = 0;
      let totalDebt = 0;

      if (accountsData) {
        setAccounts(accountsData); // Simpan untuk UI Distribusi Akun
        
        accountsData.forEach(acc => {
          if (acc.type === 'debt') {
            totalDebt += Math.abs(Number(acc.balance));
          } else {
            liquidIDR += Number(acc.balance);
            if (acc.asset_ticker !== 'IDR' && acc.asset_quantity) {
              const livePrice = marketPrices[acc.asset_ticker] || 0;
              volatileIDR += Number(acc.asset_quantity) * livePrice;
            }
          }
        });
      }

      setAssets({ liquid: liquidIDR, volatile: volatileIDR });
      setLiabilities(totalDebt);
      setNetWorth((liquidIDR + volatileIDR) - totalDebt);

      // 2. Simpan Data AI Insights
      if (insightsData) setAiInsights(insightsData);

    } catch (error) {
      console.error('Kegagalan agregasi data dasbor:', error.message);
    } finally {
      setLoading(false);
    }
  }, [user.id]);

  useEffect(() => {
    fetchDashboardData();
    const unsub = financialEvents.subscribe('data_mutated', fetchDashboardData);
    
    // Keyboard Shortcut 'N' untuk Transaksi Baru
    const handleKeyPress = (e) => {
      if (e.key.toLowerCase() === 'n' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        e.preventDefault();
        window.location.href = '/transaksi';
      }
    };
    window.addEventListener('keydown', handleKeyPress);

    return () => {
      unsub();
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [fetchDashboardData]);

  // Utilitas Pemformatan
  const formatIDR = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(num);

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-64 space-y-4">
        <Loader2 className="animate-spin text-slate-900" size={32} />
        <span className="text-sm font-bold text-slate-500 animate-pulse">Mensinkronkan Valuasi Aset & AI...</span>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12 px-4 md:px-0 animate-in fade-in duration-500">
      
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Kecerdasan Finansial</h1>
          <p className="text-sm text-slate-500">Ringkasan aset, distribusi dompet, dan analisis cerdas.</p>
        </div>
        <kbd className="hidden sm:inline-flex h-6 select-none items-center gap-1 rounded border border-slate-200 bg-white px-2 font-mono text-[10px] font-medium text-slate-400 shadow-sm">
          Tekan <span className="font-bold text-slate-900">N</span> untuk transaksi
        </kbd>
      </div>

      {/* TIER 1: KEKAYAAN BERSIH & HUTANG */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        
        {/* Main Net Worth Card */}
        <div className="md:col-span-8 bg-slate-900 rounded-3xl p-6 sm:p-8 text-white flex flex-col justify-between relative overflow-hidden shadow-lg">
          <div className="relative z-10">
            <p className="text-slate-400 text-sm font-bold tracking-wider uppercase mb-2 flex items-center gap-2"><Wallet size={16}/> Total Kekayaan Bersih</p>
            <h2 className="text-4xl sm:text-5xl font-black tracking-tighter">{formatIDR(netWorth)}</h2>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mt-8 relative z-10 border-t border-slate-700/50 pt-6">
            <div>
              <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1 flex items-center gap-1"><Landmark size={12}/> Aset Liquid (Fiat)</p>
              <p className="text-lg font-bold text-emerald-400">{formatIDR(assets.liquid)}</p>
            </div>
            <div>
              <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1 flex items-center gap-1"><Coins size={12}/> Aset Volatil (Kripto/Emas)</p>
              <p className="text-lg font-bold text-indigo-400">{formatIDR(assets.volatile)}</p>
            </div>
          </div>
          <div className="absolute -right-12 -bottom-12 opacity-10 pointer-events-none">
            <Activity size={250} strokeWidth={1} />
          </div>
        </div>

        {/* Debt / Liabilities Card */}
        <div className="md:col-span-4 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col justify-center">
          <div className="p-3 bg-red-50 text-red-600 rounded-2xl w-fit mb-4">
            <CreditCard size={24} />
          </div>
          <p className="text-slate-500 text-sm font-bold uppercase tracking-wider mb-1">Total Liabilitas</p>
          <h3 className="text-3xl font-black text-slate-900">{formatIDR(liabilities)}</h3>
          <p className="text-xs text-slate-400 mt-2 font-medium">Akumulasi hutang yang memotong kekayaan bersih Anda.</p>
        </div>

      </div>

      {/* TIER 2: DISTRIBUSI AKUN & AI PREDICTIVE (KEMBALI HADIR) */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        
        {/* Distribusi Akun */}
        <div className="md:col-span-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col h-full max-h-[400px]">
          <h3 className="text-base font-bold text-slate-900 mb-4">Distribusi Saldo</h3>
          <div className="space-y-3 overflow-y-auto pr-2 no-scrollbar flex-1">
            {accounts.map(acc => (
              <div key={acc.id} className={`flex justify-between items-center p-3 rounded-xl border ${acc.type === 'debt' ? 'bg-red-50/50 border-red-100' : 'bg-slate-50 border-slate-100'}`}>
                <div>
                  <p className="text-sm font-bold text-slate-800">{acc.name}</p>
                  <p className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider">{acc.type} • {acc.currency}</p>
                </div>
                <div className="text-right">
                  <span className={`text-sm font-extrabold block ${acc.type === 'debt' ? 'text-red-600' : 'text-slate-900'}`}>
                    {formatIDR(Math.abs(acc.balance))}
                  </span>
                  {acc.asset_ticker !== 'IDR' && (
                    <span className="text-[10px] font-bold text-indigo-500">{acc.asset_quantity} {acc.asset_ticker}</span>
                  )}
                </div>
              </div>
            ))}
            {accounts.length === 0 && <p className="text-xs text-slate-400 italic">Belum ada akun dompet.</p>}
          </div>
        </div>

        {/* AI Predictive Analytics */}
        <div className="md:col-span-8 bg-gradient-to-br from-blue-50 via-indigo-50 to-white p-6 rounded-3xl border border-blue-100 shadow-sm flex flex-col h-full max-h-[400px]">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2.5 bg-blue-600 rounded-xl text-white shadow-md shadow-blue-200 flex-shrink-0">
              <Sparkles size={20} className="animate-pulse" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Analisis Proaktif & Deteksi Anomali</h3>
              <p className="text-xs text-slate-500">Algoritma AI memetakan proyeksi pengeluaran (*burn rate*) Anda hingga akhir bulan.</p>
            </div>
          </div>

          <div className="overflow-y-auto pr-2 no-scrollbar flex-1 space-y-3">
            {aiInsights.length === 0 ? (
              <div className="flex items-center justify-center h-full text-sm text-slate-500 italic py-6">
                Tidak ada anomali atau data anggaran pengeluaran bulan ini.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {aiInsights.map((insight, i) => (
                  <div key={i} className={`p-4 rounded-2xl border flex gap-3 items-start transition-all ${
                    insight.is_anomaly ? 'bg-red-50/70 border-red-100 text-red-900' : 'bg-white border-slate-200 text-slate-700'
                  }`}>
                    <AlertCircle size={18} className={`flex-shrink-0 mt-0.5 ${insight.is_anomaly ? 'text-red-500' : 'text-emerald-500'}`} />
                    <div className="space-y-1">
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{insight.category_name}</p>
                      <p className="text-sm font-medium leading-snug">{insight.ai_warning_message}</p>
                      <div className="flex gap-4 pt-2 text-[11px] font-semibold text-slate-400 border-t border-slate-100 mt-2">
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