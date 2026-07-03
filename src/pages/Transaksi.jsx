import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Loader2, CheckCircle, Trash2, Repeat } from 'lucide-react';
import { financialEvents } from '../lib/events';

export default function Transaksi() {
  const { user } = useAuth();
  
  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  
  // State baru untuk Transaksi Berulang
  const [isRecurring, setIsRecurring] = useState(false);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const fetchRecentTransactions = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select(`id, amount, type, description, date, categories (name, color_code)`)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      setRecentTransactions(data || []);
    } catch (error) {
      console.error('Gagal mengambil riwayat:', error.message);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => { fetchRecentTransactions(); }, [fetchRecentTransactions]);

  useEffect(() => {
    let isMounted = true;
    const fetchCategories = async () => {
      setLoadingCategories(true);
      try {
        const { data, error } = await supabase
          .from('categories')
          .select('id, name')
          .eq('type', type)
          .order('name', { ascending: true });

        if (error) throw error;
        if (isMounted) {
          setCategories(data || []);
          if (data && data.length > 0) setCategoryId(data[0].id);
        }
      } catch (error) {
        console.error('Kategori error:', error.message);
      } finally {
        if (isMounted) setLoadingCategories(false);
      }
    };
    fetchCategories();
    return () => { isMounted = false; };
  }, [type]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage({ type: '', text: '' });

    const numericAmount = parseFloat(amount.replace(/[^0-9]/g, ''));
    if (!numericAmount || numericAmount <= 0) {
      setMessage({ type: 'error', text: 'Nominal tidak valid.' });
      setIsSubmitting(false);
      return;
    }

    try {
      // 1. Catat Transaksi Saat Ini (Current Execution)
      const { error: txError } = await supabase
        .from('transactions')
        .insert([{
          user_id: user.id,
          category_id: categoryId,
          amount: numericAmount,
          type: type,
          description: description.trim() || null,
          date: new Date(date).toISOString(),
        }]);

      if (txError) throw txError;

      // 2. Jika Recurring, daftarkan jadwal ke Cron Job Database
      if (isRecurring) {
        // Hitung tanggal bulan depan secara akurat
        const nextMonthDate = new Date(date);
        nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);

        const { error: recurError } = await supabase
          .from('recurring_schedules')
          .insert([{
            user_id: user.id,
            category_id: categoryId,
            amount: numericAmount,
            type: type,
            description: description.trim() || null,
            frequency: 'monthly',
            next_run_date: nextMonthDate.toISOString().split('T')[0]
          }]);

        if (recurError) throw recurError;
      }

      setMessage({ type: 'success', text: isRecurring ? 'Transaksi dicatat & dijadwalkan bulanan!' : 'Transaksi berhasil dicatat!' });
      // Memicu sinyal global bahwa data finansial telah bermutasi
      financialEvents.emit('data_mutated');
      
      setAmount('');
      setDescription('');
      setIsRecurring(false); // Reset state
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);

      fetchRecentTransactions();
    } catch (error) {
      setMessage({ type: 'error', text: 'Kesalahan eksekusi database.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Hapus transaksi ini secara permanen?')) return;
    try {
      const { error } = await supabase.from('transactions').delete().eq('id', id);
      if (error) throw error;
      setRecentTransactions(prev => prev.filter(tx => tx.id !== id));
    } catch (error) {
      alert('Gagal menghapus: ' + error.message);
    }
  };

  const formatRupiah = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);

  return (
    <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      <div className="lg:col-span-2">
        <h1 className="text-2xl font-bold text-slate-900 mb-6">Catat Transaksi</h1>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          {message.text && (
            <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
              message.type === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
            } border`}>
              {message.type === 'success' && <CheckCircle size={20} />}
              <span className="font-medium">{message.text}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex rounded-lg bg-slate-100 p-1">
              <button type="button" onClick={() => setType('expense')} className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${type === 'expense' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}>Pengeluaran</button>
              <button type="button" onClick={() => setType('income')} className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${type === 'income' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>Pemasukan</button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nominal (Rp)</label>
                <input type="number" min="0" required value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 outline-none" disabled={isSubmitting} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Kategori</label>
                <select required value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 outline-none bg-white" disabled={loadingCategories || isSubmitting}>
                  {loadingCategories ? <option>Memuat...</option> : categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tanggal Eksekusi</label>
              <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 outline-none" disabled={isSubmitting} />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Catatan</label>
              <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 outline-none resize-none" disabled={isSubmitting} />
            </div>

            {/* Opsi Otomatisasi (UI Clean) */}
            <label className="flex items-center gap-3 p-4 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
              <input 
                type="checkbox" 
                checked={isRecurring} 
                onChange={(e) => setIsRecurring(e.target.checked)} 
                className="w-5 h-5 text-slate-900 rounded focus:ring-slate-900 cursor-pointer"
                disabled={isSubmitting}
              />
              <div className="flex flex-col">
                <span className="text-sm font-bold text-slate-900 flex items-center gap-1.5"><Repeat size={16}/> Jadikan Transaksi Bulanan</span>
                <span className="text-xs text-slate-500">Sistem akan otomatis mencatat tagihan/pemasukan ini setiap bulan.</span>
              </div>
            </label>

            <button type="submit" disabled={isSubmitting || categories.length === 0} className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white font-semibold py-3 rounded-lg hover:bg-slate-800 transition-all disabled:opacity-50">
              {isSubmitting ? <><Loader2 size={20} className="animate-spin" /> Menyimpan...</> : 'Simpan Transaksi'}
            </button>
          </form>
        </div>
      </div>

      {/* Kolom Riwayat diabaikan dalam cuplikan penjelasan untuk fokus pada perubahan utama (Kode sudah full) */}
      <div className="lg:col-span-1">
        <h2 className="text-xl font-bold text-slate-900 mb-6 lg:mt-0 mt-8">Riwayat Terakhir</h2>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          {loadingHistory ? (
            <div className="p-6 text-center text-slate-500">Memuat riwayat...</div>
          ) : recentTransactions.length === 0 ? (
            <div className="p-6 text-center text-slate-500 text-sm">Belum ada transaksi.</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {recentTransactions.map((tx) => (
                <li key={tx.id} className="p-4 hover:bg-slate-50 group flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: tx.categories?.color_code || '#ccc' }} />
                      <p className="text-sm font-semibold text-slate-900 truncate">{tx.categories?.name || 'Kategori Dihapus'}</p>
                    </div>
                    <p className="text-xs text-slate-500 truncate">
                      {new Date(tx.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} 
                      {tx.description && ` • ${tx.description}`}
                    </p>
                  </div>
                  <div className="text-right ml-4 flex items-center gap-3">
                    <span className={`text-sm font-bold ${tx.type === 'income' ? 'text-blue-600' : 'text-slate-900'}`}>
                      {tx.type === 'income' ? '+' : '-'}{formatRupiah(tx.amount)}
                    </span>
                    <button onClick={() => handleDelete(tx.id)} className="text-slate-400 hover:text-red-600 p-1 opacity-0 group-hover:opacity-100 transition-all outline-none"><Trash2 size={16} /></button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}