// src/contexts/AuthContext.jsx
import { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useQueryClient } from '@tanstack/react-query';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  const signOut = useCallback(async () => {
    // Hanya memanggil API. Pembersihan state dan cache dikoordinasikan oleh listener di bawah.
    await supabase.auth.signOut().catch(err => console.error('[Auth] SignOut failed:', err.message));
  }, []);

  useEffect(() => {
    // 1. SETUP LISTENER TERLEBIH DAHULU (Menghindari Race Condition dengan getSession)
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESH_FAILED') {
        setUser(null);
        // Single Source of Truth untuk pembersihan data finansial
        queryClient.clear(); 
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        setUser(session?.user ?? null);
      }
    });

    // 2. FETCH SESI AWAL
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('[Auth] Initial session fetch failed:', error.message);
      }
      setUser(session?.user ?? null);
      setLoading(false); // Selesai loading, biarkan App.jsx yang mengatur UI
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [queryClient]);

  const value = useMemo(() => ({ user, loading, signOut }), [user, loading, signOut]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);