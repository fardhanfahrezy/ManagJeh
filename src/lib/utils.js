/**
 * Format angka menjadi standar Rupiah (IDR)
 * Menangani edge case null/undefined dan mencegah error parsing.
 */
export const formatIDR = (num) => {
  if (num === null || num === undefined || isNaN(num)) return 'Rp 0';
  return new Intl.NumberFormat('id-ID', { 
    style: 'currency', 
    currency: 'IDR', 
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(num);
};

/**
 * Format string tanggal ISO menjadi format lokal Indonesia
 */
export const formatDate = (dateString) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('id-ID', { 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric' 
  });
};