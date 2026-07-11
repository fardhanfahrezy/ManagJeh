import Dexie from 'dexie';

export const localDB = new Dexie('ManagjehOfflineDB');

// Versi 3: Menambahkan user_id untuk isolasi data antar pengguna
localDB.version(3).stores({
  action_queue: '++id, entity_id, user_id, action, timestamp',
  transactions: '++local_id, synced, user_id' // Skema untuk transaksi offline
});

/**
 * Merekam jejak mutasi ke dalam antrean lokal saat luring.
 * @param {string} action - 'INSERT', 'UPDATE', atau 'DELETE'
 * @param {string} entityId - UUID dari transaksi
 * @param {string} userId - UUID pengguna yang sedang login (WAJIB)
 * @param {object} payload - Data transaksi
 */
export async function queueOfflineAction(action, entityId, userId, payload = null) {
  if (!userId) throw new Error("Aksi luring dibatalkan: ID Pengguna tidak valid.");
  
  return await localDB.action_queue.add({
    entity_id: entityId,
    user_id: userId,
    action: action,
    payload: payload,
    timestamp: new Date().toISOString()
  });
}

/**
 * Menyimpan transaksi ke IndexedDB saat offline.
 * @param {object} transactionData - Data transaksi lengkap
 */
export async function saveTransactionOffline(transactionData) {
  return await localDB.transactions.add({
    ...transactionData,
    synced: 0, // 0 = belum disinkronisasi
    local_id: crypto.randomUUID(), // ID lokal unik
    user_id: null // Akan diisi saat sinkronisasi oleh useSync
  });
}