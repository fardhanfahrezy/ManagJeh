// Lapisan validasi agnostik (Bisa diganti dengan Zod/Yup di masa depan tanpa merusak UI)
export const validateTransaction = (payload) => {
  if (!payload.amount || payload.amount <= 0) {
    throw new Error('Nominal transaksi harus lebih besar dari 0.');
  }
  if (!payload.account_id) {
    throw new Error('Sumber dompet harus dipilih.');
  }
  if (payload.type === 'transfer') {
    if (!payload.transfer_to_account_id) {
      throw new Error('Rekening tujuan harus dipilih.');
    }
    if (payload.account_id === payload.transfer_to_account_id) {
      throw new Error('Dompet sumber dan tujuan tidak boleh sama.');
    }
  } else if (!payload.category_id) {
    throw new Error('Kategori laporan harus dipilih.');
  }
  
  // XSS / Injection basic prevention (Supabase juga akan menolaknya, tapi kita cegah di klien)
  if (payload.description && /[<>]/.test(payload.description)) {
    throw new Error('Catatan mengandung karakter yang tidak diizinkan (< atau >).');
  }

  return true;
};