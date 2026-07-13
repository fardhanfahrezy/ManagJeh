import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useTransactionMasterData } from '../features/transactions/hooks/useTransactionMasterData';
import { useTransactionMutation } from '../features/transactions/hooks/useTransactionMutation';
import { TransactionForm } from '../features/transactions/components/TransactionForm';
import Kategori from '../components/Kategori'; 

const TransaksiSkeleton = () => (
  <div className="max-w-3xl mx-auto space-y-6 pb-12 animate-pulse w-full">
    <div className="h-8 bg-slate-200 rounded-xl w-48 mb-6"></div>
    <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
      <div className="h-12 bg-slate-100 rounded-2xl w-full"></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6"><div className="h-14 bg-slate-100 rounded-xl w-full"></div><div className="h-14 bg-slate-100 rounded-xl w-full"></div></div>
      <div className="h-20 bg-slate-100 rounded-xl w-full"></div>
    </div>
  </div>
);

export default function Transaksi() {
  const { user } = useAuth();
  const { showToast } = useToast();
  
  // SHARED STATE: Type dikontrol oleh Parent agar Modal dan Form selalu tersinkronisasi
  const [transactionType, setTransactionType] = useState('expense');
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

  // DATA FETCHING
  const { data: masterData, isLoading } = useTransactionMasterData(user?.id);
  // PENGHAPUSAN useMemo: Mengandalkan referential stability dari React Query
  const accounts = masterData?.accounts ?? [];
  const categories = masterData?.categories ?? [];

  // MUTATION
  const transactionMutation = useTransactionMutation(user?.id);

  const handleTransactionSubmit = (payload, resetFormCallback) => {
    transactionMutation.mutate(payload, {
      onSuccess: (result) => {
        const msg = result.status === 'offline' ? 'Tersimpan lokal (Offline Mode).' : 'Transaksi berhasil dicatat.';
        showToast(msg, 'success');
        resetFormCallback();
      },
      onError: (err) => {
        showToast(err.message || 'Kesalahan Server. Silakan coba lagi.', 'error');
      }
    });
  };

  if (isLoading) return <TransaksiSkeleton />;

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Pusat Transaksi</h1>
        <p className="text-sm text-slate-500">Catat pemasukan, pengeluaran, dan transfer Anda di sini.</p>
      </div>

      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
        <TransactionForm 
          type={transactionType}
          onTypeChange={setTransactionType}
          accounts={accounts}
          categories={categories}
          onSubmit={handleTransactionSubmit}
          onError={(msg) => showToast(msg, 'error')}
          isSubmitting={transactionMutation.isPending}
          onOpenCategoryManager={() => setIsCategoryModalOpen(true)}
        />
      </div>

      {/* MODAL KATEGORI: Menerima 'type' langsung dari state Parent */}
      <Kategori 
        isOpen={isCategoryModalOpen} 
        onClose={() => setIsCategoryModalOpen(false)} 
        type={transactionType} 
        categories={categories} 
      />
    </div>
  );
}