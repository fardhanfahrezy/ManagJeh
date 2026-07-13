// src/App.jsx:
import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { useQuery, QueryClientProvider } from '@tanstack/react-query';
import { supabase } from './lib/supabase';
import Auth from './pages/Auth';
import { ToastProvider } from './contexts/ToastContext';
import { ToastViewport } from './components/ToastViewport';
import Layout from './components/Layout';
import { useSync } from './hooks/useSync';
import { SystemOrchestrator } from './providers/SystemOrchestrator';
import { queryClient } from './lib/queryClient';
import { ErrorBoundary } from './components/ErrorBoundary';

// Lazy Load Pages
const Landing = lazy(() => import('./pages/Landing'));
const Onboarding = lazy(() => import('./pages/Onboarding'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Transaksi = lazy(() => import('./pages/Transaksi'));
const Laporan = lazy(() => import('./pages/Laporan'));
const Langganan = lazy(() => import('./pages/Langganan'));
const Akun = lazy(() => import('./pages/Akun'));

const PageLoader = () => (
  <div className="flex justify-center items-center min-h-[400px] w-full bg-slate-50" role="status" aria-label="Memuat...">
    <div className="smooth-spinner rounded-full h-8 w-8 border-2 border-blue-600"></div>
  </div>
);

// --- PROTECTED ROUTE DENGAN ONBOARDING GUARD ---
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  // Kueri efisien untuk mengecek apakah user sudah punya dompet
  const { data: accounts, isLoading: isCheckingSetup } = useQuery({
    queryKey: ['hasAccounts', user?.id],
    enabled: !!user?.id,
    staleTime: Infinity, // Hemat jaringan, karena jika sudah punya, tidak akan hilang secara tiba-tiba
    queryFn: async () => {
      const { data, error } = await supabase.from('accounts').select('id').limit(1);
      if (error) throw error;
      return data;
    }
  });

  if (loading || isCheckingSetup) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;

  const isSetupRoute = location.pathname === '/setup';
  const hasNoAccounts = accounts?.length === 0;

  // Jika belum punya akun dan TIDAK sedang di rute /setup, paksa pindah ke /setup
  if (hasNoAccounts && !isSetupRoute) {
    return <Navigate to="/setup" replace />;
  }

  // Jika SUDAH punya akun tetapi mencoba mengakses /setup, paksa kembali ke dashboard
  if (!hasNoAccounts && isSetupRoute) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

const AnimatedPage = ({ children }) => (
  <div className="animate-native-glide w-full h-full">{children}</div>
);

function AppRoutes() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) queryClient.clear();
  }, [user]);

  useSync(user?.id);

  return (
    <Routes>
      {/* 1. LAYER PUBLIK */}
      <Route path="/" element={user ? <Navigate to="/dashboard" replace /> : <Suspense fallback={<PageLoader />}><Landing /></Suspense>} />
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Auth />} />

      {/* 2. LAYER SETUP (Terproteksi, tapi tanpa Layout utama) */}
      <Route path="/setup" element={
        <ProtectedRoute>
          <Suspense fallback={<PageLoader />}><Onboarding /></Suspense>
        </ProtectedRoute>
      } />

      {/* 3. LAYER APLIKASI (Terproteksi dengan Layout & Sidebar) */}
      {/* Catatan: Root aplikasi dipindah dari "/" ke "/dashboard" agar logis */}
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<Suspense fallback={<PageLoader />}><AnimatedPage><Dashboard /></AnimatedPage></Suspense>} />
        <Route path="/transaksi" element={<Suspense fallback={<PageLoader />}><AnimatedPage><Transaksi /></AnimatedPage></Suspense>} />
        <Route path="/laporan" element={<Suspense fallback={<PageLoader />}><AnimatedPage><Laporan /></AnimatedPage></Suspense>} />
        <Route path="/langganan" element={<Suspense fallback={<PageLoader />}><AnimatedPage><Langganan /></AnimatedPage></Suspense>} />
        <Route path="/akun" element={<Suspense fallback={<PageLoader />}><AnimatedPage><Akun /></AnimatedPage></Suspense>} />
      </Route>

      {/* 4. FALLBACK */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <BrowserRouter>
            <AuthProvider>
              <SystemOrchestrator>
                <AppRoutes />
                <ToastViewport /> {/* UI di-render di sini, terpisah dari state */}
              </SystemOrchestrator>
            </AuthProvider>
          </BrowserRouter>
        </ToastProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}