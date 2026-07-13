import { useState, useEffect } from 'react';
import { Loader2, Settings2 } from 'lucide-react';
import { TRANSACTION_TYPES } from '../constants/transactionTypes';
import { formatRupiah } from '../utils/formatter';
import { validateTransaction } from '../utils/validation';

export const TransactionForm = ({ 
  type, 
  onTypeChange, 
  accounts, 
  categories, 
  onSubmit, 
  isSubmitting, 
  onOpenCategoryManager,
  onError 
}) => {
  // Hanya local state yang memicu re-render di komponen ini saja
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [transferToAccountId, setTransferToAccountId] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  // Auto-select fallback logic
  useEffect(() => {
    if (accounts.length > 0 && !accountId) {
      setAccountId(accounts[0].id);
      if (accounts.length > 1) setTransferToAccountId(accounts[1].id);
    }
  }, [accounts, accountId]);

  useEffect(() => {
    if (type !== 'transfer' && categories.length > 0) {
      const validCats = categories.filter(c => c.type === type);
      if (!validCats.find(c => c.id === categoryId)) {
        setCategoryId(validCats.length > 0 ? validCats[0].id : '');
      }
    }
  }, [type, categories, categoryId]);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const payload = {
      type,
      amount: parseFloat(amount) || 0,
      account_id: accountId,
      transfer_to_account_id: type === 'transfer' ? transferToAccountId : null,
      category_id: type === 'transfer' ? null : categoryId,
      description: description.trim() || null,
      date: new Date(date).toISOString(),
    };

    try {
      // 1. Eksekusi Validasi Bisnis murni (Tidak ada alert manual)
      validateTransaction(payload);
      
      // 2. Eksekusi Callback Parent
      onSubmit(payload, () => {
        setAmount('');
        setDescription('');
      });
    } catch (err) {
      onError(err.message);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
      {/* TABS (Tipe Transaksi) */}
      <div className="flex gap-1.5 sm:gap-2 rounded-2xl bg-slate-100 p-1.5 shadow-inner overflow-x-auto">
        {TRANSACTION_TYPES.map((t) => (
          <button 
            key={t.id} type="button" onClick={() => onTypeChange(t.id)} 
            className={`whitespace-nowrap flex-1 px-3 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all ${ type === t.id ? 'bg-white shadow-sm text-slate-900 font-extrabold' : 'text-slate-500 hover:text-slate-800' }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Nominal (Rp)</label>
          <input type="number" required value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full px-4 py-3 border border-slate-300 rounded-xl outline-none text-lg font-black focus:ring-2 focus:ring-slate-900" placeholder="0" disabled={isSubmitting} />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">{type === 'transfer' ? 'Dari Rekening' : 'Sumber Dompet'}</label>
          <select required value={accountId} onChange={(e) => setAccountId(e.target.value)} className="w-full px-4 py-3 border border-slate-300 rounded-xl bg-white text-sm font-semibold outline-none focus:ring-2 focus:ring-slate-900" disabled={isSubmitting}>
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>{acc.name} ({formatRupiah(acc.balance)})</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {type === 'transfer' ? (
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Ke Rekening Tujuan</label>
            <select required value={transferToAccountId} onChange={(e) => setTransferToAccountId(e.target.value)} className="w-full px-4 py-3 border border-slate-300 rounded-xl bg-white text-sm font-semibold outline-none focus:ring-2 focus:ring-slate-900" disabled={isSubmitting}>
              {accounts.map((acc) => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
            </select>
          </div>
        ) : (
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Kategori Laporan</label>
            <div className="flex gap-2">
              <select required value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="flex-1 px-4 py-3 border border-slate-300 rounded-xl bg-white text-sm font-semibold outline-none focus:ring-2 focus:ring-slate-900" disabled={isSubmitting}>
                {categories.filter((cat) => cat.type === type).map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
              <button type="button" onClick={onOpenCategoryManager} className="px-4 py-3 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-colors outline-none focus:ring-2 focus:ring-slate-300" title="Kelola Kategori">
                <Settings2 size={20} />
              </button>
            </div>
          </div>
        )}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Tanggal Efektif</label>
          <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-slate-900" disabled={isSubmitting} />
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Catatan Transaksi</label>
        <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm font-semibold outline-none resize-none transition-all focus:ring-2 focus:ring-slate-900" placeholder="Keterangan tambahan atau nama toko..." disabled={isSubmitting} />
      </div>

      <button type="submit" disabled={isSubmitting || accounts.length === 0} className="w-full bg-slate-900 text-white font-black py-4 rounded-xl hover:bg-slate-800 transition-all text-sm disabled:opacity-50 outline-none">
        {isSubmitting ? <Loader2 className="animate-spin mx-auto" size={20} /> : 'SIMPAN TRANSAKSI'}
      </button>
    </form>
  );
};