// src/pages/Akun.jsx
import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatIDR } from '../lib/utils';
import { Wallet, Plus, Loader2, CheckCircle, CreditCard, Banknote, Landmark, ReceiptText, Coins, Users, X, AlertCircle } from 'lucide-react';

// ==============================================================================
// SKELETON: Akun & Dompet
// ==============================================================================
const AkunSkeleton = () => (
  <div className="max-w-5xl mx-auto space-y-8 px-4 pb-12 animate-pulse w-full">
    <div className="space-y-3">
      <div className="h-8 bg-slate-200 rounded-xl w-64"></div>
      <div className="h-4 bg-slate-200 rounded-lg w-80"></div>
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
      <div className="lg:col-span-2 space-y-4">
        <div className="h-6 bg-slate-200 rounded-lg w-48 mb-6"></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="p-5 bg-white border border-slate-100 rounded-2xl flex flex-col justify-between min-h-[120px]">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-slate-100 rounded-xl"></div>
                  <div className="space-y-2"><div className="h-4 w-24 bg-slate-200 rounded"></div><div className="h-3 w-16 bg-slate-100 rounded"></div></div>
                </div>
                <div className="h-8 w-8 bg-slate-100 rounded-xl"></div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-50 space-y-2">
                <div className="h-3 w-20 bg-slate-100 rounded"></div>
                <div className="h-6 w-32 bg-slate-200 rounded-lg"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-5">
        <div className="h-6 bg-slate-200 rounded-lg w-40 mb-4"></div>
        <div className="space-y-4">
          <div className="space-y-2"><div className="h-4 w-24 bg-slate-200 rounded"></div><div className="h-10 w-full bg-slate-100 rounded-xl"></div></div>
          <div className="space-y-2"><div className="h-4 w-32 bg-slate-200 rounded"></div><div className="h-10 w-full bg-slate-100 rounded-xl"></div></div>
          <div className="space-y-2"><div className="h-4 w-28 bg-slate-200 rounded"></div><div className="h-10 w-full bg-slate-100 rounded-xl"></div></div>
          <div className="h-12 w-full bg-slate-200 rounded-xl mt-2"></div>
        </div>
      </div>
    </div>
  </div>
);

