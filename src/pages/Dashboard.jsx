import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Wallet, TrendingUp, TrendingDown, Loader2, AlertTriangle } from 'lucide-react';
import { financialEvents } from '../lib/events';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line
} from 'recharts';

export default function Dashboard() {
  const { user } = useAuth();
  
  const [summary, setSummary] = useState({ total_balance: 0, monthly_income: 0, monthly_expense: 0 });
  const [currentMonthTransactions, setCurrentMonthTransactions] = useState([]);
  const [netWorthData, setNetWorthData] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch Metrik Utama
      const { data: summaryData } = await supabase.rpc('get_financial_summary', { user_id_param: user.id });
      if (summaryData) setSummary(summaryData);

      // 2. Fetch Net Worth (Akumulasi per bulan dari backend)
      const { data: nwData } = await supabase.rpc('get_monthly_net_worth', { user_id_param: user.id });
      if (nwData) setNetWorthData(nwData);

      // 3. Fetch Transaksi & Relasi Kategori (Termasuk budget_limit baru)
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { data: txData } = await supabase
        .from('transactions')
        .select(`id, amount, type, date, categories(name, color_code, budget_limit)`)
        .gte('date', startOfMonth.toISOString())
        .order('date', { ascending: true });
      
      if (txData) setCurrentMonthTransactions(txData);
    } catch (error) {
      console.error(error.message);
    } finally {
      setLoading(false);
    }
  }, [user.id]);

  useEffect(() => {
    fetchDashboardData();

    // Berlangganan ke event mutasi data global
    const unsubscribe = financialEvents.subscribe('data_mutated', () => {
      fetchDashboardData(); // Perbarui grafik hanya jika ada data yang berubah
    });

    // Putus langganan saat komponen mati untuk mencegah pemborosan RAM
    return () => unsubscribe();
  }, [fetchDashboardData]);

  const formatRupiah = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);

  // Kalkulasi Anggaran (Budgeting Progress)
  const budgetProgress = useMemo(() => {
    const expenses = currentMonthTransactions.filter(tx => tx.type === 'expense' && tx.categories?.budget_limit > 0);
    const grouped = expenses.reduce((acc, tx) => {
      const catName = tx.categories.name;
      if (!acc[catName]) {
        acc[catName] = { 
          name: catName, 
          spent: 0, 
          limit: tx.categories.budget_limit,
          color: tx.categories.color_code
        };
      }
      acc[catName].spent += Number(tx.amount);
      return acc;
    }, {});

    return Object.values(grouped).map(cat => ({
      ...cat,
      percentage: Math.min((cat.spent / cat.limit) * 100, 100),
      isOver: cat.spent >= cat.limit,
      isWarning: (cat.spent / cat.limit) >= 0.8 && cat.spent < cat.limit
    })).sort((a, b) => b.percentage - a.percentage);
  }, [currentMonthTransactions]);

  const dailyFlowData = useMemo(() => {
    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    const flowMap = Array.from({ length: daysInMonth }, (_, i) => ({ day: `${i + 1}`, income: 0, expense: 0 }));
    currentMonthTransactions.forEach(tx => {
      const txDay = new Date(tx.date).getDate() - 1;
      if (tx.type === 'income') flowMap[txDay].income += Number(tx.amount);
      else flowMap[txDay].expense += Number(tx.amount);
    });
    return flowMap;
  }, [currentMonthTransactions]);

  if (loading) return <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin text-slate-900" size={32}/></div>;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard Utama</h1>
          <p className="text-slate-500 text-sm">Visualisasi finansial dan kontrol anggaran.</p>
        </div>
      </div>

      {/* 1. KARTU METRIK */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 p-6 rounded-2xl shadow-sm text-white">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-slate-400 text-sm font-medium">Total Kekayaan Bersih</h3>
            <Wallet size={18} className="text-slate-300" />
          </div>
          <p className="text-3xl font-bold tracking-tight">{formatRupiah(summary.total_balance)}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-slate-500 text-sm font-medium">Pemasukan Bulan Ini</h3>
            <TrendingUp size={18} className="text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{formatRupiah(summary.monthly_income)}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-slate-500 text-sm font-medium">Pengeluaran Bulan Ini</h3>
            <TrendingDown size={18} className="text-slate-900" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{formatRupiah(summary.monthly_expense)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 2. NET WORTH TRACKER (Grafik Kumulatif Utama) */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
          <h3 className="text-base font-bold text-slate-900 mb-4">Tren Pertumbuhan Aset (Net Worth)</h3>
          <div className="h-[250px] w-full mt-auto">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={netWorthData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month_year" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(val) => `Rp${val/1000000}M`} width={60} />
                <Tooltip formatter={(value) => formatRupiah(value)} labelStyle={{ color: '#0f172a', fontWeight: 'bold' }} contentStyle={{ borderRadius: '8px' }} />
                <Line type="monotone" dataKey="cumulative_balance" name="Total Aset" stroke="#0f172a" strokeWidth={3} dot={{ r: 4, fill: '#0f172a' }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 3. BUDGETING SYSTEM (Real-time Peringatan Pemborosan) */}
        <div className="lg:col-span-1 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center justify-between">
            Kontrol Anggaran
            <span className="text-xs font-normal text-slate-500 px-2 py-1 bg-slate-100 rounded-full">{budgetProgress.length} Aktif</span>
          </h3>
          
          {budgetProgress.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-slate-400 py-10 text-center">
              Belum ada transaksi pada kategori yang memiliki batas anggaran.
            </div>
          ) : (
            <div className="space-y-5 overflow-y-auto max-h-[250px] pr-2">
              {budgetProgress.map((budget, i) => (
                <div key={i} className="relative">
                  <div className="flex justify-between items-end mb-1">
                    <span className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
                      {budget.isOver && <AlertTriangle size={14} className="text-red-500" />}
                      {budget.name}
                    </span>
                    <span className="text-xs font-medium text-slate-500">
                      {formatRupiah(budget.spent)} / {formatRupiah(budget.limit)}
                    </span>
                  </div>
                  {/* Progress Bar Track */}
                  <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                    <div 
                      className={`h-2.5 rounded-full transition-all duration-500 ${budget.isOver ? 'bg-red-500' : budget.isWarning ? 'bg-amber-500' : 'bg-slate-800'}`} 
                      style={{ width: `${budget.percentage}%` }}
                    />
                  </div>
                  {budget.isWarning && <p className="text-[10px] mt-1 text-amber-600 font-medium">Hampir melampaui batas!</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 4. ARUS KAS HARIAN BULAN INI (Tetap dipertahankan untuk Detail Mikro) */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
         <h3 className="text-base font-bold text-slate-900 mb-6">Arus Kas Harian (Bulan Berjalan)</h3>
         <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyFlowData} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorInc" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#2563eb" stopOpacity={0.2}/><stop offset="95%" stopColor="#2563eb" stopOpacity={0}/></linearGradient>
                  <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#0f172a" stopOpacity={0.1}/><stop offset="95%" stopColor="#0f172a" stopOpacity={0}/></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                <YAxis hide domain={['auto', 'auto']} />
                <Tooltip formatter={(value) => formatRupiah(value)} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Area type="monotone" dataKey="income" name="Masuk" stroke="#2563eb" strokeWidth={2} fillOpacity={1} fill="url(#colorInc)" />
                <Area type="monotone" dataKey="expense" name="Keluar" stroke="#0f172a" strokeWidth={2} fillOpacity={1} fill="url(#colorExp)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
      </div>
    </div>
  );
}