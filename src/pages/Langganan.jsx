// src/pages/Langganan.jsx
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { formatIDR } from '../lib/utils';
import { Loader2, Calendar, AlertCircle, Trash2, CheckCircle, Power, Plus, Layers, CreditCard, Settings2, Repeat } from 'lucide-react';
import ModalConfirm from '../components/ModalConfirm';
import Kategori from '../components/Kategori';

// ==============================================================================
// SKELETON: Langganan
// ==============================================================================
const LanggananSkeleton = () => (
  <div className="max-w-5xl mx-auto space-y-6 pb-12 px-4 md:px-0 animate-pulse w-full">
    <div className="space-y-2">
      <div className="h-8 bg-slate-200 rounded-xl w-64"></div>
      <div className="h-4 bg-slate-200 rounded-lg w-80"></div>
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
      <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 h-[300px]"></div>
      <div className="bg-white border border-slate-200 rounded-3xl h-[450px]"></div>
    </div>
  </div>
);

export default function Langganan() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // === STATE FORM JADWAL BARU ===
  const [financialFlow, setFinancialFlow] = useState('expense');
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [frequency, setFrequency] = useState('monthly');
  const [nextRunDate, setNextRunDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');

  // === STATE MODAL & FLASH MESSAGE ===
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, id: null, description: '' });
  const [uiMessage, setUiMessage] = useState({ type: '', text: '' });
  const [showCatManager, setShowCatManager] = useState(false);

  // === FETCH DATA MASTER ===
  const { data: masterData, isLoading: isLoadingMaster, refetch: refetchMaster } = useQuery({
    queryKey: ['masterDataLangganan', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const [acctsRes, catsRes] = await Promise.all([
        supabase.from('accounts').select('id, name, balance').order('name'),
        supabase.from('categories').select('id, name, type').order('name')
      ]);
      if (acctsRes.error) throw acctsRes.error;
      if (catsRes.error) throw catsRes.error;
      return { accounts: acctsRes.data, categories: catsRes.data };
    }
  });

  const accounts = masterData?.accounts || [];
  const categories = masterData?.categories || [];

  useEffect(() => {
    if (accounts.length > 0 && !accountId) setAccountId(accounts[0].id);
  }, [accounts, accountId]);

  useEffect(() => {
    // Isolasi untuk tipe otomasi/langganan
    const autoCats = categories.filter(c => c.type === 'otomasi');
    if (autoCats.length > 0) {
      const isCurrentValid = autoCats.find(c => c.id === categoryId);
      if (!isCurrentValid) setCategoryId(autoCats[0].id);
    } else {
      setCategoryId('');
    }
  }, [categories, categoryId]);

  // === FETCH DATA JADWAL LANGGANAN ===
  const { data: schedules = [], isLoading: isLoadingSchedules, isError } = useQuery({
    queryKey: ['recurringSchedules', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recurring_schedules')
        .select(`id, amount, type, description, frequency, next_run_date, is_active, categories (name, color_code), accounts (name)`)
        .order('next_run_date', { ascending: true });
      if (error) throw error;
      return data || [];
    }
  });

  // === MUTATIONS ===
  const createScheduleMutation = useMutation({
    mutationFn: async (payload) => {
      if (!navigator.onLine) throw new Error('Koneksi internet diperlukan untuk membuat jadwal langganan.');
      const { error } = await supabase.from('recurring_schedules').insert([payload]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurringSchedules', user?.id] });
      triggerUiFlash('success', 'Jadwal langganan berhasil ditambahkan.');
      setAmount('');
      setDescription('');
    },
    onError: (err) => triggerUiFlash('error', err.message)
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, currentStatus }) => {
      if (!navigator.onLine) throw new Error('Koneksi terputus.');
      const { error } = await supabase.from('recurring_schedules').update({ is_active: !currentStatus }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurringSchedules', user?.id] });
      triggerUiFlash('success', 'Status langganan diperbarui.');
    },
    onError: (err) => triggerUiFlash('error', err.message)
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      if (!navigator.onLine) throw new Error('Koneksi terputus.');
      const { error } = await supabase.from('recurring_schedules').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurringSchedules', user?.id] });
      triggerUiFlash('success', 'Jadwal langganan berhasil dihapus.');
    },
    onError: (err) => triggerUiFlash('error', err.message)
  });

  // === HANDLERS ===
  const handleCreateSchedule = (e) => {
    e.preventDefault();
    const numericAmount = parseFloat(amount) || 0;
    if (numericAmount <= 0) return triggerUiFlash('error', 'Nominal wajib lebih dari 0.');
    if (!categoryId || !accountId) return triggerUiFlash('error', 'Kategori dan Dompet wajib dipilih.');

    createScheduleMutation.mutate({
      account_id: accountId,
      category_id: categoryId,
      amount: numericAmount,
      type: financialFlow,
      description: description.trim() || null,
      frequency: frequency,
      next_run_date: nextRunDate,
      is_active: true
    });
  };

  const triggerUiFlash = (type, text) => {
    setUiMessage({ type, text });
    setTimeout(() => setUiMessage({ type: '', text: '' }), 4000);
  };

  const mapFreqString = (freq) => {
    const map = { 'daily': 'Harian', 'weekly': 'Mingguan', 'monthly': 'Bulanan', 'yearly': 'Tahunan' };
    return map[freq] || freq;
  };

  const calculateDaysLeft = (dateString) => {
    const today = new Date(); today.setHours(0,0,0,0);
    const target = new Date(dateString); target.setHours(0,0,0,0);
    const diffDays = Math.ceil((target - today) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Hari ini';
    if (diffDays < 0) return 'Melewati jatuh tempo';
    return `${diffDays} hari lagi`;
  };

  if (isError) return <div className="p-4 text-red-700 bg-red-50 text-center font-bold rounded-2xl mt-10 mx-4" role="alert">Gagal memuat panel manajemen langganan.</div>;
  if (isLoadingSchedules || isLoadingMaster) return <LanggananSkeleton />;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12 px-4 md:px-0">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Manajemen Langganan</h1>
        <p className="text-slate-500 text-sm mt-1">Kelola siklus tagihan rutin dan alur dana berulang Anda.</p>
      </div>

      {uiMessage.text && (
        <div role="alert" aria-live="polite" className={`p-4 rounded-xl flex items-center gap-3 text-sm font-semibold border ${uiMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'}`}>
          {uiMessage.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          <span>{uiMessage.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* KOLOM KIRI: DAFTAR JADWAL */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          {schedules.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-sm italic">Belum ada tagihan rutin yang dijadwalkan.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {schedules.map((sched) => {
                const daysLeftStr = calculateDaysLeft(sched.next_run_date);
                return (
                  <div key={sched.id} className={`p-5 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors ${sched.is_active ? 'bg-white' : 'bg-slate-50/50'}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1.5">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: sched.categories?.color_code || '#ccc' }} />
                        <h3 className={`font-semibold truncate text-base ${sched.is_active ? 'text-slate-900' : 'text-slate-400 line-through'}`}>{sched.categories?.name || 'Tanpa Kategori'}</h3>
                        <span className={`text-[10px] px-2 py-0.5 font-bold uppercase tracking-wider rounded-md ${sched.type === 'income' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{sched.type === 'income' ? 'Uang Masuk' : 'Uang Keluar'}</span>
                      </div>
                      <p className="text-sm text-slate-500 truncate mb-2.5">{sched.description || 'Tidak ada catatan'}</p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs font-medium text-slate-500">
                        <span className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-md text-slate-700 font-bold"><Repeat size={12}/> {mapFreqString(sched.frequency)}</span>
                        <span className="flex items-center gap-1.5 bg-slate-100 px-2 py-1 rounded-md">
                          <Calendar size={12} /> Eksekusi: {new Date(sched.next_run_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                        </span>
                        {sched.is_active && <span className={`font-bold ${daysLeftStr.includes('Hari') || daysLeftStr.includes('Melewati') ? 'text-red-600' : 'text-slate-500'}`}>({daysLeftStr})</span>}
                        <span className="bg-slate-100 px-2 py-1 rounded-md">Dompet: <strong className="text-slate-700">{sched.accounts?.name || 'Terhapus'}</strong></span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-t-0 pt-4 md:pt-0 border-slate-100">
                      <div className="text-left md:text-right">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-0.5">Nominal</p>
                        <p className={`text-lg font-black tracking-tight ${!sched.is_active ? 'text-slate-400 line-through' : sched.type === 'income' ? 'text-emerald-600' : 'text-slate-900'}`}>{formatIDR(sched.amount)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleMutation.mutate({ id: sched.id, currentStatus: sched.is_active })}
                          disabled={toggleMutation.isPending}
                          aria-label={sched.is_active ? "Nonaktifkan Langganan" : "Aktifkan Langganan"}
                          className={`p-2.5 rounded-xl border transition-colors outline-none focus:ring-2 ${sched.is_active ? 'bg-slate-900 border-slate-900 text-white hover:bg-slate-800' : 'bg-white border-slate-200 text-slate-400 hover:text-slate-900'}`}
                        >
                          <Power size={16} />
                        </button>
                        <button
                          onClick={() => setDeleteModal({ isOpen: true, id: sched.id, description: sched.categories?.name })}
                          aria-label="Hapus Langganan"
                          className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl border border-transparent hover:border-red-100 transition-all outline-none focus:ring-2 focus:ring-red-200"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* KOLOM KANAN: FORM PENJADWALAN BARU */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-5">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Plus size={18} /> Buat Langganan Baru
          </h2>

          <form onSubmit={handleCreateSchedule} className="space-y-4">
            
            {/* Arus Kas */}
            <div className="flex gap-1.5 rounded-xl bg-slate-100 p-1">
              <button type="button" onClick={() => setFinancialFlow('expense')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all outline-none focus:ring-2 focus:ring-slate-300 ${financialFlow === 'expense' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>Uang Keluar</button>
              <button type="button" onClick={() => setFinancialFlow('income')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all outline-none focus:ring-2 focus:ring-slate-300 ${financialFlow === 'income' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>Uang Masuk</button>
            </div>

            {/* Kategori */}
            <div>
              <label htmlFor="category-select" className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider flex items-center gap-1"><Layers size={12}/> Kategori Rutin</label>
              <div className="flex gap-2">
                <select id="category-select" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="flex-1 px-4 py-2.5 border border-slate-300 rounded-xl bg-white text-sm font-semibold outline-none focus:ring-2 focus:ring-slate-900" disabled={createScheduleMutation.isPending}>
                  {categories.filter(c => c.type === 'otomasi').map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                </select>
                <button type="button" onClick={() => setShowCatManager(true)} className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-colors outline-none focus:ring-2 focus:ring-slate-300" aria-label="Kelola Kategori">
                  <Settings2 size={18} />
                </button>
              </div>
            </div>

            {/* Nominal */}
            <div>
              <label htmlFor="amount-input" className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Nominal Berulang (Rp)</label>
              <input id="amount-input" type="number" required value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-slate-900 outline-none" placeholder="0" disabled={createScheduleMutation.isPending} />
            </div>

            {/* Sumber Akun/Dompet */}
            <div>
              <label htmlFor="account-select" className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider flex items-center gap-1"><CreditCard size={12}/> Target Dompet</label>
              <select id="account-select" value={accountId} onChange={(e) => setAccountId(e.target.value)} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl bg-white text-sm font-semibold outline-none focus:ring-2 focus:ring-slate-900" disabled={createScheduleMutation.isPending}>
                {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
              </select>
            </div>

            {/* Siklus & Tanggal */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="frequency-select" className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Siklus</label>
                <select id="frequency-select" value={frequency} onChange={(e) => setFrequency(e.target.value)} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl bg-white text-sm font-semibold outline-none focus:ring-2 focus:ring-slate-900" disabled={createScheduleMutation.isPending}>
                  <option value="daily">Harian</option>
                  <option value="weekly">Mingguan</option>
                  <option value="monthly">Bulanan</option>
                  <option value="yearly">Tahunan</option>
                </select>
              </div>
              <div>
                <label htmlFor="next-run-date" className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Mulai Tgl</label>
                <input id="next-run-date" type="date" required value={nextRunDate} onChange={(e) => setNextRunDate(e.target.value)} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-slate-900" disabled={createScheduleMutation.isPending} />
              </div>
            </div>

            {/* Deskripsi */}
            <div>
              <label htmlFor="description-input" className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Catatan Tambahan</label>
              <textarea id="description-input" rows={1} value={description} onChange={(e) => setDescription(e.target.value)} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm font-medium outline-none resize-none focus:ring-2 focus:ring-slate-900" placeholder="Keterangan..." disabled={createScheduleMutation.isPending} />
            </div>

            <button type="submit" disabled={createScheduleMutation.isPending || !amount || accounts.length === 0} className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 text-sm rounded-xl transition-all disabled:opacity-50 outline-none focus:ring-4 focus:ring-slate-300">
              {createScheduleMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : 'Aktifkan Jadwal'}
            </button>
          </form>
        </div>

      </div>

      <Kategori 
        isOpen={showCatManager} 
        onClose={() => setShowCatManager(false)} 
        type="otomasi" 
        categories={categories} 
        onCategoryUpdate={() => refetchMaster()} 
      />

      <ModalConfirm
        isOpen={deleteModal.isOpen}
        title="Hapus Tagihan Rutin"
        message={`Yakin ingin menghentikan jadwal "${deleteModal.description}" selamanya?`}
        onConfirm={() => { deleteMutation.mutate(deleteModal.id); setDeleteModal({ isOpen: false, id: null, description: '' }); }}
        onCancel={() => setDeleteModal({ isOpen: false, id: null, description: '' })}
        confirmText="Ya, Hapus"
        danger={true}
      />
    </div>
  );
}