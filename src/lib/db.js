import Dexie from 'dexie';

// Inisialisasi Database Lokal di Browser
export const localDB = new Dexie('ManagjehOfflineDB');

// Ganti skema Dexie menjadi:
localDB.version(1).stores({
  transactions: '++local_id, id, synced' // Cukup index parameter relasi dan status sync
});


/**
 * Fungsi pembantu untuk menyimpan transaksi saat offline
 */
export async function saveTransactionOffline(transactionData) {
  return await localDB.transactions.add({
    ...transactionData,
    synced: 0, // 0 = Belum masuk ke server Supabase
    date: transactionData.date || new Date().toISOString()
  });
}