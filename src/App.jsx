import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Auth from './pages/Auth';
import Layout from './components/Layout';
// Import hook useSync
import { useSync } from './hooks/useSync';

// Code Splitting
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Transaksi = lazy(() => import('./pages/Transaksi'));
const Kategori = lazy(() => import('./pages/Kategori'));
const Laporan = lazy(() => import('./pages/Laporan'));
const Langganan = lazy(() => import('./pages/Langganan'));
const Akun = lazy(() => import('./pages/Akun'));

// Komponen Pelindung (Route Guard)
function ProtectedRoute({ children }) {
  const { user } = useAuth();
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

// Fallback UI saat memuat halaman
const PageLoader = () => (
  <div className="flex justify-center items-center h-full w-full">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
  </div>
);

function AppRoutes() {
  const { user } = useAuth();

  // ==============================================================================
  // AKTIFKAN SINKRONISASI OTOMATIS DI SINI
  // Sinyal internet akan dipantau secara real-time berdasarkan ID pengguna yang aktif
  // ==============================================================================
  useSync(user?.id);

  return (
    <Routes>
      {/* Jika user mengakses root tapi belum login, arahkan ke /login */}
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Auth />} />

      {/* Rute yang dilindungi, semuanya menggunakan Layout yang sama */}
      <Route 
        path="/" 
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={
          <Suspense fallback={<PageLoader />}>
            <Dashboard />
          </Suspense>
        } />
        <Route path="transaksi" element={
          <Suspense fallback={<PageLoader />}>
            <Transaksi />
          </Suspense>
        } />
        <Route path="laporan" element={
          <Suspense fallback={<PageLoader />}>
            <Laporan />
          </Suspense>
        } />
        <Route path="kategori" element={
          <Suspense fallback={<PageLoader />}>
            <Kategori />
          </Suspense>
        } />
        <Route path="otomasi" element={
          <Suspense fallback={<PageLoader />}>
            <Langganan />
          </Suspense>
        } />
        <Route path="akun" element={
          <Suspense fallback={<PageLoader />}>
            <Akun />
          </Suspense>
        } />
      </Route>
      
      {/* Tangkap URL tidak valid dan arahkan ke dashboard/login */}
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