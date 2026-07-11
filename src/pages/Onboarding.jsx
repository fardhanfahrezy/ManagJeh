import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Wallet, CheckCircle } from 'lucide-react';

export default function Onboarding() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [balance, setBalance] = useState('');
  const [type, setType] = useState('bank');
  const [errorMsg, setErrorMsg] = useState('');

  const setupMutation = useMutation({
    mutationFn: async (payload) => {
      if (!navigator.onLine) throw new Error('Koneksi internet diperlukan untuk pengaturan awal.');
      const { error } = await supabase.from('accounts').insert([payload]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts', user?.id] });
      // Setelah dompet dibuat, arahkan ke dashboard
      navigate('/dashboard', { replace: true });
    },
    onError: (err) => setErrorMsg(err.message)
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrorMsg('');
    setupMutation.mutate({
      name: name.trim(),
      type: type,
      balance: parseFloat(balance) || 0,
      currency: 'IDR'
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-slate-100 p-8 animate-in fade-in zoom-in-95 duration-500">
        <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-6 border border-blue-100">
          <Wallet className="text-blue-600" size={32} />
        </div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight mb-2">Langkah Terakhir!</h1>
        <p className="text-sm text-slate-500 mb-8 font-medium">Buat dompet/akun pertama Anda untuk mulai mencatat keuangan.</p>

        {errorMsg && (
          <div className="p-3 mb-6 rounded-xl bg-red-50 text-red-800 border border-red-200 text-xs font-bold" role="alert">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="acc-type" className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Tipe Penyimpanan</label>
            <select id="acc-type" value={type} onChange={(e) => setType(e.target.value)} className="w-full px-4 py-3 border border-slate-300 rounded-xl bg-white text-sm outline-none focus:ring-2 focus:ring-blue-600">
              <option value="bank">Rekening Bank</option>
              <option value="e-wallet">E-Wallet</option>
              <option value="cash">Uang Tunai</option>
            </select>
          </div>
          <div>
            <label htmlFor="acc-name" className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Nama Dompet</label>
            <input id="acc-name" type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Contoh: BCA Pribadi" className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-600" />
          </div>
          <div>
            <label htmlFor="acc-bal" className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Saldo Saat Ini (Rp)</label>
            <input id="acc-bal" type="number" required value={balance} onChange={(e) => setBalance(e.target.value)} placeholder="0" className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-600" />
          </div>
          <button type="submit" disabled={setupMutation.isPending || !name} className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl hover:bg-blue-700 focus:ring-4 focus:ring-blue-200 transition-all disabled:opacity-50 flex justify-center items-center outline-none">
            {setupMutation.isPending ? <Loader2 className="animate-spin" size={20} /> : <span className="flex items-center gap-2">Selesai & Masuk <CheckCircle size={18}/></span>}
          </button>
        </form>
      </div>
    </div>
  );
}