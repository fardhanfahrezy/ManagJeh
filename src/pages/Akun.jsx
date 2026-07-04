import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { financialEvents } from '../lib/events';
import { Wallet, Plus, Loader2, CheckCircle, CreditCard, Banknote, Landmark, ReceiptText, Coins } from 'lucide-react';

export default function Akun() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // State Form Akun Baru
  const [name, setName] = useState('');
  const [type, setType] = useState('bank'); 
  const [balance, setBalance] = useState('');
  const [currency, setCurrency] = useState('IDR');
  
  // State Khusus Kripto & Komoditas (Real-Life Finance)
  const [assetTicker, setAssetTicker] = useState('BTC');
  const [assetQuantity, setAssetQuantity] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const fetchAccounts = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .order('type', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      setAccounts(data || []);
    } catch (err) {
      console.error('Gagal mengambil data akun:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
    const unsub = financialEvents.subscribe('data_mutated', fetchAccounts);
    return () => unsub();
  }, [fetchAccounts]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage({ type: '', text: '' });

    const numericBalance = parseFloat(balance) || 0;
    const isVolatileAsset = type === 'crypto' || type === 'investment';
    const numericAssetQty = parseFloat(assetQuantity) || 0;

    try {
      const payload = {
        user_id: user.id,
        name: name.trim(),
        type: type,
        balance: numericBalance,
        currency: currency,
        // Injeksi ticker dan kuantitas jika tipenya aset volatil
        asset_ticker: isVolatileAsset ? assetTicker : 'IDR',
        asset_quantity: isVolatileAsset ? numericAssetQty : 0
      };

      const { error } = await supabase.from('accounts').insert([payload]);

      if (error) throw error;

      setMessage({ type: 'success', text: `Akun "${name}" berhasil diinisialisasi!` });
      setName('');
      setBalance('');
      setAssetQuantity('');
      financialEvents.emit('data_mutated');
      fetchAccounts();
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Gagal menambahkan akun.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getAccountIcon = (accountType) => {
    switch (accountType) {
      case 'cash': return <Banknote className="text-emerald-600" size={22} />;
      case 'e-wallet': return <CreditCard className="text-blue-600" size={22} />;
      case 'debt': return <ReceiptText className="text-red-600" size={22} />;
      case 'crypto': return <Coins className="text-amber-500" size={22} />;
      default: return <Landmark className="text-indigo-600" size={22} />;
    }
  };

  const formatCurrency = (amount, curr) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: curr || 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  if (loading) return <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin text-slate-900" size={32} /></div>;

  return (
    <div className="max-w-5xl mx-auto space-y-8 px-4 pb-12 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Manajemen Dompet & Akun</h1>
        <p className="text-sm text-slate-500">Kelola aset fiat, komoditas kripto/emas, dan liabilitas Anda.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* KOLOM KIRI: DAFTAR AKUN */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Wallet size={18} /> Portofolio Akun ({accounts.length})
          </h2>
          
          {accounts.length === 0 ? (
            <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-2xl text-slate-400">
              Belum ada akun terdaftar.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {accounts.map((acc) => {
                const isDebt = acc.type === 'debt';
                const isVolatile = acc.type === 'crypto' || acc.type === 'investment';
                
                return (
                  <div key={acc.id} className={`p-5 bg-white border rounded-2xl shadow-sm flex flex-col justify-between min-h-[120px] ${isDebt ? 'border-red-100' : isVolatile ? 'border-amber-100' : 'border-slate-200'}`}>
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl border ${isDebt ? 'bg-red-50 border-red-100' : isVolatile ? 'bg-amber-50 border-amber-100' : 'bg-slate-50 border-slate-100'}`}>
                          {getAccountIcon(acc.type)}
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-900 text-sm leading-tight">{acc.name}</h3>
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded mt-1 inline-block ${isDebt ? 'bg-red-100 text-red-700' : isVolatile ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                            {acc.type === 'debt' ? 'Liabilitas' : acc.type}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-4 pt-3 border-t border-slate-50 flex justify-between items-end">
                      <div>
                        <p className="text-xs font-medium text-slate-400 mb-0.5">{isDebt ? 'Total Tunggakan' : 'Saldo Fiat Aktif'}</p>
                        <p className={`text-xl font-black tracking-tight ${isDebt && acc.balance < 0 ? 'text-red-600' : 'text-slate-900'}`}>
                          {formatCurrency(acc.balance, acc.currency)}
                        </p>
                      </div>
                      
                      {/* Label Fisik Kripto/Emas */}
                      {acc.asset_ticker !== 'IDR' && (
                        <div className="text-right">
                           <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block">Kuantitas Fisik</span>
                           <span className="text-sm font-black text-slate-900">{acc.asset_quantity} {acc.asset_ticker}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* KOLOM KANAN: FORM TAMBAH AKUN BARU */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-5">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Plus size={18} /> Inisialisasi Akun
          </h2>

          {message.text && (
            <div className={`p-4 rounded-xl flex items-center gap-2 text-xs font-medium border ${
              message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'
            }`}>
              <CheckCircle size={14} className="flex-shrink-0" />
              <span>{message.text}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Tipe Entitas</label>
              <select value={type} onChange={(e) => setType(e.target.value)} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl bg-white text-sm outline-none focus:ring-2 focus:ring-slate-900" disabled={isSubmitting}>
                <option value="bank">Bank / Rekening</option>
                <option value="e-wallet">E-Wallet / Dompet Digital</option>
                <option value="cash">Tunai / Cash</option>
                <option value="crypto">Crypto Wallet</option>
                <option value="investment">Investasi / Emas Fisik</option>
                <option value="debt">Hutang / Pinjaman (Liabilitas)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Nama Entitas</label>
              <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-slate-900" placeholder={type === 'debt' ? "Contoh: Pinjaman Budi" : type === 'crypto' ? "Contoh: Binance, Indodax" : "Contoh: BCA Utama"} disabled={isSubmitting} />
            </div>

            {/* OPSI TAMBAHAN KHUSUS KRIPTO & INVESTASI */}
            {(type === 'crypto' || type === 'investment') && (
              <div className="grid grid-cols-3 gap-2 p-3 bg-amber-50/50 border border-amber-100 rounded-xl animate-in fade-in zoom-in-95">
                <div className="col-span-1">
                  <label className="block text-[10px] font-bold text-amber-800 mb-1 uppercase tracking-wider">Ticker</label>
                  <select value={assetTicker} onChange={(e) => setAssetTicker(e.target.value)} className="w-full px-3 py-2 border border-amber-200 rounded-lg bg-white text-sm outline-none focus:ring-2 focus:ring-amber-500" disabled={isSubmitting}>
                    <option value="BTC">BTC</option>
                    <option value="ETH">ETH</option>
                    <option value="XAU">XAU (Emas)</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-amber-800 mb-1 uppercase tracking-wider">Kuantitas Fisik</label>
                  {/* Step sangat kecil (0.00000001) agar bisa menampung pecahan Bitcoin */}
                  <input type="number" step="0.00000001" value={assetQuantity} onChange={(e) => setAssetQuantity(e.target.value)} className="w-full px-3 py-2 border border-amber-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-amber-500" placeholder="0.00" disabled={isSubmitting} />
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-1">
                <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Valuta</label>
                <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-full px-3 py-2.5 border border-slate-300 rounded-xl bg-white text-sm outline-none focus:ring-2 focus:ring-slate-900" disabled={isSubmitting}>
                  <option value="IDR">IDR</option>
                  <option value="USD">USD</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Saldo Fiat (Rp)</label>
                <input type="number" required value={balance} onChange={(e) => setBalance(e.target.value)} className={`w-full px-4 py-2.5 border rounded-xl text-sm outline-none focus:ring-2 ${type === 'debt' ? 'border-red-300 focus:ring-red-600 bg-red-50/30' : 'border-slate-300 focus:ring-slate-900'}`} placeholder="0" disabled={isSubmitting} />
              </div>
            </div>

            <button type="submit" disabled={isSubmitting || !name} className={`w-full flex items-center justify-center gap-2 text-white font-bold py-3 text-sm rounded-xl transition-all disabled:opacity-50 cursor-pointer ${type === 'debt' ? 'bg-red-600 hover:bg-red-700' : 'bg-slate-900 hover:bg-slate-800'}`}>
              {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : 'Buat Akun'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}