export default function Akun() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [name, setName] = useState('');
  const [type, setType] = useState('bank'); 
  const [balance, setBalance] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });

  const [shareModal, setShareModal] = useState({ isOpen: false, accountId: null, accountName: '' });
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteMsg, setInviteMsg] = useState({ type: '', text: '' });
  const [isInviting, setIsInviting] = useState(false);

  const { data: accounts, isLoading } = useQuery({
    queryKey: ['accounts', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts')
        .select('*, account_members(user_id, role)')
        .order('type', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    }
  });

  const addAccountMutation = useMutation({
    mutationFn: async (payload) => {
      if (!navigator.onLine) {
        throw new Error('Koneksi internet diperlukan untuk membuat akun baru.');
      }
      const { error } = await supabase.from('accounts').insert([payload]);
      if (error) throw error;
    },
    onSuccess: () => {
      setMessage({ type: 'success', text: `Akun "${name}" berhasil diinisialisasi!` });
      setName(''); 
      setBalance('');
      setType('bank'); 
      queryClient.invalidateQueries({ queryKey: ['accounts', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['masterData', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['dashboardData', user?.id] });
    },
    onError: (err) => {
      setMessage({ type: 'error', text: err.message || 'Gagal menambahkan akun.' });
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });
    addAccountMutation.mutate({
      name: name.trim(),
      type: type,
      balance: parseFloat(balance) || 0,
      currency: 'IDR'
    });
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    setIsInviting(true);
    setInviteMsg({ type: '', text: '' });

    try {
      if (inviteEmail === user.email) throw new Error("Anda tidak bisa mengundang diri sendiri.");
      
      const { error } = await supabase.rpc('invite_user_to_wallet', { 
        wallet_id: shareModal.accountId, 
        invitee_email: inviteEmail.trim() 
      });
      
      if (error) throw error;

      setInviteMsg({ type: 'success', text: 'Berhasil mengundang kolaborator!' });
      setInviteEmail('');
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      setTimeout(() => setShareModal({ isOpen: false, accountId: null, accountName: '' }), 2000);
    } catch (err) {
      setInviteMsg({ type: 'error', text: err.message });
    } finally {
      setIsInviting(false);
    }
  };

  const getAccountIcon = (accountType) => {
    switch (accountType) {
      case 'cash': return <Banknote className="text-emerald-600" size={22} />;
      case 'e-wallet': return <CreditCard className="text-blue-600" size={22} />;
      case 'debt': return <ReceiptText className="text-red-600" size={22} />;
      case 'crypto':
      case 'investment': return <Coins className="text-amber-500" size={22} />;
      default: return <Landmark className="text-indigo-600" size={22} />;
    }
  };

  if (isLoading) return <AkunSkeleton />;

  return (
    <div className="max-w-5xl mx-auto space-y-8 px-4 pb-12">
      
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Manajemen Dompet & Akun</h1>
        <p className="text-sm text-slate-500">Kelola portofolio aset fiat, digital, dan liabilitas Anda.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Wallet size={18} /> Portofolio Akun ({(accounts || []).length})
          </h2>
          
          {(!accounts || accounts.length === 0) ? (
            <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-2xl text-slate-400">
              Belum ada akun terdaftar.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(accounts || []).map((acc) => {
                const isDebt = acc.type === 'debt';
                const isShared = acc.account_members && acc.account_members.length > 1;
                
                // PERBAIKAN: Sanitasi nilai type untuk mencegah crash
                const safeType = acc.type || 'lainnya';

                return (
                  <div key={acc.id} className={`p-5 bg-white border rounded-2xl shadow-sm flex flex-col justify-between min-h-[120px] transition-all hover:shadow-md ${isDebt ? 'border-red-100' : 'border-slate-200'}`}>
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl border ${isDebt ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-100'}`}>
                          {getAccountIcon(safeType)}
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-900 text-sm leading-tight">{acc.name}</h3>
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded mt-1 inline-block ${isDebt ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500'}`}>
                            {/* PERBAIKAN: Menggunakan safeType untuk memanggil replace() */}
                            {isDebt ? 'Liabilitas' : safeType.replace('-', ' ')}
                          </span>
                        </div>
                      </div>

                      <button 
                        onClick={() => setShareModal({ isOpen: true, accountId: acc.id, accountName: acc.name })}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors outline-none"
                        title="Bagikan dompet dengan partner"
                      >
                        <Users size={18} />
                      </button>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-50">
                      <p className="text-xs font-medium text-slate-400 mb-0.5">{isDebt ? 'Total Tunggakan' : 'Saldo Aktif'}</p>
                      <p className={`text-xl font-black tracking-tight ${isDebt ? 'text-red-600' : 'text-slate-900'}`}>
                        {formatIDR(Math.abs(acc.balance))}
                      </p>
                    </div>

                    {isShared && (
                      <div className="mt-3 pt-2 border-t border-slate-100 flex items-center gap-2 text-[11px] font-bold text-blue-600">
                        <Users size={12} /> Bersama ({acc.account_members.length} Anggota)
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-5">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Plus size={18} /> Inisialisasi Akun
          </h2>

          {message.text && (
            <div className={`p-4 rounded-xl flex items-center gap-2 text-xs font-medium border ${message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'}`}>
              <CheckCircle size={14} className="flex-shrink-0" />
              <span>{message.text}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
    <div>
      <label htmlFor="account-type" className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Tipe Entitas</label>
      <select 
        id="account-type" 
        value={type} 
        onChange={(e) => setType(e.target.value)} 
        className="w-full px-4 py-2.5 border border-slate-300 rounded-xl bg-white text-sm outline-none focus:ring-2 focus:ring-slate-900" 
        disabled={addAccountMutation.isPending}
      >
        <option value="bank">Bank / Rekening</option>
        <option value="e-wallet">E-Wallet / Dompet Digital</option>
        <option value="cash">Tunai / Cash</option>
        <option value="investment">Investasi / Tabungan Berjangka</option>
        <option value="crypto">Crypto / Aset Digital</option>
        <option value="debt">Hutang / Pinjaman (Liabilitas)</option>
      </select>
    </div>
    <div>
      <label htmlFor="account-name" className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Nama Entitas</label>
      <input 
        id="account-name" 
        type="text" 
        required 
        value={name} 
        onChange={(e) => setName(e.target.value)} 
        className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-slate-900" 
        placeholder="Contoh: BCA Utama" 
        disabled={addAccountMutation.isPending} 
      />
    </div>
    <div>
      <label htmlFor="account-balance" className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Saldo Awal (Rp)</label>
      <input 
        id="account-balance" 
        type="number" 
        required 
        value={balance} 
        onChange={(e) => setBalance(e.target.value)} 
        className={`w-full px-4 py-2.5 border rounded-xl text-sm outline-none transition-colors ${type === 'debt' ? 'border-red-300 focus:ring-red-600 bg-red-50/30' : 'border-slate-300 focus:ring-2 focus:ring-slate-900'}`} 
        placeholder="0" 
        disabled={addAccountMutation.isPending} 
      />
    </div>
    <button type="submit" disabled={addAccountMutation.isPending || !name} className={`w-full flex items-center justify-center gap-2 text-white font-bold py-3 text-sm rounded-xl transition-all disabled:opacity-50 cursor-pointer outline-none ${type === 'debt' ? 'bg-red-600 hover:bg-red-700 focus:ring-4 focus:ring-red-100' : 'bg-slate-900 hover:bg-slate-800 focus:ring-4 focus:ring-slate-200'}`}>

              {addAccountMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : 'Buat Akun'}

            </button>
  </form>
        </div>
      </div>

      {shareModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => setShareModal({isOpen:false, accountId: null, accountName: ''})}>
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden flex flex-col animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-blue-50/50">
              <h3 className="font-bold text-slate-900 flex items-center gap-2"><Users size={18} className="text-blue-600"/> Bagikan "{shareModal.accountName}"</h3>
              <button onClick={() => setShareModal({isOpen:false, accountId: null, accountName: ''})} className="text-slate-400 hover:text-slate-900 outline-none"><X size={20}/></button>
            </div>
            
            <div className="p-6">
              <p className="text-sm text-slate-500 mb-4 leading-relaxed">
                Undang pasangan atau partner Anda. Mereka akan dapat melihat saldo dan mencatat transaksi ke dompet ini dari HP mereka.
              </p>

              {inviteMsg.text && (
                <div className={`p-3 mb-4 rounded-xl flex items-start gap-2 text-xs font-bold border ${inviteMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'}`}>
                  {inviteMsg.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                  <span>{inviteMsg.text}</span>
                </div>
              )}

              <form onSubmit={handleInvite} className="space-y-4">
                <div>
                  {/* PERBAIKAN A11Y: Menghubungkan label dengan input */}
                  <label htmlFor="invite-email" className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Email Partner</label>
                  <input 
                    id="invite-email"
                    type="email" 
                    required 
                    value={inviteEmail} 
                    onChange={(e) => setInviteEmail(e.target.value)} 
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-600" 
                    placeholder="contoh: pasangan@email.com" 
                    disabled={isInviting} 
                  />
                  <p className="text-[10px] text-slate-400 mt-1.5">*Partner Anda harus sudah mendaftar di aplikasi ini terlebih dahulu.</p>
                </div>
                
                <button type="submit" disabled={isInviting || !inviteEmail} className="w-full bg-blue-600 text-white font-bold py-2.5 rounded-xl text-sm hover:bg-blue-700 disabled:opacity-50 outline-none transition-colors">
                  {isInviting ? 'Mengirim Undangan...' : 'Kirim Undangan Akses'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}