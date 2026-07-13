// src/hooks/useSync.js
import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { localDB } from '../lib/db';
import { useQueryClient } from '@tanstack/react-query';

// --- CONFIGURATION ---
const DEFAULT_BATCH_SIZE = 30;
const MAX_RETRIES = 3;
const MAX_SYNC_ATTEMPTS = 10; // Batas absolut sebelum transaksi dinyatakan cacat permanen (DLQ)

// --- HELPER: Network Error Detector ---
const isNetworkError = (err) => {
  if (!err) return false;
  const msg = err.message?.toLowerCase() || '';
  const code = String(err.code || '');
  const status = Number(err.status || 0);

  if (msg.includes('fetch') || msg.includes('network') || msg.includes('abort') || 
      msg.includes('timeout') || msg.includes('econnreset') || msg.includes('domexception')) return true;
  if (status === 408 || status === 429 || status >= 500) return true;
  if (['PGRST000', 'PGRST003', 'PGRST301'].includes(code)) return true;
  
  return false;
};

// --- HELPER: Abortable Sleep ---
const abortableSleep = (ms, signal) => new Promise((resolve, reject) => {
  if (signal?.aborted) return reject(new Error('SYNC_ABORTED'));
  const timer = setTimeout(resolve, ms);
  signal?.addEventListener('abort', () => {
    clearTimeout(timer);
    reject(new Error('SYNC_ABORTED'));
  }, { once: true });
});

