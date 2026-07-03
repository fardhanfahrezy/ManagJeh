import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Loader2, Download, Search, Filter } from 'lucide-react';

export default function Laporan() {
  const currentDate = new Date();
  
  // State Filter
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth());
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  
  // State Data
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);

  // Opsi Filter Tahun (5 tahun terakhir)
  const years = Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - i);
  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  // Fungsi Fetch Data berdasarkan Bulan & Tahun
  const fetchReportData = useCallback(async () => {
    setLoading(true);
    try {
      // Tentukan batas awal dan akhir bulan yang dipilih
      const startDate = new Date(selectedYear, selectedMonth, 1).toISOString();
      const endDate = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59, 999).toISOString();

      const { data, error } = await supabase
        .from('transactions')
        .select(`
          id, amount, type, description, date,
          categories (name, color_code)
        `)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false });

      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      console.error('Gagal mengambil data laporan:', error.message);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, selectedYear]);

  // Trigger fetch setiap kali filter bulan/tahun berubah
  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  // Kalkulasi Ringkasan (Di-memoize untuk performa)
  const summary = useMemo(() => {
    return transactions.reduce((acc, tx) => {
      const amount = Number(tx.amount);
      if (tx.type === 'income') {
        acc.income += amount;
        acc.balance += amount;
      } else {
        acc.expense += amount;
        acc.balance -= amount;
      }
      return acc;
    }, { income: 0, expense: 0, balance: 0 });
  }, [transactions]);

  // Utility Format Rupiah
  const formatRupiah = (number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(number);
  };
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
  };

  // Logika Ekspor Native ke CSV (Optimasi Performa Klien)
  const handleExportCSV = () => {
    if (transactions.length === 0) return alert('Tidak ada data untuk diekspor.');

    // 1. Buat Header CSV
    let csvContent = 'Tanggal,Tipe,Kategori,Nominal,Catatan\n';

    // 2. Rangkai Data (Lakukan sanitasi pada koma di catatan)
    transactions.forEach(tx => {
      const date = new Date(tx.date).toLocaleDateString('id-ID');
      const type = tx.type === 'income' ? 'Pemasukan' : 'Pengeluaran';
      const category = tx.categories?.name || 'Kategori Terhapus';
      const amount = tx.amount;
      // Hapus enter dan escape karakter koma agar tidak merusak kolom CSV
      const notes = tx.description ? `"${tx.description.replace(/\n/g, ' ').replace(/"/g, '""')}"` : '-';
      
      csvContent += `${date},${type},${category},${amount},${notes}\n`;
    });

    // 3. Buat Blob dan Trigger Download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `Laporan_Keuangan_${months[selectedMonth]}_${selectedYear}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Laporan Keuangan</h1>
          <p className="text-gray-500 text-sm mt-1">Analisis dan unduh riwayat transaksi Anda.</p>
        </div>
        
        {/* Kontrol Filter */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none appearance-none bg-white font-medium text-gray-700"
            >
              {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
          </div>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium text-gray-700"
          >
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Kartu Ringkasan Laporan */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <p className="text-sm font-medium text-gray-500 mb-1">Total Pemasukan</p>
          <p className="text-xl font-bold text-green-600">{formatRupiah(summary.income)}</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <p className="text-sm font-medium text-gray-500 mb-1">Total Pengeluaran</p>
          <p className="text-xl font-bold text-red-600">{formatRupiah(summary.expense)}</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <p className="text-sm font-medium text-gray-500 mb-1">Surplus/Defisit Bersih</p>
          <p className={`text-xl font-bold ${summary.balance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
            {summary.balance > 0 ? '+' : ''}{formatRupiah(summary.balance)}
          </p>
        </div>
      </div>

      {/* Tabel Data & Tombol Export */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50/50">
          <h2 className="text-lg font-semibold text-gray-800">Rincian Transaksi</h2>
          <button
            onClick={handleExportCSV}
            disabled={transactions.length === 0 || loading}
            className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            <Download size={16} />
            <span className="hidden sm:inline">Unduh CSV</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex justify-center p-12 text-blue-600">
              <Loader2 size={32} className="animate-spin" />
            </div>
          ) : transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-gray-500 text-center">
              <Search size={40} className="text-gray-300 mb-3" />
              <p className="font-medium text-gray-900">Tidak ada transaksi</p>
              <p className="text-sm">Tidak ada data keuangan pada bulan dan tahun yang dipilih.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white border-b border-gray-200 text-xs uppercase tracking-wider text-gray-500">
                  <th className="p-4 font-medium">Tanggal</th>
                  <th className="p-4 font-medium">Kategori</th>
                  <th className="p-4 font-medium">Catatan</th>
                  <th className="p-4 font-medium text-right">Nominal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="p-4 text-gray-600 whitespace-nowrap">{formatDate(tx.date)}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: tx.categories?.color_code || '#ccc' }} />
                        <span className="font-medium text-gray-900">{tx.categories?.name || 'Kategori Terhapus'}</span>
                      </div>
                    </td>
                    <td className="p-4 text-gray-500 max-w-xs truncate" title={tx.description}>
                      {tx.description || '-'}
                    </td>
                    <td className={`p-4 text-right font-bold whitespace-nowrap ${tx.type === 'income' ? 'text-green-600' : 'text-gray-900'}`}>
                      {tx.type === 'income' ? '+' : '-'}{formatRupiah(tx.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}