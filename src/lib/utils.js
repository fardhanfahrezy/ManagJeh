// src/lib/utils.js
/**
 * Format angka menjadi standar Rupiah (IDR)
 * Mencegah kebocoran type coercion JavaScript secara ketat.
 */
export const formatIDR = (num) => {
  // Parsing eksplisit dan validasi ketat
  const parsedNum = Number(num);
  
  if (num === null || num === undefined || typeof num === 'boolean' || num === '' || Number.isNaN(parsedNum)) {
    return 'Rp 0';
  }
  
  return new Intl.NumberFormat('id-ID', { 
    style: 'currency', 
    currency: 'IDR', 
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(parsedNum);
};

/**
 * Format string tanggal ISO menjadi format lokal Indonesia
 */
export const formatDate = (dateString) => {
  if (!dateString) return '-';
  
  const dateObj = new Date(dateString);
  if (Number.isNaN(dateObj.getTime())) return '-';

  return dateObj.toLocaleDateString('id-ID', { 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric' 
  });
};