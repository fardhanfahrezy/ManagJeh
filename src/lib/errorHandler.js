/**
 * Menerjemahkan kode error mentah dari Supabase/PostgreSQL 
 * menjadi pesan UI yang ramah pengguna.
 */
export const parseSupabaseError = (error) => {
    if (!error) return "Terjadi kesalahan sistem yang tidak diketahui.";

    // 1. Tangkap Custom Error dari RPC (RAISE EXCEPTION kode P0001)
    if (error.code === 'P0001' || error.message?.includes('Akses Ditolak')) {
        return error.message; 
    }

    // 2. Kamus Kode Error Standar PostgreSQL
    const errorDictionary = {
        '42501': 'Akses ditolak: Anda tidak memiliki izin untuk tindakan ini.',
        '23505': 'Data duplikat: Informasi ini sudah terdaftar di sistem.',
        '23503': 'Tindakan ditolak: Data ini masih terhubung dengan catatan lain.',
        '22P02': 'Format data tidak valid. Periksa kembali input Anda.',
        '23514': 'Validasi gagal: Nominal tidak boleh kurang dari atau sama dengan nol.',
    };

    if (error.code && errorDictionary[error.code]) {
        return errorDictionary[error.code];
    }

    // 3. Fallback Network / Offline Error
    if (error.message?.toLowerCase().includes('failed to fetch') || error.message?.toLowerCase().includes('network')) {
        return 'Koneksi terputus. Pastikan perangkat terhubung ke internet.';
    }

    return error.message || "Gagal memproses permintaan.";
};

// Event Dispatcher Ringan untuk memicu UI Toast secara global
export const triggerGlobalToast = (message, type = 'error') => {
    const event = new CustomEvent('app-toast', { detail: { message, type } });
    window.dispatchEvent(event);
};