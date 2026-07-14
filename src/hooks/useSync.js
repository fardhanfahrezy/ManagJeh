// src/hooks/useSync.js
import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { localDB } from '../lib/db';
import { useQueryClient } from '@tanstack/react-query';
import { createLogger } from '../lib/logger';
import { QUERY_KEYS } from '../lib/queryKeys'; // Menggunakan standarisasi Factory

const syncLogger = createLogger('Sync');

const DEFAULT_BATCH_SIZE = 30;
const MAX_RETRIES = 3;
const MAX_SYNC_ATTEMPTS = 10;

const isNetworkError = (err) => {
  if (!err) return false;
  const msg = err.message?.toLowerCase() || '';
  const status = Number(err.status || 0);
  if (msg.includes('fetch') || msg.includes('network') || msg.includes('abort') || 
      msg.includes('timeout') || msg.includes('econnreset')) return true;
  if (status === 408 || status === 429 || status >= 500) return true;
  return false;
};

const abortableSleep = (ms, signal) => new Promise((resolve, reject) => {
  if (signal?.aborted) return reject(new Error('SYNC_ABORTED'));
  const timer = setTimeout(resolve, ms);
  signal?.addEventListener('abort', () => {
    clearTimeout(timer);
    reject(new Error('SYNC_ABORTED'));
  }, { once: true });
});

const compactQueue = (queue) => {
  const compactedMap = new Map();
  const redundantIds = [];

  for (const item of queue) {
    const existing = compactedMap.get(item.entity_id);

    if (!existing) {
      compactedMap.set(item.entity_id, { ...item });
      continue;
    }

    if (existing.action === 'INSERT' && item.action === 'UPDATE') {
      existing.payload = { ...existing.payload, ...item.payload };
      redundantIds.push(item.id); 
    } else if (existing.action === 'INSERT' && item.action === 'DELETE') {
      redundantIds.push(existing.id, item.id);
      compactedMap.delete(item.entity_id);
    } else if (existing.action === 'UPDATE' && item.action === 'UPDATE') {
      existing.payload = { ...existing.payload, ...item.payload };
      redundantIds.push(item.id);
    } else if (existing.action === 'UPDATE' && item.action === 'DELETE') {
      existing.action = 'DELETE';
      existing.payload = null;
      redundantIds.push(item.id);
    } else {
      compactedMap.set(item.entity_id, { ...item });
    }
  }

  return { compactedQueue: Array.from(compactedMap.values()), redundantIds };
};

export function useSync(userId) {
  const queryClient = useQueryClient();
  const isSyncing = useRef(false);

  useEffect(() => {
    if (!userId) return;
    const abortController = new AbortController();

    const processActionQueue = async () => {
      if (!navigator.onLine || isSyncing.current) return;
      isSyncing.current = true;

      try {
        while (true) {
          if (abortController.signal.aborted) break;

          const rawQueue = await localDB.action_queue.where('user_id').equals(userId).sortBy('id');
          const activeQueue = rawQueue.filter(item => (item.sync_attempts || 0) < MAX_SYNC_ATTEMPTS);
          
          if (activeQueue.length === 0) break;

          const { compactedQueue, redundantIds } = compactQueue(activeQueue);
          
          if (redundantIds.length > 0) {
            await localDB.action_queue.bulkDelete(redundantIds);
            if (compactedQueue.length === 0) continue; 
          }

          const chunk = compactedQueue.slice(0, DEFAULT_BATCH_SIZE);
          let processedIds = [];
          let deadLetterItems = [];

          const upserts = chunk.filter(item => item.action === 'INSERT' || item.action === 'UPDATE');
          const deletes = chunk.filter(item => item.action === 'DELETE');

          // --- 1. O(1) BULK UPSERT ---
          if (upserts.length > 0) {
            const payloads = upserts.map(item => ({ ...item.payload, user_id: userId }));
            try {
              const { error } = await supabase.from('transactions').upsert(payloads, { onConflict: 'id' }).abortSignal(abortController.signal);
              if (error) throw error;
              processedIds.push(...upserts.map(item => item.id));
            } catch (bulkError) {
              if (isNetworkError(bulkError) || bulkError.message === 'SYNC_ABORTED') throw bulkError;
              // Fallback serial untuk mendeteksi baris spesifik yang cacat
              for (const item of upserts) {
                try {
                  const { error } = await supabase.from('transactions').upsert([{ ...item.payload, user_id: userId }], { onConflict: 'id' }).abortSignal(abortController.signal);
                  if (error) throw error;
                  processedIds.push(item.id);
                } catch (singleErr) {
                  if (isNetworkError(singleErr)) throw singleErr;
                  deadLetterItems.push({ ...item, error: singleErr.message });
                }
              }
            }
          }

          // --- 2. O(1) BULK DELETE (SEBELUMNYA SERIAL BOTTLENECK) ---
          if (deletes.length > 0) {
            const deleteEntityIds = deletes.map(d => d.entity_id);
            try {
              const { error } = await supabase
                .from('transactions')
                .update({ deleted_at: new Date().toISOString() })
                .in('id', deleteEntityIds)
                .eq('user_id', userId)
                .abortSignal(abortController.signal);
              
              if (error) throw error;
              processedIds.push(...deletes.map(item => item.id));
            } catch (bulkError) {
              if (isNetworkError(bulkError) || bulkError.message === 'SYNC_ABORTED') throw bulkError;
              // Fallback ke Dead Letter Queue
              deadLetterItems.push(...deletes.map(item => ({ ...item, error: bulkError.message })));
            }
          }

          // --- 3. QUEUE CLEANUP ---
          if (processedIds.length > 0) await localDB.action_queue.bulkDelete(processedIds);

          if (deadLetterItems.length > 0) {
            const dlqUpdates = deadLetterItems.map(dead => ({
              ...dead,
              sync_status: 'failed',
              sync_attempts: (dead.sync_attempts || 0) + 1,
              last_error: dead.error
            }));
            await localDB.action_queue.bulkPut(dlqUpdates);
          }

          // --- 4. CACHE INVALIDATION FACTORY ---
          if (processedIds.length > 0) {
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.dashboard(userId), refetchType: 'active' });
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.masterData(userId), refetchType: 'active' });
          }
        }
      } catch (err) {
        if (err.message !== 'SYNC_ABORTED') console.warn('[Sync Engine] Dijeda:', err.message);
      } finally {
        isSyncing.current = false;
      }
    };

    window.addEventListener('online', processActionQueue);
    if (navigator.onLine) processActionQueue();

    return () => {
      abortController.abort();
      window.removeEventListener('online', processActionQueue);
    };
  }, [userId, queryClient]);
}