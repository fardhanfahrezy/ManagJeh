import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { queueOfflineAction } from '../lib/db';
import { Loader2, Settings2 } from 'lucide-react';
import Kategori from '../components/Kategori'; 
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ==============================================================================
// SKELETON: Transaksi
// ==============================================================================
const TransaksiSkeleton = () => (
  <div className="max-w-3xl mx-auto space-y-6 pb-12 animate-pulse w-full">
    <div className="flex justify-between items-end">
      <div className="space-y-3">
        <div className="h-8 bg-slate-200 rounded-xl w-48"></div>
        <div className="h-4 bg-slate-200 rounded-lg w-72"></div>
      </div>
    </div>
    <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
      <div className="flex gap-2 rounded-2xl bg-slate-100 p-1.5 h-12">
        <div className="flex-1 bg-white rounded-xl shadow-sm"></div>
        <div className="flex-1 bg-transparent rounded-xl"></div>
        <div className="flex-1 bg-transparent rounded-xl"></div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="space-y-2"><div className="h-4 w-24 bg-slate-200 rounded"></div><div className="h-12 w-full bg-slate-100 rounded-xl"></div></div>
        <div className="space-y-2"><div className="h-4 w-32 bg-slate-200 rounded"></div><div className="h-12 w-full bg-slate-100 rounded-xl"></div></div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="space-y-2"><div className="h-4 w-32 bg-slate-200 rounded"></div><div className="h-12 w-full bg-slate-100 rounded-xl"></div></div>
        <div className="space-y-2"><div className="h-4 w-28 bg-slate-200 rounded"></div><div className="h-12 w-full bg-slate-100 rounded-xl"></div></div>
      </div>
      <div className="space-y-2">
        <div className="h-4 w-32 bg-slate-200 rounded"></div>
        <div className="h-20 w-full bg-slate-100 rounded-xl"></div>
      </div>
      <div className="h-14 w-full bg-slate-200 rounded-xl"></div>
    </div>
  </div>
);

