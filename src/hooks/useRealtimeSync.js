import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useQueryClient } from '@tanstack/react-query';

export function useRealtimeSync(userId) {
  const queryClient = useQueryClient();
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (!userId) return;

    // Fungsi Debounce untuk mencegah API dipanggil ratusan kali dalam 1 detik
    const debouncedInvalidate = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      timeoutRef.current = setTimeout(() => {
        console.info('[Realtime] Memperbarui cache UI setelah mutasi reda.');
        queryClient.invalidateQueries({ queryKey: ['dashboardData', userId] });
        queryClient.invalidateQueries({ queryKey: ['accounts', userId] });
        queryClient.invalidateQueries({ queryKey: ['reportTransactions', userId] });
      }, 500); // Tunggu hingga tidak ada event selama 500ms
    };

    const channel = supabase
      .channel(`collaborative_wallet:${userId}`)
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'transactions' 
        },
        (payload) => {
          // Hanya bereaksi jika mutasi BUKAN dari perangkat pengguna itu sendiri
          // Mencegah konflik dengan Optimistic UI Updates yang dijalankan TanStack Query
          const isFromSelf = payload.new?.user_id === userId || payload.old?.user_id === userId;
          
          // Asumsi: Saat offline/optimistic update, kita ingin menghindari refetch dari realtime
          // Kecuali ini murni transaksi dari collaborative member lain.
          if (!isFromSelf) {
            debouncedInvalidate();
          }
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.info('[Realtime] Terhubung ke mesin sinkronisasi kolaboratif.');
        } else if (err) {
          console.error('[Realtime] Gagal menghubungkan saluran:', err.message);
        }
      });

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);
}