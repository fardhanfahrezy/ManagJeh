import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { financialEvents } from '../lib/events';
import { saveTransactionOffline } from '../lib/db';
import { Loader2, CheckCircle, Trash2, Repeat, ArrowLeftRight, Landmark, Percent } from 'lucide-react';

export default function Transaksi() {
  const { user } = useAuth();
  
  const [categories, setCategories] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [loadingDropdowns, setLoadingDropdowns] = useState(false);
  
  // State Form Inti
  const [type, setType] = useState('expense'); 
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [transferToAccountId, setTransferToAccountId] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  
  // State Finansial Riil (Admin Fee & Pajak)
  const [adminFee, setAdminFee] = useState('');
  const [taxPercent, setTaxPercent] = useState('0'); 
  
  const [isRecurring, setIsRecurring] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const loadData = useCallback(async () => {
    setLoadingDropdowns(true);
    try {
      const { data: accts } = await supabase.from('accounts').select('id, name, balance, currency, type, asset_ticker, asset_quantity');
      if (accts) {
        setAccounts(accts);
        if (accts.length > 0) setAccountId(accts[0].id);
        if (accts.length > 1) setTransferToAccountId(accts[1].id);
      }

      if (type !== 'transfer') {
        const { data: cats } = await supabase.from('categories').select('id, name').eq('type', type).order('name');
        if (cats) {
          setCategories(cats);
          if (cats.length > 0) setCategoryId(cats[0].id);
        }
      }

      const { data: txs } = await supabase
        .from('transactions')
        .select(`id, amount, type, description, date, admin_fee, tax_amount, account_id, categories(name)`)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(5);
      if (txs) setRecentTransactions(txs);

    } catch (err) {
      console.error(err.message);
    } finally {
      setLoadingDropdowns(false);
    }
  }, [type]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage({ type: '', text: '' });

    const baseAmount = parseFloat(amount) || 0;
    const feeAmount = parseFloat(adminFee) || 0;
    const calculatedTax = baseAmount * (parseFloat(taxPercent) / 100);
    const totalDeduction = baseAmount + feeAmount + calculatedTax;

    if (baseAmount <= 0) {
      setIsSubmitting(false);
      return;
    }

    const selectedAcc = accounts.find(a => a.id === accountId);
    
    // PERBAIKAN KRITIS: Jika akun asal BUKAN bertipe 'debt' (Hutang), jalankan proteksi saldo wajib >= 0
    if (selectedAcc && selectedAcc.type !== 'debt') {
      if ((type === 'expense' || type === 'transfer') && totalDeduction > Number(selectedAcc.balance)) {
        setMessage({ 
          type: 'error', 
          text: `Saldo tidak cukup! Total penarikan: Rp ${totalDeduction.toLocaleString('id-ID')} (Sisa saldo ${selectedAcc.name}: Rp ${Number(selectedAcc.balance).toLocaleString('id-ID')})` 
        });
        setIsSubmitting(false);
        return;
      }
    }

    if (type === 'transfer' && accountId === transferToAccountId) {
      setMessage({ type: 'error', text: 'Akun asal dan akun tujuan tidak boleh sama.' });
      setIsSubmitting(false);
      return;
    }

    const transactionPayload = {
      category_id: type === 'transfer' ? null : categoryId,
      account_id: accountId,
      transfer_to_account_id: type === 'transfer' ? transferToAccountId : null,
      amount: baseAmount,
      admin_fee: feeAmount,
      tax_amount: calculatedTax,
      type: type,
      description: description.trim() || null,
      date: new Date(date).toISOString(),
    };

    try {
      if (!navigator.onLine) {
        await saveTransactionOffline(transactionPayload);
        setMessage({ type: 'success', text: 'Tersimpan secara lokal (Offline Mode).' });
        resetForm();
        return;
      }

      transactionPayload.user_id = user.id;
      const { error: txError } = await supabase.from('transactions').insert([transactionPayload]);
      if (txError) throw txError;

      // Eksekusi mutasi saldo ke basis data
      if (type === 'expense') {
        await supabase.rpc('decrement_account_balance', { acct_id: accountId, amt: totalDeduction });
      } else if (type === 'income') {
        const finalNetIncome = baseAmount - feeAmount - calculatedTax;
        await supabase.rpc('increment_account_balance', { acct_id: accountId, amt: finalNetIncome });
      } else if (type === 'transfer') {
        // Akun asal berkurang (jika akun hutang, nilai akan bergeser ke minus)
        await supabase.rpc('decrement_account_balance', { acct_id: accountId, amt: totalDeduction });
        // Akun tujuan bertambah menerima nilai bersih transfer
        await supabase.rpc('increment_account_balance', { acct_id: transferToAccountId, amt: baseAmount });
      }

      setMessage({ type: 'success', text: 'Transaksi berhasil diamankan!' });
      resetForm();
      financialEvents.emit('data_mutated');
      loadData();

    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Kesalahan Server.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setAmount('');
    setAdminFee('');
    setTaxPercent('0');
    setDescription('');
    setIsRecurring(false);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Pusat Transaksi</h1>
      
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        {message.text && (
          <div className={`mb-6 p-4 rounded-xl text-sm font-semibold border ${message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'}`}>
            <span>{message.text}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex gap-1.5 sm:gap-2 rounded-2xl bg-slate-100 p-1.5 shadow-inner overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {['expense', 'income', 'transfer'].map((t) => (
              <button key={t} type="button" onClick={() => setType(t)} className={`whitespace-nowrap flex-1 min-w-[100px] px-3 py-2.5 text-xs sm:text-sm font-bold rounded-xl cursor-pointer transition-all ${type === t ? 'bg-white shadow-sm text-slate-900 font-extrabold' : 'text-slate-500 hover:text-slate-800'}`}>
                {t === 'expense' ? 'Pengeluaran' : t === 'income' ? 'Pemasukan' : 'Transfer'}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Nominal Utama (Base Amount)</label>
              <input type="number" required value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-slate-900 text-sm" placeholder="0" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">{type === 'transfer' ? 'Dari Rekening' : 'Sumber Rekening/Dompet'}</label>
              <select required value={accountId} onChange={(e) => setAccountId(e.target.value)} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl bg-white text-sm outline-none">
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({acc.type === 'debt' ? `Hutang: Rp ${Number(acc.balance).toLocaleString('id-ID')}` : `Saldo: Rp ${Number(acc.balance).toLocaleString('id-ID')}`})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-600 mb-1 flex items-center gap-1 uppercase tracking-wider"><Landmark size={14}/> Biaya Admin Bank / Aplikasi</label>
              <input type="number" value={adminFee} onChange={(e) => setAdminFee(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white text-sm outline-none focus:ring-2 focus:ring-slate-900" placeholder="Contoh: 2500 atau 6500" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 mb-1 flex items-center gap-1 uppercase tracking-wider"><Percent size={14}/> Komponen Pajak / PPN</label>
              <select value={taxPercent} onChange={(e) => setTaxPercent(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white text-sm outline-none">
                <option value="0">Tanpa Pajak (0%)</option>
                <option value="11">PPN Domestik Indonesia (11%)</option>
                <option value="5">Pajak UMKM / Layanan (5%)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {type === 'transfer' ? (
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Ke Rekening Tujuan</label>
                <select required value={transferToAccountId} onChange={(e) => setTransferToAccountId(e.target.value)} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl bg-white text-sm outline-none">
                  {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Kategori Laporan</label>
                <select required value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl bg-white text-sm outline-none">
                  {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Tanggal Efektif</label>
              <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm outline-none" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Catatan Transaksi</label>
            <textarea rows={1} value={description} onChange={(e) => setDescription(e.target.value)} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm outline-none resize-none" placeholder="Keterangan tambahan..." />
          </div>

          <button type="submit" disabled={isSubmitting} className="w-full bg-slate-900 text-white font-bold py-3.5 rounded-xl hover:bg-slate-800 transition-all text-sm cursor-pointer disabled:opacity-50">
            {isSubmitting ? 'Memproses Validasi Finansial...' : 'Simpan Transaksi'}
          </button>
        </form>
      </div>
    </div>
  );
}