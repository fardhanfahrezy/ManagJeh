// src/main.jsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { QueryClientProvider } from '@tanstack/react-query';

import App from './App.jsx';
import './index.css';
import { validateEnv } from './lib/env';
import { queryClient } from './lib/queryClient';
import GlobalErrorToast from './components/GlobalErrorToast';

// 1. Validasi Environment harus dieksekusi setelah semua import, tetapi sebelum render
validateEnv();

// 2. Registrasi Service Worker PWA
registerSW({ immediate: true });

// 3. Render Aplikasi (Tanpa redundansi objek React atau ReactDOM)
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <GlobalErrorToast />
      <App />
    </QueryClientProvider>
  </StrictMode>
);