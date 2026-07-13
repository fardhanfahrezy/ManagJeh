// src/hooks/useRealtimeSync.js
import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useQueryClient } from '@tanstack/react-query';
import { logger } from '../lib/logger';

export function useRealtimeSync(userId) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    // Pendaftaran Channel (Disiapkan untuk ditingkatkan ke Subscription Manager di masa depan)
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
          
          logger.info(`Realtime Event: ${eventType} diterima.`);

          // O(1) Cache Injection dengan Keamanan Tipe Data & Soft Delete
          queryClient.setQueryData(['reportTransactions', userId], (oldCache) => {
            // 1. Validasi Bentuk Cache: Pastikan cache ada dan berupa Array 
            // (Jika menggunakan useInfiniteQuery di masa depan, logika ini harus menargetkan oldCache.pages)
            if (!oldCache || !Array.isArray(oldCache)) return oldCache;
            
            switch (eventType) {
              case 'INSERT':
                // Mitigasi Race Condition: Cek duplikasi ID (Optimistic Update protection)
                if (oldCache.some(tx => tx.id === newRecord.id)) return oldCache;
                return [newRecord, ...oldCache];
                
              case 'UPDATE':
                // 2. Penanganan Soft Delete: Jika kolom deleted_at terisi, translasikan sebagai hard-delete di UI
                if (newRecord.deleted_at !== null) {
                  return oldCache.filter(tx => tx.id !== newRecord.id);
                }
                // Update normal (Bisa ditambahkan komparasi updated_at jika perlu resolusi konflik ketat)
                return oldCache.map(tx => tx.id === newRecord.id ? { ...tx, ...newRecord } : tx);
                
              case 'DELETE':
                // Penanganan Hard Delete (sebagai fallback keamanan)
                return oldCache.filter(tx => tx.id !== oldRecord.id);
                
              default:
                return oldCache;
            }
          });

          // Invalidasi Latar Belakang untuk Agregasi (Dasbor & Akun)
          queryClient.invalidateQueries({ 
            queryKey: ['dashboardData', userId], 
            refetchType: 'active',
            exact: true 
          });
          queryClient.invalidateQueries({ 
            queryKey: ['accounts', userId], 
            refetchType: 'active',
            exact: true 
          });
        }
      )
      .subscribe((status, err) => {
        if (err) logger.error('Soket Realtime gagal terhubung', err);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);
}