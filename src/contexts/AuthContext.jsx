import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

// Inisialisasi Context
const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // Mencegah kedipan UI (FOUC) saat inisialisasi

  useEffect(() => {
    // 1. Ambil sesi saat aplikasi pertama kali dimuat
    const getSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        setUser(session?.user ?? null);
      } catch (error) {
        console.error('Auth Init Error:', error.message);
      } finally {
        setLoading(false);
      }
    };

    getSession();

    // 2. Pasang pendengar (listener) untuk perubahan status autentikasi (Login/Logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    // Pembersihan memori (Mencegah Memory Leak)
    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  // Hanya render children (komponen anak) jika proses verifikasi sesi selesai
  return (
    <AuthContext.Provider value={{ user, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

// Hook kustom untuk memperingkas pemanggilan context
export const useAuth = () => {
  return useContext(AuthContext);
};