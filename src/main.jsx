import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { registerSW } from 'virtual:pwa-register';
import { QueryClientProvider } from '@tanstack/react-query';

// 1. Impor instance queryClient HANYA dari file lib yang baru dibuat
import { queryClient } from './lib/queryClient'; 

import GlobalErrorToast from './components/GlobalErrorToast'

// Registrasi Service Worker untuk PWA
registerSW({ immediate: true });

// Render aplikasi
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <GlobalErrorToast />
      <App />
    </QueryClientProvider>
  </StrictMode>
);