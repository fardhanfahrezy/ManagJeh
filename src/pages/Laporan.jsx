// src/pages/Laporan.jsx
import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { formatIDR } from '../lib/utils';
import { useQuery } from '@tanstack/react-query';
import { Loader2, PieChart, TrendingUp, TrendingDown, Wallet, CalendarRange, Download } from 'lucide-react';

// ==============================================================================
// SKELETON: Laporan Finansial
// ==============================================================================
const LaporanSkeleton = () => (
  <div className="max-w-5xl mx-auto space-y-8 px-4 pb-12 animate-pulse w-full">
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div className="space-y-3">
        <div className="h-8 bg-slate-200 rounded-xl w-56"></div>
        <div className="h-4 bg-slate-200 rounded-lg w-72"></div>
      </div>
      <div className="h-10 w-48 bg-white border border-slate-200 rounded-xl"></div>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
      {[1, 2, 3].map((i) => (
        <div key={i} className={`p-6 rounded-3xl border shadow-sm ${i===3 ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
          <div className={`h-3 w-32 rounded mb-3 ${i===3 ? 'bg-slate-600' : 'bg-slate-200'}`}></div>
          <div className={`h-8 w-40 rounded-lg ${i===3 ? 'bg-slate-700' : 'bg-slate-200'}`}></div>
        </div>
      ))}
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
        <div className="h-6 w-48 bg-slate-200 rounded-lg"></div>
        <div className="space-y-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <div className="flex justify-between"><div className="h-4 w-24 bg-slate-200 rounded"></div><div className="h-4 w-32 bg-slate-200 rounded"></div></div>
              <div className="h-3 w-full bg-slate-100 rounded-full"></div>
            </div>
          ))}
        </div>
      </div>
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col h-[400px]">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
          <div className="space-y-2"><div className="h-6 w-32 bg-slate-200 rounded-lg"></div><div className="h-3 w-48 bg-slate-200 rounded"></div></div>
          <div className="h-10 w-28 bg-slate-200 rounded-xl"></div>
        </div>
        <div className="p-4 space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex justify-between items-center">
              <div className="space-y-2"><div className="h-4 w-28 bg-slate-200 rounded"></div><div className="h-3 w-16 bg-slate-200 rounded"></div></div>
              <div className="h-5 w-24 bg-slate-200 rounded-lg"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

export default function Laporan() {
  const { user } = useAuth();
  
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

  const dateRange = JSON.stringify({ month: currentMonth, year: currentYear });
  
  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['reportTransactions', user?.id, dateRange],
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 3, // Bertahan di memori selama 3 menit
    queryFn: async () => {
      const startDate = new Date(currentYear, currentMonth, 1, 0, 0, 0).toISOString();
      const endDate = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999).toISOString();

      const { data, error } = await supabase
        .from('transactions')
        .select(`id, amount, type, date, description, categories (name, color_code)`)
        .eq('user_id', user.id)
        .gte('date', startDate)
        .lte('date', endDate)
        .is('deleted_at', null)
        .order('date', { ascending: false });

      if (error) throw error;
      return data || [];
    }
  });

  const reportSummary = (() => {
    let income = 0;
    let expense = 0;
    const categoryMap = {};

    transactions.forEach(tx => {
      const amt = Number(tx.amount);
      if (tx.type === 'income') {
        income += amt;
      } else if (tx.type === 'expense') {
        expense += amt;
        const catName = tx.categories?.name || 'Lainnya';
        if (!categoryMap[catName]) {
          categoryMap[catName] = { name: catName, total: 0, color: tx.categories?.color_code || '#64748b' };
        }
        categoryMap[catName].total += amt;
      }
    });

    return {
      income,
      expense,
      categoryBreakdown: Object.values(categoryMap).sort((a, b) => b.total - a.total)
    };
  })();

  const handleExportCSV = () => {
    if (transactions.length === 0) return;

    let csvContent = '\uFEFFTanggal,Tipe,Kategori,Nominal,Catatan\n'; 
    transactions.forEach(tx => {
      const date = new Date(tx.date).toLocaleDateString('id-ID');
      const type = tx.type === 'income' ? 'Pemasukan' : tx.type === 'expense' ? 'Pengeluaran' : 'Transfer';
      const category = tx.categories?.name || 'Tanpa Kategori';
      csvContent += `${date},${type},${category},${tx.amount},"${(tx.description || '-').replace(/"/g, '""')}"\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `Laporan_Keuangan_ManagJeh_${monthNames[currentMonth]}_${currentYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(prev => prev - 1); } 
    else { setCurrentMonth(prev => prev - 1); }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(prev => prev + 1); } 
    else { setCurrentMonth(prev => prev + 1); }
  };

  if (isLoading) return <LaporanSkeleton />;

  return (
    <div className="max-w-5xl mx-auto space-y-8 px-4 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <PieChart size={28} /> Analitik Finansial
          </h1>
          <p className="text-sm text-slate-500 mt-1">Evaluasi arus kas dan ekspor riwayat transaksi Anda.</p>
        </div>

        <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
          <button onClick={handlePrevMonth} className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-colors">&laquo;</button>
          <div className="px-4 py-1.5 font-bold text-sm text-slate-800 flex items-center gap-2 min-w-[140px] justify-center">
            <CalendarRange size={16} /> {monthNames[currentMonth]} {currentYear}
          </div>
          <button onClick={handleNextMonth} className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-colors">&raquo;</button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2"><TrendingUp size={16} className="text-emerald-500"/> Total Pemasukan</p>
          <h3 className="text-2xl font-black text-slate-900">{formatIDR(reportSummary.income)}</h3>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2"><TrendingDown size={16} className="text-red-500"/> Total Pengeluaran</p>
          <h3 className="text-2xl font-black text-slate-900">{formatIDR(reportSummary.expense)}</h3>
        </div>
        <div className={`p-6 rounded-3xl shadow-sm border ${ (reportSummary.income - reportSummary.expense) >= 0 ? 'bg-slate-900 border-slate-800 text-white' : 'bg-red-50 border-red-200 text-red-900' }`}>
          <p className="text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2 opacity-80"><Wallet size={16}/> Surplus / Defisit</p>
          <h3 className="text-2xl font-black">{formatIDR(reportSummary.income - reportSummary.expense)}</h3>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-6">Distribusi Pengeluaran</h3>
          {reportSummary.categoryBreakdown.length === 0 ? (
             <div className="h-48 flex items-center justify-center text-slate-400 text-sm italic">Tidak ada data pengeluaran bulan ini.</div>
          ) : (
            <div className="space-y-5">
              {reportSummary.categoryBreakdown.map((cat, idx) => {
                const percentage = reportSummary.expense > 0 ? ((cat.total / reportSummary.expense) * 100).toFixed(1) : 0;
                return (
                  <div key={idx} className="space-y-2">
                    <div className="flex justify-between items-end text-sm">
                      <span className="font-bold text-slate-800">{cat.name}</span>
                      <span className="font-black text-slate-900">{formatIDR(cat.total)} <span className="font-normal text-slate-500 text-xs ml-1">({percentage}%)</span></span>
                    </div>
                    <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${percentage}%`, backgroundColor: cat.color }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col max-h-[500px]">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Histori Transaksi</h3>
              <p className="text-xs text-slate-500">Aliran dana keluar/masuk bulan ini.</p>
            </div>
            <button
              onClick={handleExportCSV}
              disabled={transactions.length === 0}
              className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-slate-800 transition-all disabled:opacity-50 strategy-focus"
            >
              <Download size={16} />
              <span className="hidden sm:inline">Unduh CSV</span>
            </button>
          </div>
          <div className="overflow-y-auto flex-1 p-4 space-y-2 scrollbar-thin">
            {transactions.map(tx => (
              <div key={tx.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex justify-between items-center">
                <div>
                  <p className="text-sm font-bold text-slate-900 capitalize">{tx.type === 'transfer' ? 'Transfer / Mutasi' : tx.categories?.name || 'Lainnya'}</p>
                  <p className="text-xs text-slate-400">{new Date(tx.date).toLocaleDateString('id-ID')}</p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-black ${tx.type === 'expense' ? 'text-slate-900' : 'text-emerald-600'}`}>
                    {tx.type === 'expense' ? '-' : '+'}{formatIDR(tx.amount)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}