export default function Transaksi() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [transferToAccountId, setTransferToAccountId] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [message, setMessage] = useState({ type: '', text: '' });
  const [showCatManager, setShowCatManager] = useState(false);

  const { data: masterData, isLoading: loadingDropdowns, refetch: refetchMaster } = useQuery({
    queryKey: ['masterData', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const [acctsRes, catsRes] = await Promise.all([
        supabase.from('accounts').select('id, name, balance, type').order('type', { ascending: true }),
        supabase.from('categories').select('id, name, type, color_code, budget_limit').order('name')
      ]);
      if (acctsRes.error) throw acctsRes.error;
      if (catsRes.error) throw catsRes.error;
      return { accounts: acctsRes.data, categories: catsRes.data };
    }
  });

  const accounts = masterData?.accounts || [];
  const categories = masterData?.categories || [];

  useEffect(() => {
    if (accounts.length > 0 && !accountId) {
      setAccountId(accounts[0].id);
      if (accounts.length > 1) setTransferToAccountId(accounts[1].id);
    }
  }, [accounts, accountId]);

  useEffect(() => {
    if (type !== 'transfer' && categories.length > 0) {
      const validCats = categories.filter(c => c.type === type);
      const isCurrentValid = validCats.find(c => c.id === categoryId);
      if (!isCurrentValid) setCategoryId(validCats.length > 0 ? validCats[0].id : '');
    }
  }, [type, categories, categoryId]);

  const transactionMutation = useMutation({
    networkMode: 'always', // Memaksa TanStack Query tetap mengeksekusi mutationFn meski offline
    mutationFn: async (payload) => {
      // 1. Pastikan setiap transaksi memiliki UUID final sejak awal 
      const finalPayload = {
        ...payload,
        id: payload.id || crypto.randomUUID(),
        user_id: user?.id
      };

      if (!navigator.onLine) {
        // PERBAIKAN: Gunakan finalPayload.id dan finalPayload, BUKAN payload mentah
        await queueOfflineAction('INSERT', finalPayload.id, user?.id, finalPayload);
        return 'offline';
      }

      const { error } = await supabase.from('transactions').insert([finalPayload]);
      if (error) throw error;
      return 'online';
    },
    onSuccess: (status) => {
      setMessage({ type: 'success', text: status === 'offline' ? 'Tersimpan lokal (Offline Mode).' : 'Transaksi berhasil dicatat.' });
      setAmount(''); 
      setDescription('');
      queryClient.invalidateQueries({ queryKey: ['dashboardData'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
    onError: (err) => setMessage({ type: 'error', text: err.message || 'Kesalahan Server.' })
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });
    const baseAmount = parseFloat(amount) || 0;
    if (baseAmount <= 0) return;

    const transactionPayload = {
      category_id: type === 'transfer' ? null : categoryId,
      account_id: accountId,
      transfer_to_account_id: type === 'transfer' ? transferToAccountId : null,
      amount: baseAmount,
      type: type,
      description: description.trim() || null,
      date: new Date(date).toISOString(),
    };
    transactionMutation.mutate(transactionPayload);
  };

  const isSubmitting = transactionMutation.isPending;

  if (loadingDropdowns) return <TransaksiSkeleton />;

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Pusat Transaksi</h1>
          <p className="text-sm text-slate-500">Catat pemasukan, pengeluaran, dan transfer Anda di sini.</p>
        </div>
      </div>

      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
        
        {message.text && (
          <div className={`mb-6 p-4 rounded-xl text-sm font-semibold border ${ message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200' }`}>
            <span>{message.text}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
          <div className="flex gap-1.5 sm:gap-2 rounded-2xl bg-slate-100 p-1.5 shadow-inner overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {['expense', 'income', 'transfer'].map((t) => (
              <button key={t} type="button" onClick={() => setType(t)} className={`whitespace-nowrap flex-1 min-w-[100px] px-3 py-2.5 text-xs sm:text-sm font-bold rounded-xl cursor-pointer transition-all ${ type === t ? 'bg-white shadow-sm text-slate-900 font-extrabold' : 'text-slate-500 hover:text-slate-800' }`}>
                {t === 'expense' ? 'Pengeluaran' : t === 'income' ? 'Pemasukan' : 'Transfer'}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label htmlFor="amount-input" className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Nominal (Rp)</label>
              <input id="amount-input" type="number" required value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full px-4 py-3 border border-slate-300 rounded-xl outline-none transition-all text-lg font-black focus:ring-2 focus:ring-slate-900" placeholder="0" disabled={isSubmitting} />
            </div>
            <div>
              <label htmlFor="account-select" className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">{type === 'transfer' ? 'Dari Rekening' : 'Sumber Dompet'}</label>
              <select id="account-select" required value={accountId} onChange={(e) => setAccountId(e.target.value)} className="w-full px-4 py-3 border border-slate-300 rounded-xl bg-white text-sm font-semibold outline-none focus:ring-2 focus:ring-slate-900" disabled={isSubmitting}>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({new Intl.NumberFormat('id-ID').format(acc.balance)})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {type === 'transfer' ? (
              <div>
                <label htmlFor="transfer-select" className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Ke Rekening Tujuan</label>
                <select id="transfer-select" required value={transferToAccountId} onChange={(e) => setTransferToAccountId(e.target.value)} className="w-full px-4 py-3 border border-slate-300 rounded-xl bg-white text-sm font-semibold outline-none focus:ring-2 focus:ring-slate-900" disabled={isSubmitting}>
                  {accounts.map((acc) => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                </select>
              </div>
            ) : (
              <div>
                <label htmlFor="category-select" className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Kategori Laporan</label>
                <div className="flex gap-2">
                  <select id="category-select" required value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="flex-1 px-4 py-3 border border-slate-300 rounded-xl bg-white text-sm font-semibold outline-none focus:ring-2 focus:ring-slate-900" disabled={isSubmitting}>
                    {categories.filter((cat) => cat.type === type).map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                  <button type="button" onClick={() => setShowCatManager(true)} className="px-4 py-3 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-colors outline-none focus:ring-2 focus:ring-slate-300" title="Kelola Kategori">
                    <Settings2 size={20} />
                  </button>
                </div>
              </div>
            )}
            <div>
              <label htmlFor="date-input" className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Tanggal Efektif</label>
              <input id="date-input" type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-slate-900" disabled={isSubmitting} />
            </div>
          </div>

          <div>
            <label htmlFor="description-input" className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Catatan Transaksi</label>
            <textarea id="description-input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm font-semibold outline-none resize-none transition-all focus:ring-2 focus:ring-slate-900" placeholder="Keterangan tambahan atau nama toko..." disabled={isSubmitting} />
          </div>

          <button type="submit" disabled={isSubmitting || accounts.length === 0} className="w-full bg-slate-900 text-white font-black py-4 rounded-xl hover:bg-slate-800 focus:ring-4 focus:ring-slate-200 transition-all text-sm cursor-pointer disabled:opacity-50 outline-none">
            {isSubmitting ? <Loader2 className="animate-spin mx-auto" size={20} /> : 'SIMPAN TRANSAKSI'}
          </button>
        </form>
      </div>

      <Kategori 
        isOpen={showCatManager} 
        onClose={() => setShowCatManager(false)} 
        type={type} 
        categories={categories} 
        onCategoryUpdate={() => refetchMaster()} 
      />
    </div>
  );
}