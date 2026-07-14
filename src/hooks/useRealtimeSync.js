// src/hooks/useRealtimeSync.js
import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '../lib/queryKeys';

export function useRealtimeSync(userId) {
  const queryClient = useQueryClient();
  const invalidationTimeout = useRef(null);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`realtime:user_${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          const { eventType, new: newRecord, old: oldRecord } = payload;

          // 1. O(1) Cache Injection: Memperbarui cache lokal tanpa HTTP request
          // Menggunakan setQueriesData agar mengenai semua filter/paginasi transaksi
          queryClient.setQueriesData({ queryKey: ['transactions', userId] }, (oldCache) => {
            if (!oldCache || !Array.isArray(oldCache)) return oldCache;
            
            switch (eventType) {
              case 'INSERT':
                if (oldCache.some(tx => tx.id === newRecord.id)) return oldCache;
                return [newRecord, ...oldCache];
                
              case 'UPDATE':
                if (newRecord.deleted_at !== null) {
                  return oldCache.filter(tx => tx.id !== newRecord.id);
                }
                return oldCache.map(tx => tx.id === newRecord.id ? { ...tx, ...newRecord } : tx);
                
              case 'DELETE':
                return oldCache.filter(tx => tx.id !== oldRecord.id);
                
              default:
                return oldCache;
            }
          });

          // 2. Debounced Invalidation: Menggabungkan badai request menjadi 1x per 1.5 detik
          if (invalidationTimeout.current) clearTimeout(invalidationTimeout.current);
          
          invalidationTimeout.current = setTimeout(() => {
            // Meminta Dasbor dan Akun untuk me-refresh data agregasi mereka
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.dashboard(userId), refetchType: 'active' });
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.masterData(userId), refetchType: 'active' });
          }, 1500); 
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (invalidationTimeout.current) clearTimeout(invalidationTimeout.current);
    };
  }, [userId, queryClient]);
}