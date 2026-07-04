import Dexie from 'dexie';

// Inisialisasi Database Lokal di Browser
export const localDB = new Dexie('ManagjehOfflineDB');

// Struktur skema penyimpanan lokal untuk transaksi offline
localDB.version(1).stores({
  transactions: '++local_id, id, amount, type, description, date, category_id, account_id, synced'
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