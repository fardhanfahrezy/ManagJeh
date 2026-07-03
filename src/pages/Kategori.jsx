import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Loader2, Plus, Trash2, CheckCircle, AlertCircle } from 'lucide-react';

export default function Kategori() {
  const { user } = useAuth();
  
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [name, setName] = useState('');
  const [type, setType] = useState('expense');
  const [colorCode, setColorCode] = useState('#1E293B');
  const [budgetLimit, setBudgetLimit] = useState(''); // State Anggaran Baru
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('type', { ascending: false })
        .order('name', { ascending: true });

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Gagal:', error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage({ type: '', text: '' });

    const sanitizedName = name.trim();
    // Sanitasi input budget (default ke 0 jika kosong)
    const numericBudget = budgetLimit ? parseFloat(budgetLimit.replace(/[^0-9]/g, '')) : 0;

    try {
      const { error } = await supabase.from('categories').insert([{
        user_id: user.id,
        name: sanitizedName,
        type: type,
        color_code: colorCode,
        budget_limit: numericBudget
      }]);

      if (error) throw error;

      setMessage({ type: 'success', text: 'Kategori berhasil ditambahkan.' });
      setName('');
      setBudgetLimit('');
      fetchCategories();
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (error) {
      setMessage({ type: 'error', text: error.code === '23505' ? 'Kategori sudah ada.' : error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Hapus kategori ini?')) return;
    try {
      const { error } = await supabase.from('categories').delete().eq('id', id);
      if (error) throw error;
      setCategories(prev => prev.filter(c => c.id !== id));
    } catch (error) {
      alert('Gagal: Kategori ini sedang digunakan pada transaksi Anda.');
    }
  };

  const formatRupiah = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);

  return (
    <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-1">
        <h1 className="text-2xl font-bold text-slate-900 mb-6">Kelola Kategori</h1>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Tipe Kategori</label>
              <div className="flex rounded-lg bg-slate-100 p-1">
                <button type="button" onClick={() => setType('expense')} className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${type === 'expense' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}>Pengeluaran</button>
                <button type="button" onClick={() => setType('income')} className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${type === 'income' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>Pemasukan</button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nama</label>
              <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 outline-none" />
            </div>

            {/* Input Limit Anggaran (Hanya muncul jika tipe Pengeluaran) */}
            {type === 'expense' && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                <label className="block text-sm font-medium text-slate-700 mb-1">Batas Anggaran Bulanan (Opsional)</label>
                <input type="number" min="0" value={budgetLimit} onChange={(e) => setBudgetLimit(e.target.value)} placeholder="0 (Tanpa batas)" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 outline-none" />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Warna</label>
              <input type="color" value={colorCode} onChange={(e) => setColorCode(e.target.value)} className="h-10 w-full p-1 border border-slate-300 rounded cursor-pointer" />
            </div>

            <button type="submit" disabled={isSubmitting || !name.trim()} className="w-full bg-slate-900 text-white font-semibold py-2.5 rounded-lg hover:bg-slate-800 transition-all disabled:opacity-50">
              {isSubmitting ? 'Memproses...' : 'Tambah'}
            </button>
          </form>
        </div>
      </div>

      <div className="lg:col-span-2">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100">
            <div>
              <h3 className="px-4 py-3 bg-slate-50 text-sm font-bold text-slate-700 border-b border-slate-100">Pengeluaran & Anggaran</h3>
              <ul className="divide-y divide-slate-50">
                {categories.filter(c => c.type === 'expense').map(cat => (
                  <li key={cat.id} className="p-4 hover:bg-slate-50 flex items-center justify-between group">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color_code }} />
                        <span className="font-medium text-slate-900 truncate">{cat.name}</span>
                      </div>
                      {cat.budget_limit > 0 && (
                        <p className="text-xs text-slate-500 mt-1 ml-6">Batas: {formatRupiah(cat.budget_limit)}</p>
                      )}
                    </div>
                    <button onClick={() => handleDelete(cat.id)} className="text-slate-400 hover:text-red-600 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={16} /></button>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="px-4 py-3 bg-slate-50 text-sm font-bold text-slate-700 border-b border-slate-100">Pemasukan</h3>
              <ul className="divide-y divide-slate-50">
                {categories.filter(c => c.type === 'income').map(cat => (
                  <li key={cat.id} className="p-4 hover:bg-slate-50 flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color_code }} />
                      <span className="font-medium text-slate-900">{cat.name}</span>
                    </div>
                    <button onClick={() => handleDelete(cat.id)} className="text-slate-400 hover:text-red-600 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={16} /></button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}