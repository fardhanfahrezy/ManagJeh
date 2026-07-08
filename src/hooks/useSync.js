import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { localDB } from '../lib/db';
import { useQueryClient } from '@tanstack/react-query';

export function useSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const syncOfflineData = async () => {
      if (!navigator.onLine) return;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      try {
        const unsyncedTransactions = await localDB.transactions
          .where('synced')
          .equals(0)
          .toArray();

        if (unsyncedTransactions.length === 0) return;

        // Persiapkan payload untuk Batch Insert (mengamputasi loop request)
        const payloads = unsyncedTransactions.map(tx => {
          const { local_id, synced, user_id, ...rest } = tx;
          return rest;
        });

        // Ubah logika di useSync.js
        const { error } = await supabase
          .from('transactions')
          .upsert(payloads, { onConflict: 'id' });
        // Data baru akan di-insert, data lama akan di-update

        if (!error) {
          // Bersihkan localDB berdasarkan array id yang berhasil
          const localIds = unsyncedTransactions.map(tx => tx.local_id);
          await localDB.transactions.bulkDelete(localIds);

          // Invalidate cache TanStack Query secara global sebagai pengganti custom Event Bus
          queryClient.invalidateQueries();
          console.log(`[PWA Sync] ${payloads.length} entri disinkronkan via Batch Insert.`);
        } else {
          throw error;
        }
      } catch (err) {
        console.error('[PWA Sync] Kegagalan batch sinkronisasi:', err.message);
      }
    };

    window.addEventListener('online', syncOfflineData);
    syncOfflineData();

    return () => window.removeEventListener('online', syncOfflineData);
  }, [queryClient]);
}