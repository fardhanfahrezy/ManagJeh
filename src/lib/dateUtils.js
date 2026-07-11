/**
 * Membuat array bucket kosong sesuai periode dan nilai yang dipilih.
 * @param {string} periodType - 'minggu', 'bulan', 'tahun'
 * @param {number} periodValue - jumlah periode (misal 6 bulan)
 * @returns {Array} Array of { label, year, matchKey, income, expense }
 */
export function generateBuckets(periodType, periodValue) {
  const buckets = [];
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  if (periodType === 'minggu') {
    const totalDays = periodValue * 7;
    for (let i = totalDays - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      buckets.push({
        label: d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' }),
        year: d.getFullYear(),
        matchKey: d.toDateString(),
        income: 0,
        expense: 0,
      });
    }
  } else if (periodType === 'bulan') {
    for (let i = periodValue - 1; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      buckets.push({
        label: d.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' }),
        year: d.getFullYear(),
        matchKey: `${d.getFullYear()}-${d.getMonth()}`,
        income: 0,
        expense: 0,
      });
    }
  } else if (periodType === 'tahun') {
    for (let i = periodValue - 1; i >= 0; i--) {
      const d = new Date(today.getFullYear() - i, 0, 1);
      buckets.push({
        label: d.getFullYear().toString(),
        year: d.getFullYear(),
        matchKey: d.getFullYear().toString(),
        income: 0,
        expense: 0,
      });
    }
  }
  return buckets;
}

/**
 * Mencocokkan transaksi ke bucket yang sesuai.
 * @param {Array} buckets - Array bucket
 * @param {string} dateStr - Tanggal transaksi (ISO string)
 * @param {string} periodType - 'minggu', 'bulan', 'tahun'
 * @returns {Object|null} Bucket yang cocok, atau null
 */
export function findBucket(buckets, dateStr, periodType) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;

  if (periodType === 'minggu') {
    const matchKey = d.toDateString();
    return buckets.find(b => b.matchKey === matchKey);
  } else if (periodType === 'bulan') {
    const matchKey = `${d.getFullYear()}-${d.getMonth()}`;
    return buckets.find(b => b.matchKey === matchKey);
  } else if (periodType === 'tahun') {
    const matchKey = d.getFullYear().toString();
    return buckets.find(b => b.matchKey === matchKey);
  }
  return null;
}