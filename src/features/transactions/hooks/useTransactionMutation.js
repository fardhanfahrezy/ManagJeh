// src/features/transactions/hooks/useTransactionMutation.js
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { transactionService } from '../services/transaction.service';
import { useToast } from '../../../contexts/ToastContext';

// Kamus Pemetaan SQLSTATE untuk Keandalan Sistem Produksi
const POSTGRES_ERROR_MAP = {
  '23514': 'Validasi gagal: Pastikan nominal di atas 0 dan dompet tujuan transfer tidak boleh sama dengan asal.',
  '23505': 'Gagal menyimpan: Ditemukan duplikasi data yang melanggar aturan sistem.',
  '23503': 'Pelanggaran relasi: Dompet atau kategori yang Anda pilih tidak terdaftar di sistem.',
  '42501': 'Akses ditolak: Anda tidak memiliki hak keamanan untuk memodifikasi transaksi ini.',
  '23502': 'Data tidak lengkap: Terdapat kolom wajib yang tidak terisi oleh aplikasi.'
};

export const useTransactionMutation = (userId) => {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    networkMode: 'always',
    mutationFn: (payload) => transactionService.createTransaction(payload, userId),
    onSuccess: (result) => {
      const msg = result.status === 'offline' 
        ? 'Tersimpan lokal (Offline Mode).' 
        : 'Transaksi berhasil dicatat.';
      showToast(msg, 'success');
      
      queryClient.invalidateQueries({ queryKey: ['dashboardData'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
    onError: (err) => {
      // PERBAIKAN: Gunakan err.code (SQLSTATE) sebagai jangkar utama, fallback ke message
      const sqlState = err.code;
      const mappedMessage = POSTGRES_ERROR_MAP[sqlState];

      if (mappedMessage) {
        showToast(mappedMessage, 'error');
      } else {
        // Fallback untuk network error atau internal code crash
        showToast(err.message || 'Terjadi kesalahan sistem internal.', 'error');
      }
      
      console.error(`[Transaction Error] SQLSTATE: ${sqlState || 'N/A'}`, err);
    }
  });
};