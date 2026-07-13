// src/providers/SystemOrchestrator.jsx
import { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSync } from '../hooks/useSync'; // Hook useSync versi Final (Tahap sebelumnya)

/**
 * SystemOrchestrator
 * Komponen nir-UI (Headless) yang bertanggung jawab atas Event Orchestration.
 * Mencegah tabrakan antara Auth, Network (Online/Offline), Sinkronisasi, dan Realtime.
 */
export const SystemOrchestrator = ({ children }) => {
  const { user, signOut } = useAuth();
  
  // Menginisialisasi Engine Sinkronisasi secara terpusat (bukan per-halaman)
  // Engine ini sekarang hanya akan merespons terhadap siklus hidup Orchestrator
  useSync(user?.id); 

  const isNetworkOnline = useRef(navigator.onLine);

  useEffect(() => {
    // 1. MANAJEMEN EVENT: Sesi Kedaluwarsa Paksa (Interseptor API)
    const handleSessionExpired = () => {
      console.warn('[Orchestrator] Intervensi: Token ditolak server. Memutus sesi aktif.');
      signOut();
    };

    // 2. MANAJEMEN EVENT: Transisi Jaringan (Global State)
    const handleOnline = () => {
      if (!isNetworkOnline.current) {
        console.info('[Orchestrator] Sistem Kembali Daring. Sinkronisasi diizinkan.');
        isNetworkOnline.current = true;
        // Event internal 'system-online' bisa dikirim ke useSync jika kita mengubah 
        // useSync agar tidak mengikat 'window.online' secara hardcode.
        window.dispatchEvent(new CustomEvent('orchestrator-sync-trigger')); 
      }
    };

    const handleOffline = () => {
      if (isNetworkOnline.current) {
        console.warn('[Orchestrator] Kehilangan Koneksi. Beralih ke Mode Luring Mutlak.');
        isNetworkOnline.current = false;
      }
    };

    window.addEventListener('session-expired', handleSessionExpired);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('session-expired', handleSessionExpired);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [signOut]);

  // Di masa depan (Tahap 3): Pendaftaran Supabase Realtime (Channels) 
  // akan ditempatkan di dalam useEffect terpisah di sini, LALU dibatasi 
  // agar TIDAK mengeksekusi invalidasi cache jika isNetworkOnline.current = false 
  // atau user = null.

  return children;
};