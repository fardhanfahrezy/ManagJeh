import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { localDB } from '../lib/db';
import { useQueryClient } from '@tanstack/react-query';

export function useSync(userId) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    const processActionQueue = async () => {
      if (!navigator.onLine) return;

      try {
        // PERBAIKAN A: Hanya ambil antrean milik pengguna yang sedang login
        // Memerlukan migrasi db.js (localDB.version(3)) yang sudah kita bahas sebelumnya
        const queue = await localDB.action_queue
          .where('user_id')
          .equals(userId)
          .sortBy('id');

        if (queue.length === 0) return;

        let processedIds = [];
        let failedIds = [];

        for (const item of queue) {
          let error = null;

          if (item.action === 'INSERT' || item.action === 'UPDATE') {
            const safePayload = { ...item.payload, user_id: userId };
            const { error: upsertError } = await supabase
              .from('transactions')
              .upsert([safePayload], { onConflict: 'id' });
            error = upsertError;
          } 
          else if (item.action === 'DELETE') {
            const { error: deleteError } = await supabase
              .from('transactions')
              .update({ deleted_at: new Date().toISOString() })
              .eq('id', item.entity_id)
              .eq('user_id', userId);
            error = deleteError;
          }

          // PERBAIKAN B: Klasifikasi Error untuk mencegah Deadlocked Queue
          if (!error) {
            processedIds.push(item.id);
          } else {
            // Deteksi apakah ini error koneksi/server down (5xx)
            const isNetworkIssue = error.message?.toLowerCase().includes('fetch') || 
                                   error.code?.startsWith('5');
            
            if (isNetworkIssue) {
              console.warn(`[Sync] Jaringan tidak stabil, menghentikan antrean di ID ${item.id}.`);
              break; // Hentikan loop, coba lagi nanti saat online
            } else {
              // Jika ini Error Validasi (23514) atau RLS (42501), data ini cacat permanen.
              console.error(`[Sync] Data cacat/ditolak server (ID: ${item.id}). Dihapus dari antrean agar tidak macet:`, error.message);
              failedIds.push(item.id); // Catat untuk dibuang
            }
          }
        }

        // Gabungkan ID yang berhasil dan yang cacat permanen untuk dibersihkan dari IndexedDB
        const idsToRemove = [...processedIds, ...failedIds];

        if (idsToRemove.length > 0) {
          await localDB.action_queue.bulkDelete(idsToRemove);
          
          queryClient.invalidateQueries({ queryKey: ['dashboardData', userId] });
          queryClient.invalidateQueries({ queryKey: ['accounts', userId] });
          queryClient.invalidateQueries({ queryKey: ['reportTransactions', userId] });
          
          console.info(`[Sync Engine] Selesai. Sukses: ${processedIds.length}. Dibuang (Cacat): ${failedIds.length}.`);
        }

      } catch (err) {
        console.error('[Sync Engine] Kesalahan fatal pada pemrosesan antrean:', err.message);
      }
    };

    window.addEventListener('online', processActionQueue);
    // Jalankan sekali saat mount (jika sudah online)
    if (navigator.onLine) processActionQueue();

    return () => window.removeEventListener('online', processActionQueue);
  }, [userId, queryClient]);
}