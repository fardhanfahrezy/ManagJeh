import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useQueryClient } from '@tanstack/react-query';

export function useRealtimeSync(userId) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    // Mendengarkan perubahan APAPUN pada tabel transactions
    const channel = supabase
      .channel('public:transactions')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions' },
        (payload) => {
          console.log('[Realtime] Data berubah, memperbarui cache UI...', payload);
          // Invalidasi cache agar UI secara otomatis mengambil data terbaru di background
          queryClient.invalidateQueries({ queryKey: ['dashboardData'] });
          queryClient.invalidateQueries({ queryKey: ['accounts'] });
          queryClient.invalidateQueries({ queryKey: ['reportTransactions'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);
}