// --- HELPER: Queue Compaction (The Game Changer) ---
// Menyusutkan antrean: INSERT+UPDATE -> INSERT, INSERT+DELETE -> Batal
const compactQueue = (queue) => {
  const compactedMap = new Map();
  const redundantIds = [];

  for (const item of queue) {
    const existing = compactedMap.get(item.entity_id);

    if (!existing) {
      compactedMap.set(item.entity_id, { ...item });
      continue;
    }

    // Resolusi Konflik Internal (Self-Healing Queue)
    if (existing.action === 'INSERT' && item.action === 'UPDATE') {
      existing.payload = { ...existing.payload, ...item.payload };
      redundantIds.push(item.id); 
    } else if (existing.action === 'INSERT' && item.action === 'DELETE') {
      redundantIds.push(existing.id, item.id); // Keduanya dibatalkan
      compactedMap.delete(item.entity_id);
    } else if (existing.action === 'UPDATE' && item.action === 'UPDATE') {
      existing.payload = { ...existing.payload, ...item.payload };
      redundantIds.push(item.id);
    } else if (existing.action === 'UPDATE' && item.action === 'DELETE') {
      existing.action = 'DELETE';
      existing.payload = null;
      redundantIds.push(item.id);
    } else {
      // Skenario tidak standar, simpan iterasi terbaru
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
      const startTime = performance.now();

      try {
        let loopCount = 0;

        while (true) {
          if (abortController.signal.aborted) break;
          loopCount++;

          const rawQueue = await localDB.action_queue
            .where('user_id')
            .equals(userId)
            .sortBy('id');
            
          // Filter item yang tidak cacat permanen
          const activeQueue = rawQueue.filter(item => (item.sync_attempts || 0) < MAX_SYNC_ATTEMPTS);
          
          if (activeQueue.length === 0) break;

          // 1. COMPACTION PHASE
          const { compactedQueue, redundantIds } = compactQueue(activeQueue);
          
          if (redundantIds.length > 0) {
            await localDB.action_queue.bulkDelete(redundantIds);
            console.info(`[Sync] Compaction menghapus ${redundantIds.length} operasi redundan.`);
            if (compactedQueue.length === 0) continue; // Cek queue baru
          }

          // 2. BATCH STRATEGY
          const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
          const batchSize = (connection && connection.effectiveType === '4g') ? 100 : DEFAULT_BATCH_SIZE;
          const chunk = compactedQueue.slice(0, batchSize);
          
          let processedIds = [];
          let deadLetterItems = [];

          const upserts = chunk.filter(item => item.action === 'INSERT' || item.action === 'UPDATE');
          const deletes = chunk.filter(item => item.action === 'DELETE');

          // --- UPSERT EXECUTION ---
          if (upserts.length > 0) {
            const payloads = upserts.map(item => ({ ...item.payload, user_id: userId }));
            try {
              let attempt = 0;
              while (attempt < MAX_RETRIES) {
                if (abortController.signal.aborted) throw new Error('SYNC_ABORTED');
                attempt++;
                // Injeksi AbortSignal ke Supabase Request
                const { error } = await supabase.from('transactions').upsert(payloads, { onConflict: 'id' }).abortSignal(abortController.signal);
                if (!error) break;
                if (!isNetworkError(error) || attempt === MAX_RETRIES) throw error;
                await abortableSleep(1000 * Math.pow(2, attempt), abortController.signal);
              }
              processedIds.push(...upserts.map(item => item.id));
            } catch (bulkError) {
              if (isNetworkError(bulkError) || bulkError.message === 'SYNC_ABORTED') throw bulkError;

              // Fallback Serial Ops
              for (const item of upserts) {
                if (abortController.signal.aborted) throw new Error('SYNC_ABORTED');
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

          // --- DELETE EXECUTION (SERIAL) ---
          for (const item of deletes) {
            if (abortController.signal.aborted) throw new Error('SYNC_ABORTED');
            try {
              let attempt = 0;
              while (attempt < MAX_RETRIES) {
                if (abortController.signal.aborted) throw new Error('SYNC_ABORTED');
                attempt++;
                const { error } = await supabase.from('transactions').update({ deleted_at: new Date().toISOString() }).eq('id', item.entity_id).eq('user_id', userId).abortSignal(abortController.signal);
                if (!error) break;
                if (!isNetworkError(error) || attempt === MAX_RETRIES) throw error;
                await abortableSleep(1000 * Math.pow(2, attempt), abortController.signal);
              }
              processedIds.push(item.id);
            } catch (deleteErr) {
              if (isNetworkError(deleteErr)) throw deleteErr;
              deadLetterItems.push({ ...item, error: deleteErr.message });
            }
          }

          // 3. CLEANUP & DLQ UPDATE
          if (processedIds.length > 0) {
            await localDB.action_queue.bulkDelete(processedIds);
          }

          if (deadLetterItems.length > 0) {
            // Bulk update untuk Dead Letter Queue agar memori lokal tidak stres
            const dlqUpdates = deadLetterItems.map(dead => ({
              ...dead,
              sync_status: 'failed',
              sync_attempts: (dead.sync_attempts || 0) + 1,
              last_error: dead.error,
              last_attempt_at: new Date().toISOString()
            }));
            await localDB.action_queue.bulkPut(dlqUpdates);
          }

          // Cache update tanpa hard loading (Background Refetching)
          if (processedIds.length > 0) {
            queryClient.invalidateQueries({ queryKey: ['dashboardData', userId], refetchType: 'active' });
            queryClient.invalidateQueries({ queryKey: ['accounts', userId], refetchType: 'active' });
          }

          // --- TELEMETRY ---
          const endTime = performance.now();
          console.info(`[Telemetry] Sync Chunk ${loopCount}: ${Math.round(endTime - startTime)}ms | Processed: ${processedIds.length} | DLQ: ${deadLetterItems.length}`);
        }
      } catch (err) {
        if (err.message !== 'SYNC_ABORTED') {
          console.warn('[Sync Engine] Dijeda karena jaringan/sistem:', err.message);
        }
      } finally {
        isSyncing.current = false;
      }
    };

    window.addEventListener('online', processActionQueue);
    if (navigator.onLine) processActionQueue();

    return () => {
      abortController.abort(); // Langsung hentikan request Supabase dan Sleep jika unmounted
      window.removeEventListener('online', processActionQueue);
    };
  }, [userId, queryClient]);
}