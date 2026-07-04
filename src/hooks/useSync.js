import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { localDB } from '../lib/db';
import { financialEvents } from '../lib/events';

export function useSync(userId) {
  useEffect(() => {
    if (!userId) return;

    const syncOfflineData = async () => {
      if (!navigator.onLine) return;

      try {
        // Ambil semua transaksi offline yang belum tersinkronisasi (synced = 0)
        const unsyncedTransactions = await localDB.transactions
          .where('synced')
          .equals(0)
          .toArray();

        if (unsyncedTransactions.length === 0) return;

        console.log(`Menemukan ${unsyncedTransactions.length} data offline. Mengunggah...`);

        for (const tx of unsyncedTransactions) {
          // Siapkan data untuk dikirim ke Supabase (buang kolom id lokal)
          const { local_id, synced, ...payload } = tx;
          payload.user_id = userId;

          const { error } = await supabase.from('transactions').insert([payload]);

          if (!error) {
            // Jika sukses, ubah status atau hapus dari database lokal browser
            await localDB.transactions.delete(local_id);
          } else {
            console.error("Gagal sinkronisasi baris:", error.message);
          }
        }

        // Beritahu komponen global bahwa data berubah agar UI diperbarui
        financialEvents.emit('data_mutated');
        console.log('Sinkronisasi data offline selesai dengan sukses.');
      } catch (err) {
        console.error('Proses sinkronisasi latar belakang gagal:', err.message);
      }
    };

    // Dengarkan perubahan status koneksi perangkat
    window.addEventListener('online', syncOfflineData);
    // Jalankan pengecekan langsung saat aplikasi pertama kali dibuka
    syncOfflineData();

    return () => window.removeEventListener('online', syncOfflineData);
  }, [userId]);
}