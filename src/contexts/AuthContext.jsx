import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

// Inisialisasi Context
const AuthContext = createContext({user: null, loading: true});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    // EVENT LISTENER: Penanganan sesi kedaluwarsa dari queryClient
    const handleSessionExpired = async () => {
      if (isMounted) {
        await supabase.auth.signOut();
        setUser(null);
        setLoading(false);
        // Pembersihan hard-refresh untuk memastikan memori Javascript kosong
        window.location.replace('/login'); 
      }
    };

    window.addEventListener('session-expired', handleSessionExpired);

    const getSession = async () => { /* ... kode getSession sebelumnya tetap sama ... */ };
    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isMounted) {
          setUser(session?.user ?? null);
          setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
      window.removeEventListener('session-expired', handleSessionExpired);
    };
  }, []);

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