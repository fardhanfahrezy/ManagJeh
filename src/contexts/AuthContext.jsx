// src/contexts/AuthContext.jsx
import { createContext, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useQueryClient } from '@tanstack/react-query';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Hooks aman digunakan karena AuthProvider berada di dalam BrowserRouter
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    let mounted = true;

    // 1. Inisialisasi Sesi Awal
    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (mounted) {
          setUser(session?.user || null);
        }
      } catch (error) {
        console.error('[Auth Engine] Gagal memuat sesi:', error);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initializeAuth();

    // 2. Pendengar Perubahan Status (Event Listener)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;

        setUser(session?.user || null);

        // O(1) State Wipeout & Seamless Routing
        if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
          queryClient.clear(); // Bersihkan memori cache tanpa hard-reload
          navigate('/login', { replace: true }); // Transisi SPA mulus
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe(); // Mencegah memory leak saat komponen di-unmount
    };
  }, [navigate, queryClient]);

  const signOut = async () => {
    try {
      // Pemanggilan ini secara otomatis akan memicu event 'SIGNED_OUT' di atas
      await supabase.auth.signOut();
    } catch (error) {
      console.error('[Auth Engine] Proses keluar gagal:', error);
      // Fallback Kritis: Paksa keluar secara lokal jika server Supabase tidak merespons
      setUser(null);
      queryClient.clear();
      navigate('/login', { replace: true });
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);