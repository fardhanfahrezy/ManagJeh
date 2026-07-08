import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Auth from './pages/Auth';
import Layout from './components/Layout';
import { useSync } from './hooks/useSync';
import { queryClient } from './lib/queryClient';

// Code Splitting Dinamis untuk Pemangkasan Ukuran Bundle Utama
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Transaksi = lazy(() => import('./pages/Transaksi'));
const Laporan = lazy(() => import('./pages/Laporan'));
const Langganan = lazy(() => import('./pages/Langganan'));
const Akun = lazy(() => import('./pages/Akun'));

// Komponen Proteksi Akses (Route Guard)
function ProtectedRoute({ children }) {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

// Representasi Komponen Indikator Muat Data yang Teroptimasi (Non-blocking)
const PageLoader = () => (
  <div className="flex justify-center items-center min-h-[400px] w-full" role="status" aria-label="Memuat halaman">
    <div className="smooth-spinner rounded-full h-8 w-8 border-2 border-blue-600"></div>
  </div>
);

// ==============================================================================
// KOMPONEN PEMBUNGKUS ANIMASI (Satu Sumber Kebenaran)
// Menggunakan Animasi Native Glide (Micro X-Shift)
// ==============================================================================
const AnimatedPage = ({ children }) => (
  <div className="animate-native-glide w-full h-full">
    {children}
  </div>
);

function AppRoutes() {
  const { user } = useAuth();

  // Bersihkan cache secara menyeluruh saat user logout untuk mencegah kebocoran data
  useEffect(() => {
    if (!user) {
      queryClient.clear();
    }
  }, [user]);

  // Eksekusi Sinkronisasi Real-time. 
  // Pastikan di dalam hook useSync telah diimplementasikan pembersihan event listener (cleanup function)
  useSync(user?.id);
  // useRealtimeSync(user?.id);

  return (
    <Routes>
      {/* Rute Auth (Animasi Zoom-In diatur di dalam file Auth.jsx) */}
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Auth />} />

      {/* Rute Utama dengan Animasi Fade-In */}
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={
          <Suspense fallback={<PageLoader />}>
            <AnimatedPage><Dashboard /></AnimatedPage>
          </Suspense>
        } />
        <Route path="transaksi" element={
          <Suspense fallback={<PageLoader />}>
            <AnimatedPage><Transaksi /></AnimatedPage>
          </Suspense>
        } />
        <Route path="laporan" element={
          <Suspense fallback={<PageLoader />}>
            <AnimatedPage><Laporan /></AnimatedPage>
          </Suspense>
        } />
        <Route path="langganan" element={
          <Suspense fallback={<PageLoader />}>
            <AnimatedPage><Langganan /></AnimatedPage>
          </Suspense>
        } />
        <Route path="akun" element={
          <Suspense fallback={<PageLoader />}>
            <AnimatedPage><Akun /></AnimatedPage>
          </Suspense>
        } />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}