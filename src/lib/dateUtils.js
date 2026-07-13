// src/lib/dateUtils.js

/**
 * HELPER UTAMA: Calendar Date Extractor (Timezone-Safe)
 * Mengambil representasi "Tanggal Kalender" berdasarkan Local Timezone perangkat user.
 * Mengembalikan format konsisten: YYYY-MM-DD tanpa pergeseran akibat UTC.
 */
export const getLocalDateKey = (dateInput) => {
  const d = dateInput ? new Date(dateInput) : new Date();
  if (isNaN(d.getTime())) return null;
  
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  
  return `${y}-${m}-${day}`;
};

/**
 * Menentukan tingkat detail agregasi grafik
 */
export const getGranularity = (type, value) => {
  if (type === 'minggu' || (type === 'bulan' && value <= 3)) return 'daily';
  if (type === 'bulan') return 'monthly';
  return 'yearly';
};

/**
 * Menghitung tanggal mulai untuk query Database.
 * Kita melakukan setHours(0,0,0,0) di Waktu Lokal, LALU konversi ke ISO (UTC)
 * Ini memastikan backend (Postgres) menarik data dengan batas jam 00:00 yang akurat di zona waktu user.
 */
export const calculateStartDate = (type, value) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);

  if (type === 'minggu') {
    d.setDate(d.getDate() - (value * 7));
  } else if (type === 'bulan') {
    d.setMonth(d.getMonth() - value);
  } else if (type === 'tahun') {
    d.setFullYear(d.getFullYear() - value);
  }
  return d.toISOString(); 
};

/**
 * Membangun struktur struktur data bucket (Wadah Grafik).
 * Menggunakan perhitungan Kalender nyata (bukan value * 30 hari).
 * 
 * @returns {Object} { bucketList: Array (untuk UI), bucketMap: Map (untuk agregasi O(1)) }
 */
export const generateBuckets = (type, value) => {
  const bucketList = [];
  const bucketMap = new Map(); // Untuk pencarian O(1)
  const now = new Date();
  const granularity = getGranularity(type, value);

  if (granularity === 'daily') {
    // Navigasi kalender nyata
    const startDate = new Date(now);
    startDate.setHours(0, 0, 0, 0);
    
    if (type === 'minggu') {
      startDate.setDate(startDate.getDate() - (value * 7) + 1);
    } else {
      startDate.setMonth(startDate.getMonth() - value);
      startDate.setDate(startDate.getDate() + 1);
    }

    // Bangun bucket harian
    let current = new Date(startDate);
    while (current <= now) {
      const key = getLocalDateKey(current);
      const bucket = {
        label: current.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
        matchKey: key,
        income: 0,
        expense: 0
      };
      bucketList.push(bucket);
      bucketMap.set(key, bucket); // Insert ke Map
      current.setDate(current.getDate() + 1); // +1 Hari aktual (aman terhadap tahun kabisat)
    }
  } 
  else if (granularity === 'monthly') {
    for (let i = value - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mStr = String(d.getMonth() + 1).padStart(2, '0');
      const key = `${d.getFullYear()}-${mStr}`;
      
      const bucket = {
        label: d.toLocaleDateString('id-ID', { month: 'short' }),
        year: d.getFullYear(),
        matchKey: key,
        income: 0,
        expense: 0
      };
      bucketList.push(bucket);
      bucketMap.set(key, bucket);
    }
  } 
  else if (granularity === 'yearly') {
    for (let i = value - 1; i >= 0; i--) {
      const year = now.getFullYear() - i;
      const key = String(year);
      
      const bucket = {
        label: key,
        matchKey: key,
        income: 0,
        expense: 0
      };
      bucketList.push(bucket);
      bucketMap.set(key, bucket);
    }
  }
  
  return { bucketList, bucketMap };
};

/**
 * Helper untuk mendapatkan Key yang tepat dari timestamp transaksi,
 * memastikan O(1) lookup di Dashboard tidak meleset zona waktunya.
 */
export const getBucketSearchKey = (dateString, granularity) => {
  if (!dateString) return null;
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return null;

  if (granularity === 'daily') {
    return getLocalDateKey(d);
  } else if (granularity === 'monthly') {
    const mStr = String(d.getMonth() + 1).padStart(2, '0');
    return `${d.getFullYear()}-${mStr}`;
  } else if (granularity === 'yearly') {
    return String(d.getFullYear());
  }
  return null;
};